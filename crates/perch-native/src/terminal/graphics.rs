// The placement read, the placeholder (virtual placement) resolution and its geometry, the
// diacritic table lookup, the PNG decode hook and the BGRA conversion follow `Vt::placements`,
// `kitty_virtual_*`, `decode_png` and `Vt::image_bgra` of `src/vt.rs` in herdr
// (https://github.com/herdrdev/herdr-app, commit 4c8c622d7965a6f6787f55b1896b70795fc68918),
// licensed under the Apache License, Version 2.0 (http://www.apache.org/licenses/LICENSE-2.0).
// Modified for Perch: the PNG decode uses the `image` crate GPUI already depends on, the
// placements are read for the view's `Vt`, and the table is read from the Ghostty checkout at
// build time. See THIRD_PARTY_NOTICES.md.

//! Kitty graphics: the images a program put on the screen, where they sit in the viewport, and
//! their pixels. Ghostty keeps the images and works out where direct placements land; images
//! placed with Unicode placeholders (U+10EEEE) are found here, in the cells the program wrote.

use super::vt::Vt;
use ghostty_sys as g;
use std::collections::HashMap;
use std::ffi::c_void;
use std::sync::OnceLock;

/// The most image data a terminal keeps; Ghostty drops the oldest beyond it.
pub const STORAGE_LIMIT: u64 = 128 << 20;

/// One image on screen, in cells of the viewport.
#[derive(Clone, Debug, PartialEq)]
pub struct Placement {
    pub image: u32,
    /// Changes whenever the image's pixels do (cache key).
    pub generation: u64,
    pub col: i32,
    pub row: i32,
    pub width: u32,
    pub height: u32,
    /// The part of the image drawn: x, y, width, height in image pixels.
    pub source: [u32; 4],
    pub offset: [u32; 2],
    /// Placeholder geometry is in whole device pixels of a cell this size; direct placements are
    /// in device pixels already.
    pub cell_pixels: Option<[u32; 2]>,
    pub z: i32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Layer {
    UnderBackground,
    UnderText,
    OverText,
}

impl Placement {
    /// x, y, width, height in the units the cell size is in, for a cell of that size.
    pub fn pixel_geometry(&self, cell_width: f32, cell_height: f32) -> [f32; 4] {
        let [sx, sy] = self.cell_pixels.map_or([1.0, 1.0], |[w, h]| {
            [cell_width / w as f32, cell_height / h as f32]
        });
        [
            self.col as f32 * cell_width + self.offset[0] as f32 * sx,
            self.row as f32 * cell_height + self.offset[1] as f32 * sy,
            self.width as f32 * sx,
            self.height as f32 * sy,
        ]
    }

    /// Where the image goes among the pane's layers, as the kitty protocol orders them: a
    /// direct placement under the cell backgrounds (a layer far below zero), under the text
    /// (below zero), or over it. Placeholder images are text cells, so they cover the cell
    /// backgrounds and sit over the text.
    pub fn layer(&self) -> Layer {
        if self.cell_pixels.is_some() {
            Layer::OverText
        } else if self.z < i32::MIN / 2 {
            Layer::UnderBackground
        } else if self.z < 0 {
            Layer::UnderText
        } else {
            Layer::OverText
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct VirtualSpec {
    image_id: u32,
    placement_id: u32,
    columns: u32,
    rows: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct VirtualCell {
    x: u16,
    y: u16,
    image_id_low: u32,
    image_id_high: Option<u32>,
    placement_id: u32,
    row: Option<u32>,
    col: Option<u32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct VirtualRun {
    x: u16,
    y: u16,
    image_id_low: u32,
    image_id_high: Option<u32>,
    placement_id: u32,
    row: u32,
    col: u32,
    width: u32,
}

impl VirtualRun {
    fn from_cell(cell: VirtualCell) -> Self {
        Self {
            x: cell.x,
            y: cell.y,
            image_id_low: cell.image_id_low,
            image_id_high: cell.image_id_high,
            placement_id: cell.placement_id,
            row: cell.row.unwrap_or(0),
            col: cell.col.unwrap_or(0),
            width: 1,
        }
    }

    /// Take the next cell into the run when it continues it.
    fn append(&mut self, cell: VirtualCell) -> bool {
        if self.image_id_low != cell.image_id_low
            || self.placement_id != cell.placement_id
            || cell.row.is_some_and(|row| row != self.row)
            || cell.col.is_some_and(|col| col != self.col + self.width)
            || cell
                .image_id_high
                .is_some_and(|high| Some(high) != self.image_id_high)
        {
            return false;
        }
        self.width += 1;
        true
    }

    fn image_id(self) -> u32 {
        self.image_id_low | (self.image_id_high.unwrap_or(0) << 24)
    }
}

/// The index of a placeholder row, column or id-high diacritic, from Ghostty's own table.
fn diacritic_index(codepoint: u32) -> Option<u32> {
    static TABLE: OnceLock<HashMap<u32, u32>> = OnceLock::new();
    TABLE
        .get_or_init(|| {
            let source = include_str!(
                "../../../../third_party/ghostty/src/terminal/kitty/graphics_unicode.zig"
            );
            let mut map = HashMap::new();
            let mut in_table = false;
            for line in source.lines().map(str::trim) {
                if line.starts_with("const diacritics:") {
                    in_table = true;
                    continue;
                }
                if !in_table {
                    continue;
                }
                if line == "};" {
                    break;
                }
                let Some(hex) = line
                    .strip_prefix("0x")
                    .and_then(|value| value.strip_suffix(','))
                else {
                    continue;
                };
                if let Ok(value) = u32::from_str_radix(hex, 16) {
                    map.insert(value, map.len() as u32);
                }
            }
            map
        })
        .get(&codepoint)
        .copied()
}

fn color_to_id(color: g::GhosttyStyleColor) -> u32 {
    // SAFETY: the tag says which member of the union is set.
    unsafe {
        match color.tag {
            g::GHOSTTY_STYLE_COLOR_PALETTE => u32::from(color.value.palette),
            g::GHOSTTY_STYLE_COLOR_RGB => {
                let rgb = color.value.rgb;
                (u32::from(rgb.r) << 16) | (u32::from(rgb.g) << 8) | u32::from(rgb.b)
            }
            _ => 0,
        }
    }
}

fn virtual_cell(x: u16, y: u16, grid_ref: &g::GhosttyGridRef) -> Option<VirtualCell> {
    let mut graphemes = vec![0u32; 4];
    let mut len = 0;
    let mut style = g::GhosttyStyle {
        size: std::mem::size_of::<g::GhosttyStyle>(),
        ..Default::default()
    };
    // SAFETY: the buffers are valid for the lengths given.
    unsafe {
        let result = g::ghostty_grid_ref_graphemes(
            grid_ref,
            graphemes.as_mut_ptr(),
            graphemes.len(),
            &mut len,
        );
        if result == g::GHOSTTY_OUT_OF_SPACE {
            graphemes.resize(len, 0);
            if g::ghostty_grid_ref_graphemes(
                grid_ref,
                graphemes.as_mut_ptr(),
                graphemes.len(),
                &mut len,
            ) != g::GHOSTTY_SUCCESS
            {
                return None;
            }
        } else if result != g::GHOSTTY_SUCCESS {
            return None;
        }
        if len == 0 || graphemes[0] != 0x10eeee {
            return None;
        }
        if g::ghostty_grid_ref_style(grid_ref, &mut style) != g::GHOSTTY_SUCCESS {
            return None;
        }
    }
    graphemes.truncate(len);
    Some(VirtualCell {
        x,
        y,
        image_id_low: color_to_id(style.fg_color),
        image_id_high: graphemes
            .get(3)
            .and_then(|c| diacritic_index(*c))
            .filter(|high| *high <= 255),
        placement_id: color_to_id(style.underline_color),
        row: graphemes.get(1).and_then(|c| diacritic_index(*c)),
        col: graphemes.get(2).and_then(|c| diacritic_index(*c)),
    })
}

/// Fit a run of placeholder cells of an image into the grid it spans, without stretching, the
/// image centred, and say which part of the image and of the cells it covers.
fn virtual_geometry(
    run: VirtualRun,
    spec: VirtualSpec,
    (image_width, image_height): (u32, u32),
    (cell_width, cell_height): (u32, u32),
    generation: u64,
) -> Option<Placement> {
    if image_width == 0 || image_height == 0 {
        return None;
    }
    let cols = if spec.columns == 0 {
        image_width.div_ceil(cell_width)
    } else {
        spec.columns
    };
    let rows = if spec.rows == 0 {
        image_height.div_ceil(cell_height)
    } else {
        spec.rows
    };
    if run.col >= cols || run.row >= rows {
        return None;
    }
    let (grid_width, grid_height) = (
        f64::from(cols) * f64::from(cell_width),
        f64::from(rows) * f64::from(cell_height),
    );
    let scale = (grid_width / f64::from(image_width)).min(grid_height / f64::from(image_height));
    let (image_left, image_top) = (
        (grid_width - f64::from(image_width) * scale) / 2.0,
        (grid_height - f64::from(image_height) * scale) / 2.0,
    );
    let (left, top) = (
        f64::from(run.col) * f64::from(cell_width),
        f64::from(run.row) * f64::from(cell_height),
    );
    let (right, bottom) = (
        f64::from((run.col + run.width).min(cols)) * f64::from(cell_width),
        top + f64::from(cell_height),
    );
    let (x0, y0) = (left.max(image_left), top.max(image_top));
    let (x1, y1) = (
        right.min(image_left + f64::from(image_width) * scale),
        bottom.min(image_top + f64::from(image_height) * scale),
    );
    if x1 <= x0 || y1 <= y0 {
        return None;
    }
    let sx0 = (((x0 - image_left) / scale).round() as u32).min(image_width - 1);
    let sy0 = (((y0 - image_top) / scale).round() as u32).min(image_height - 1);
    let sx1 = (((x1 - image_left) / scale).round() as u32).clamp(sx0 + 1, image_width);
    let sy1 = (((y1 - image_top) / scale).round() as u32).clamp(sy0 + 1, image_height);
    // Round shared edges, not slice lengths, so neighbouring runs meet exactly.
    let width = (x1.round() - x0.round()) as u32;
    let height = (y1.round() - y0.round()) as u32;
    if width == 0 || height == 0 {
        return None;
    }
    Some(Placement {
        image: spec.image_id,
        generation,
        col: i32::from(run.x),
        row: i32::from(run.y),
        width,
        height,
        source: [sx0, sy0, sx1 - sx0, sy1 - sy0],
        offset: [(x0.round() - left) as u32, (y0.round() - top) as u32],
        cell_pixels: Some([cell_width, cell_height]),
        // Ghostty gives placeholder images a fixed layer, whatever the virtual placement says.
        z: -1,
    })
}

/// PNG decoding for kitty graphics: libghostty-vt leaves it to the embedder. Everything is
/// handed back as 8-bit RGBA.
unsafe extern "C" fn decode_png(
    _userdata: *mut c_void,
    allocator: *const g::GhosttyAllocator,
    data: *const u8,
    len: usize,
    out: *mut g::GhosttySysImage,
) -> bool {
    // SAFETY: Ghostty passes a buffer of `len` bytes.
    let bytes = unsafe { std::slice::from_raw_parts(data, len) };
    let Ok(decoded) = image::load_from_memory_with_format(bytes, image::ImageFormat::Png) else {
        return false;
    };
    let rgba = decoded.to_rgba8();
    let (width, height) = rgba.dimensions();
    let pixels = rgba.into_raw();
    // SAFETY: the allocation is Ghostty's, sized for the copy, and handed back as the image.
    unsafe {
        let ptr = g::ghostty_alloc(allocator, pixels.len());
        if ptr.is_null() {
            return false;
        }
        std::ptr::copy_nonoverlapping(pixels.as_ptr(), ptr, pixels.len());
        *out = g::GhosttySysImage {
            width,
            height,
            data: ptr,
            data_len: pixels.len(),
        };
    }
    true
}

/// Teach libghostty-vt to decode PNGs, once for the process.
pub fn install_png_decoder() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let decode: g::GhosttySysDecodePngFn = Some(decode_png);
        // SAFETY: the option takes this function pointer type and the function never unwinds.
        unsafe {
            g::ghostty_sys_set(
                g::GHOSTTY_SYS_OPT_DECODE_PNG,
                std::mem::transmute::<g::GhosttySysDecodePngFn, *const c_void>(decode),
            );
        }
    });
}

impl Vt {
    fn kitty(&self) -> Option<g::GhosttyKittyGraphics> {
        let mut graphics: g::GhosttyKittyGraphics = std::ptr::null_mut();
        // SAFETY: the key writes a handle owned by the terminal.
        let ok = unsafe {
            g::ghostty_terminal_get(
                self.term(),
                g::GHOSTTY_TERMINAL_DATA_KITTY_GRAPHICS,
                (&mut graphics as *mut g::GhosttyKittyGraphics).cast(),
            )
        } == g::GHOSTTY_SUCCESS;
        (ok && !graphics.is_null()).then_some(graphics)
    }

    /// The images on the visible rows, the ones under the text first.
    pub fn placements(&self) -> Vec<Placement> {
        let Some(graphics) = self.kitty() else {
            return Vec::new();
        };
        let mut out = Vec::new();
        let mut specs = Vec::new();
        // SAFETY: every handle comes from Ghostty and the iterator is freed once.
        unsafe {
            let mut it: g::GhosttyKittyGraphicsPlacementIterator = std::ptr::null_mut();
            if g::ghostty_kitty_graphics_placement_iterator_new(std::ptr::null(), &mut it)
                != g::GHOSTTY_SUCCESS
            {
                return out;
            }
            if g::ghostty_kitty_graphics_get(
                graphics,
                g::GHOSTTY_KITTY_GRAPHICS_DATA_PLACEMENT_ITERATOR,
                (&mut it as *mut g::GhosttyKittyGraphicsPlacementIterator).cast(),
            ) == g::GHOSTTY_SUCCESS
            {
                while g::ghostty_kitty_graphics_placement_next(it) {
                    let get = |key, out: *mut c_void| {
                        g::ghostty_kitty_graphics_placement_get(it, key, out)
                    };
                    let (mut id, mut z, mut is_virtual) = (0u32, 0i32, false);
                    get(
                        g::GHOSTTY_KITTY_GRAPHICS_PLACEMENT_DATA_IMAGE_ID,
                        (&mut id as *mut u32).cast(),
                    );
                    get(
                        g::GHOSTTY_KITTY_GRAPHICS_PLACEMENT_DATA_Z,
                        (&mut z as *mut i32).cast(),
                    );
                    get(
                        g::GHOSTTY_KITTY_GRAPHICS_PLACEMENT_DATA_IS_VIRTUAL,
                        (&mut is_virtual as *mut bool).cast(),
                    );
                    let image = g::ghostty_kitty_graphics_image(graphics, id);
                    if is_virtual {
                        let (mut placement_id, mut columns, mut rows) = (0u32, 0u32, 0u32);
                        get(
                            g::GHOSTTY_KITTY_GRAPHICS_PLACEMENT_DATA_PLACEMENT_ID,
                            (&mut placement_id as *mut u32).cast(),
                        );
                        get(
                            g::GHOSTTY_KITTY_GRAPHICS_PLACEMENT_DATA_COLUMNS,
                            (&mut columns as *mut u32).cast(),
                        );
                        get(
                            g::GHOSTTY_KITTY_GRAPHICS_PLACEMENT_DATA_ROWS,
                            (&mut rows as *mut u32).cast(),
                        );
                        specs.push(VirtualSpec {
                            image_id: id,
                            placement_id,
                            columns,
                            rows,
                        });
                        continue;
                    }
                    if image.is_null() {
                        continue;
                    }
                    let mut info = g::GhosttyKittyGraphicsPlacementRenderInfo {
                        size: std::mem::size_of::<g::GhosttyKittyGraphicsPlacementRenderInfo>(),
                        ..Default::default()
                    };
                    if g::ghostty_kitty_graphics_placement_render_info(
                        it,
                        image,
                        self.term(),
                        &mut info,
                    ) != g::GHOSTTY_SUCCESS
                        || !info.viewport_visible
                    {
                        continue;
                    }
                    let mut generation = 0u64;
                    g::ghostty_kitty_graphics_image_get(
                        image,
                        g::GHOSTTY_KITTY_IMAGE_DATA_GENERATION,
                        (&mut generation as *mut u64).cast(),
                    );
                    out.push(Placement {
                        image: id,
                        generation,
                        col: info.viewport_col,
                        row: info.viewport_row,
                        width: info.pixel_width,
                        height: info.pixel_height,
                        source: [
                            info.source_x,
                            info.source_y,
                            info.source_width,
                            info.source_height,
                        ],
                        offset: [0, 0],
                        cell_pixels: None,
                        z,
                    });
                }
            }
            g::ghostty_kitty_graphics_placement_iterator_free(it);
        }
        out.extend(self.virtual_placements(graphics, &specs));
        out.sort_by_key(|p| p.z);
        out
    }

    /// Images placed with Unicode placeholders: runs of placeholder cells on the visible rows,
    /// each naming its image in its colours and its piece of it in its diacritics.
    fn virtual_placements(
        &self,
        graphics: g::GhosttyKittyGraphics,
        specs: &[VirtualSpec],
    ) -> Vec<Placement> {
        if specs.is_empty() {
            return Vec::new();
        }
        let (mut width, mut height) = (0u32, 0u32);
        // SAFETY: both keys write a u32.
        unsafe {
            g::ghostty_terminal_get(
                self.term(),
                g::GHOSTTY_TERMINAL_DATA_WIDTH_PX,
                (&mut width as *mut u32).cast(),
            );
            g::ghostty_terminal_get(
                self.term(),
                g::GHOSTTY_TERMINAL_DATA_HEIGHT_PX,
                (&mut height as *mut u32).cast(),
            );
        }
        let (cols, rows) = self.size();
        let cell = (
            (width / u32::from(cols.max(1))).max(1),
            (height / u32::from(rows.max(1))).max(1),
        );
        let mut runs = Vec::new();
        for y in 0..rows {
            let Some(first) = self.cell_ref(0, u32::from(y)) else {
                continue;
            };
            let mut row = g::GhosttyRow::default();
            let mut placeholders = false;
            // SAFETY: `first` is a fresh snapshot; the key writes a bool.
            unsafe {
                g::ghostty_grid_ref_row(&first, &mut row);
                g::ghostty_row_get(
                    row,
                    g::GHOSTTY_ROW_DATA_KITTY_VIRTUAL_PLACEHOLDER,
                    (&mut placeholders as *mut bool).cast(),
                );
            }
            if !placeholders {
                continue;
            }
            let mut current: Option<VirtualRun> = None;
            for x in 0..cols {
                let cell = self
                    .cell_ref(x, u32::from(y))
                    .and_then(|r| virtual_cell(x, y, &r));
                match cell {
                    Some(cell) => {
                        if let Some(run) = current.as_mut() {
                            if run.append(cell) {
                                continue;
                            }
                            runs.push(*run);
                        }
                        current = Some(VirtualRun::from_cell(cell));
                    }
                    None => runs.extend(current.take()),
                }
            }
            runs.extend(current);
        }
        let mut placements = Vec::new();
        for run in runs {
            let id = run.image_id();
            let Some(spec) = specs.iter().find(|spec| {
                spec.image_id == id
                    && (run.placement_id == 0 || spec.placement_id == run.placement_id)
            }) else {
                continue;
            };
            // SAFETY: `graphics` is the terminal's; a missing image is null.
            let image = unsafe { g::ghostty_kitty_graphics_image(graphics, id) };
            if image.is_null() {
                continue;
            }
            let (mut image_width, mut image_height, mut generation) = (0u32, 0u32, 0u64);
            // SAFETY: the keys write a u32, a u32 and a u64.
            unsafe {
                g::ghostty_kitty_graphics_image_get(
                    image,
                    g::GHOSTTY_KITTY_IMAGE_DATA_WIDTH,
                    (&mut image_width as *mut u32).cast(),
                );
                g::ghostty_kitty_graphics_image_get(
                    image,
                    g::GHOSTTY_KITTY_IMAGE_DATA_HEIGHT,
                    (&mut image_height as *mut u32).cast(),
                );
                g::ghostty_kitty_graphics_image_get(
                    image,
                    g::GHOSTTY_KITTY_IMAGE_DATA_GENERATION,
                    (&mut generation as *mut u64).cast(),
                );
            }
            placements.extend(virtual_geometry(
                run,
                *spec,
                (image_width, image_height),
                cell,
                generation,
            ));
        }
        placements
    }

    fn cell_ref(&self, x: u16, y: u32) -> Option<g::GhosttyGridRef> {
        let mut r = g::GhosttyGridRef {
            size: std::mem::size_of::<g::GhosttyGridRef>(),
            ..Default::default()
        };
        let mut p = g::GhosttyPoint {
            tag: g::GHOSTTY_POINT_TAG_VIEWPORT,
            ..Default::default()
        };
        p.value.coordinate = g::GhosttyPointCoordinate { x, y };
        // SAFETY: `p` and `r` are valid for the call.
        (unsafe { g::ghostty_terminal_grid_ref(self.term(), p, &mut r) } == g::GHOSTTY_SUCCESS)
            .then_some(r)
    }

    /// An image's pixels as BGRA (what GPUI uploads), cropped to `source`.
    pub fn image_bgra(&self, id: u32, source: [u32; 4]) -> Option<(u32, u32, Vec<u8>)> {
        let graphics = self.kitty()?;
        // SAFETY: handles are Ghostty's; the data pointer is valid for its length while the
        // image stays stored, which it does for this call.
        unsafe {
            let image = g::ghostty_kitty_graphics_image(graphics, id);
            if image.is_null() {
                return None;
            }
            let (mut w, mut h) = (0u32, 0u32);
            let mut format: g::GhosttyKittyImageFormat = g::GHOSTTY_KITTY_IMAGE_FORMAT_RGBA;
            let (mut ptr, mut len): (*const u8, usize) = (std::ptr::null(), 0);
            let get = |key, out: *mut c_void| g::ghostty_kitty_graphics_image_get(image, key, out);
            get(
                g::GHOSTTY_KITTY_IMAGE_DATA_WIDTH,
                (&mut w as *mut u32).cast(),
            );
            get(
                g::GHOSTTY_KITTY_IMAGE_DATA_HEIGHT,
                (&mut h as *mut u32).cast(),
            );
            get(
                g::GHOSTTY_KITTY_IMAGE_DATA_FORMAT,
                (&mut format as *mut g::GhosttyKittyImageFormat).cast(),
            );
            if get(
                g::GHOSTTY_KITTY_IMAGE_DATA_DATA_PTR,
                (&mut ptr as *mut *const u8).cast(),
            ) != g::GHOSTTY_SUCCESS
                || ptr.is_null()
            {
                return None;
            }
            get(
                g::GHOSTTY_KITTY_IMAGE_DATA_DATA_LEN,
                (&mut len as *mut usize).cast(),
            );
            let pixels = std::slice::from_raw_parts(ptr, len);
            let bytes_per_pixel = match format {
                g::GHOSTTY_KITTY_IMAGE_FORMAT_RGB => 3,
                g::GHOSTTY_KITTY_IMAGE_FORMAT_GRAY_ALPHA => 2,
                g::GHOSTTY_KITTY_IMAGE_FORMAT_GRAY => 1,
                _ => 4,
            };
            let [sx, sy, sw, sh] = source;
            let (sw, sh) = (sw.min(w.saturating_sub(sx)), sh.min(h.saturating_sub(sy)));
            if sw == 0 || sh == 0 {
                return None;
            }
            let mut out = Vec::with_capacity((sw * sh * 4) as usize);
            for y in sy..sy + sh {
                for x in sx..sx + sw {
                    let i = ((y * w + x) as usize) * bytes_per_pixel;
                    let p = pixels.get(i..i + bytes_per_pixel)?;
                    let (r, g, b, a) = match bytes_per_pixel {
                        4 => (p[0], p[1], p[2], p[3]),
                        3 => (p[0], p[1], p[2], 255),
                        2 => (p[0], p[0], p[0], p[1]),
                        _ => (p[0], p[0], p[0], 255),
                    };
                    out.extend_from_slice(&[b, g, r, a]);
                }
            }
            Some((sw, sh, out))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(col: u32, row: u32, width: u32) -> VirtualRun {
        VirtualRun {
            x: 3,
            y: 2,
            image_id_low: 7,
            image_id_high: None,
            placement_id: 0,
            row,
            col,
            width,
        }
    }

    fn spec() -> VirtualSpec {
        VirtualSpec {
            image_id: 7,
            placement_id: 0,
            columns: 4,
            rows: 2,
        }
    }

    #[test]
    fn diacritics_decode_with_ghosttys_table() {
        // The first three entries of the table are U+0305, U+030D and U+030E.
        assert_eq!(diacritic_index(0x0305), Some(0));
        assert_eq!(diacritic_index(0x030D), Some(1));
        assert_eq!(diacritic_index(0x030E), Some(2));
        assert_eq!(diacritic_index('a' as u32), None);
    }

    #[test]
    fn a_placeholder_image_is_fitted_into_its_cells_and_centred() {
        // A 40x10 image in 4x2 cells of 10x20 is a 40x40 grid: the image keeps its shape, fills
        // the width and sits in the middle, across the two rows' meeting edge.
        let top = virtual_geometry(run(0, 0, 4), spec(), (40, 10), (10, 20), 1).unwrap();
        assert_eq!(top.source, [0, 0, 40, 5]);
        assert_eq!((top.offset, top.height), ([0, 15], 5));
        let bottom = virtual_geometry(run(0, 1, 4), spec(), (40, 10), (10, 20), 1).unwrap();
        assert_eq!(bottom.source, [0, 5, 40, 5]);
        assert_eq!((bottom.offset, bottom.height), ([0, 0], 5));
        assert_eq!((bottom.col, bottom.row), (3, 2));
        assert_eq!(bottom.z, -1);
        assert_eq!(bottom.cell_pixels, Some([10, 20]));
        // A run past the grid's columns shows nothing.
        assert_eq!(
            virtual_geometry(run(4, 0, 1), spec(), (40, 10), (10, 20), 1),
            None
        );
    }

    #[test]
    fn neighbouring_runs_meet_exactly() {
        let image = (30, 30);
        let spec = VirtualSpec {
            image_id: 7,
            placement_id: 0,
            columns: 3,
            rows: 3,
        };
        let a = virtual_geometry(run(0, 0, 1), spec, image, (7, 9), 1).unwrap();
        let b = virtual_geometry(run(1, 0, 2), spec, image, (7, 9), 1).unwrap();
        assert_eq!(a.source[0] + a.source[2], b.source[0]);
    }

    #[test]
    fn a_placement_scales_by_the_cell_it_was_measured_in() {
        let direct = Placement {
            image: 1,
            generation: 1,
            col: 2,
            row: 1,
            width: 100,
            height: 50,
            source: [0, 0, 10, 10],
            offset: [0, 0],
            cell_pixels: None,
            z: -3,
        };
        assert_eq!(direct.pixel_geometry(16.0, 32.0), [32.0, 32.0, 100.0, 50.0]);
        assert_eq!(direct.layer(), Layer::UnderText);
        assert_eq!(
            Placement {
                z: i32::MIN,
                ..direct.clone()
            }
            .layer(),
            Layer::UnderBackground
        );
        assert_eq!(
            Placement {
                z: 0,
                ..direct.clone()
            }
            .layer(),
            Layer::OverText
        );
        let placeholder = Placement {
            cell_pixels: Some([8, 16]),
            offset: [2, 4],
            width: 8,
            height: 16,
            z: -1,
            ..direct
        };
        assert_eq!(
            placeholder.pixel_geometry(16.0, 32.0),
            [36.0, 40.0, 16.0, 32.0]
        );
        assert_eq!(placeholder.layer(), Layer::OverText);
    }
}
