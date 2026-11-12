//! The main area's tabs and splits, with no GPUI.
//!
//! The web's model (`workspaceTabs.ts`, `splitSets.ts`, `tiledPanes.ts`): a tab is a session, the
//! strip lists the tabs in order, and a split set shows several tabs side by side: a row or column
//! of panes, nested to any depth, at most [`MAX_SPLIT`] panes. A pane is a tab, so closing a pane
//! closes its tab. A session shows in one place at a time because a tab is named by its session.
//! Like the web's, this is per viewer: it is never sent to the core, so no other client reads it
//! and the layout the web stores for a session (`session.layout.set`) is never written.
//!
//! This holds ids and shapes only. The window keeps what each id means (its terminal) and draws
//! [`Tabs::visible`].

/// Most panes a split set holds.
pub const MAX_SPLIT: usize = 4;

/// Panes side by side (`Row`) or stacked (`Col`).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Dir {
    Row,
    Col,
}

/// A side of the focused pane: where a split puts the new pane, or which neighbour to go to.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Side {
    Left,
    Right,
    Up,
    Down,
}

impl Side {
    /// `left`, `right`, `up`, `down`, and the split command's `below` for down.
    pub fn parse(word: &str) -> Option<Self> {
        Some(match word {
            "left" => Self::Left,
            "right" => Self::Right,
            "up" => Self::Up,
            "down" | "below" => Self::Down,
            _ => return None,
        })
    }

    fn dir(self) -> Dir {
        match self {
            Self::Left | Self::Right => Dir::Row,
            Self::Up | Self::Down => Dir::Col,
        }
    }

    fn after(self) -> bool {
        matches!(self, Self::Right | Self::Down)
    }
}

/// A pane (a tab's id) or a row or column of nodes with size fractions summing to 1.
#[derive(Clone, Debug, PartialEq)]
pub enum Node {
    Pane(String),
    Split {
        dir: Dir,
        kids: Vec<Node>,
        sizes: Vec<f32>,
    },
}

fn equal(n: usize) -> Vec<f32> {
    vec![1.0 / n as f32; n]
}

impl Node {
    /// The panes, in layout order.
    pub fn leaves(&self) -> Vec<&str> {
        match self {
            Node::Pane(id) => vec![id],
            Node::Split { kids, .. } => kids.iter().flat_map(Node::leaves).collect(),
        }
    }

    fn has(&self, id: &str) -> bool {
        self.leaves().contains(&id)
    }

    /// `self` without pane `id`: a split left with one child becomes that child, and a child of
    /// the parent's own direction merges into it. The others keep their proportions.
    fn without(&self, id: &str) -> Option<Node> {
        let Node::Split { dir, kids, sizes } = self else {
            return match self {
                Node::Pane(pane) if pane == id => None,
                other => Some(other.clone()),
            };
        };
        let kept: Vec<(Node, f32)> = kids
            .iter()
            .zip(sizes)
            .filter_map(|(kid, size)| kid.without(id).map(|kid| (kid, *size)))
            .collect();
        if kept.len() <= 1 {
            return kept.into_iter().next().map(|(kid, _)| kid);
        }
        let total: f32 = kept.iter().map(|(_, size)| size).sum();
        let (mut kids, mut sizes) = (Vec::new(), Vec::new());
        for (kid, size) in kept {
            let share = if total > 0.0 {
                size / total
            } else {
                1.0 / kids.len().max(1) as f32
            };
            match kid {
                Node::Split {
                    dir: inner,
                    kids: inner_kids,
                    sizes: inner_sizes,
                } if inner == *dir => {
                    sizes.extend(inner_sizes.iter().map(|s| s * share));
                    kids.extend(inner_kids);
                }
                kid => {
                    kids.push(kid);
                    sizes.push(share);
                }
            }
        }
        Some(Node::Split {
            dir: *dir,
            kids,
            sizes,
        })
    }

    /// `new` on `side` of pane `target`: a sibling when the parent runs that way, else `target`
    /// is replaced by a row or column of the two.
    fn insert_beside(&self, target: &str, new: &str, side: Side) -> Node {
        let pair = |first: Node, second: Node| Node::Split {
            dir: side.dir(),
            kids: vec![first, second],
            sizes: vec![0.5, 0.5],
        };
        match self {
            Node::Pane(id) if id == target => {
                let (old, new) = (Node::Pane(id.clone()), Node::Pane(new.into()));
                if side.after() {
                    pair(old, new)
                } else {
                    pair(new, old)
                }
            }
            Node::Pane(_) => self.clone(),
            Node::Split { dir, kids, sizes } => {
                let at = kids
                    .iter()
                    .position(|kid| matches!(kid, Node::Pane(id) if id == target));
                match at {
                    Some(at) if *dir == side.dir() => {
                        let mut kids = kids.clone();
                        kids.insert(at + usize::from(side.after()), Node::Pane(new.into()));
                        Node::Split {
                            dir: *dir,
                            sizes: equal(kids.len()),
                            kids,
                        }
                    }
                    _ => Node::Split {
                        dir: *dir,
                        kids: kids
                            .iter()
                            .map(|kid| kid.insert_beside(target, new, side))
                            .collect(),
                        sizes: sizes.clone(),
                    },
                }
            }
        }
    }

    fn swap(&self, a: &str, b: &str) -> Node {
        match self {
            Node::Pane(id) if id == a => Node::Pane(b.into()),
            Node::Pane(id) if id == b => Node::Pane(a.into()),
            Node::Pane(_) => self.clone(),
            Node::Split { dir, kids, sizes } => Node::Split {
                dir: *dir,
                kids: kids.iter().map(|kid| kid.swap(a, b)).collect(),
                sizes: sizes.clone(),
            },
        }
    }
}

/// Where a pane is, as fractions of the whole.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Rect {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
}

/// Each pane's place in `node` laid out in the unit square.
pub fn layout(node: &Node, rect: Rect, out: &mut Vec<(String, Rect)>) {
    match node {
        Node::Pane(id) => out.push((id.clone(), rect)),
        Node::Split { dir, kids, sizes } => {
            let mut at = 0.0;
            for (kid, size) in kids.iter().zip(sizes) {
                let r = match dir {
                    Dir::Row => Rect {
                        x: rect.x + rect.w * at,
                        w: rect.w * size,
                        ..rect
                    },
                    Dir::Col => Rect {
                        y: rect.y + rect.h * at,
                        h: rect.h * size,
                        ..rect
                    },
                };
                layout(kid, r, out);
                at += size;
            }
        }
    }
}

/// The tabs, the split sets, and which tab has the keyboard.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Tabs {
    strip: Vec<String>,
    /// Each a split of two or more tabs; a tab is in at most one.
    sets: Vec<Node>,
    active: Option<String>,
    /// The focused pane fills the area (`panes.zoom`).
    zoomed: bool,
}

impl Tabs {
    /// The tab ids in order.
    pub fn strip(&self) -> &[String] {
        &self.strip
    }

    /// The tab with the keyboard.
    pub fn active(&self) -> Option<&str> {
        self.active.as_deref()
    }

    pub fn zoomed(&self) -> bool {
        self.zoomed && self.set_of(self.active.as_deref()).is_some()
    }

    pub fn contains(&self, id: &str) -> bool {
        self.strip.iter().any(|tab| tab == id)
    }

    fn set_of(&self, id: Option<&str>) -> Option<usize> {
        let id = id?;
        self.sets.iter().position(|set| set.has(id))
    }

    /// Add a tab at the end and give it the keyboard; one already open is just shown.
    pub fn open(&mut self, id: &str) {
        if !self.contains(id) {
            self.strip.push(id.into());
        }
        self.show(id);
    }

    /// Give a tab the keyboard. Leaving a zoomed pane for another tab un-zooms.
    pub fn show(&mut self, id: &str) -> bool {
        if !self.contains(id) {
            return false;
        }
        if self.zoomed && self.active.as_deref() != Some(id) {
            self.zoomed = false;
        }
        self.active = Some(id.into());
        true
    }

    /// The tab at `index` (1 is first); `None` counts from the end (`tabs.last`).
    pub fn jump(&mut self, index: Option<usize>) -> bool {
        let id = match index {
            Some(n) => n.checked_sub(1).and_then(|i| self.strip.get(i)),
            None => self.strip.last(),
        };
        let id = id.cloned();
        id.is_some_and(|id| self.show(&id))
    }

    /// The next (`1`) or previous (`-1`) tab, wrapping.
    pub fn step(&mut self, by: isize) {
        let len = self.strip.len() as isize;
        if len == 0 {
            return;
        }
        let at = self
            .active
            .as_ref()
            .and_then(|a| self.strip.iter().position(|t| t == a))
            .map_or(-1, |at| at as isize);
        let to = (at + by).rem_euclid(len) as usize;
        let id = self.strip[to].clone();
        self.show(&id);
    }

    /// Close a tab. If it had the keyboard, the next tab takes it, else the one before. Returns
    /// whether it was open.
    pub fn close(&mut self, id: &str) -> bool {
        let Some(at) = self.strip.iter().position(|tab| tab == id) else {
            return false;
        };
        self.strip.remove(at);
        self.leave(id);
        if self.active.as_deref() == Some(id) {
            self.zoomed = false;
            self.active = self.strip.get(at).or_else(|| self.strip.last()).cloned();
        }
        true
    }

    /// Move a tab to a number in the strip (1 is first).
    pub fn move_tab(&mut self, id: &str, index: usize) -> bool {
        let Some(from) = self.strip.iter().position(|tab| tab == id) else {
            return false;
        };
        if index == 0 || index > self.strip.len() {
            return false;
        }
        let tab = self.strip.remove(from);
        self.strip.insert(index - 1, tab);
        true
    }

    /// Take a tab out of its split; a set left with one pane dissolves.
    fn leave(&mut self, id: &str) {
        let sets = std::mem::take(&mut self.sets);
        self.sets = sets
            .into_iter()
            .filter_map(|set| set.without(id))
            .filter(|set| matches!(set, Node::Split { .. }))
            .collect();
    }

    /// Take a tab out of its split and show it alone; the tab stays (`pane.unsplit`).
    pub fn unsplit(&mut self, id: &str) {
        self.leave(id);
        self.zoomed = false;
        self.show(id);
    }

    /// Put a new tab on `side` of the focused one, and give it the keyboard. `false` when there
    /// is no focused tab, the set is full, or the tab is already in this set.
    pub fn split(&mut self, new: &str, side: Side) -> bool {
        let Some(target) = self.active.clone() else {
            return false;
        };
        let home = self.set_of(Some(&target));
        let panes = home.map_or(1, |i| self.sets[i].leaves().len());
        if panes >= MAX_SPLIT || new == target || home.is_some_and(|i| self.sets[i].has(new)) {
            return false;
        }
        // A tab shows in one place: it leaves any other set first.
        self.leave(new);
        let home = self.set_of(Some(&target));
        let base = home.map_or(Node::Pane(target.clone()), |i| self.sets[i].clone());
        let made = base.insert_beside(&target, new, side);
        match home {
            Some(i) => self.sets[i] = made,
            None => self.sets.push(made),
        }
        if !self.contains(new) {
            self.strip.push(new.into());
        }
        self.zoomed = false;
        self.active = Some(new.into());
        true
    }

    /// What the area draws: the focused pane alone when zoomed or in no split, else its split.
    pub fn visible(&self) -> Option<Node> {
        let active = self.active.as_deref()?;
        if self.zoomed() {
            return Some(Node::Pane(active.into()));
        }
        Some(
            self.set_of(Some(active))
                .map_or_else(|| Node::Pane(active.into()), |i| self.sets[i].clone()),
        )
    }

    /// The panes drawn, in layout order.
    pub fn shown(&self) -> Vec<String> {
        self.visible()
            .map(|n| n.leaves().iter().map(|id| id.to_string()).collect())
            .unwrap_or_default()
    }

    /// Zoom the focused pane to fill the area, or restore (`panes.zoom`). Only a split zooms.
    pub fn zoom(&mut self) -> bool {
        if self.set_of(self.active.as_deref()).is_none() {
            return false;
        }
        self.zoomed = !self.zoomed;
        true
    }

    /// The pane next to the focused one on `side`, by the layout's geometry, nested splits
    /// included: the nearest one that overlaps it, the most overlapping on a tie.
    pub fn neighbor(&self, side: Side) -> Option<String> {
        let set = self.sets.get(self.set_of(self.active.as_deref())?)?;
        let active = self.active.as_deref()?;
        let mut panes = Vec::new();
        layout(
            set,
            Rect {
                x: 0.0,
                y: 0.0,
                w: 1.0,
                h: 1.0,
            },
            &mut panes,
        );
        let a = panes.iter().find(|(id, _)| id == active)?.1;
        let eps = 1e-6;
        let mut best: Option<(&str, f32, f32)> = None;
        for (id, r) in &panes {
            if id == active {
                continue;
            }
            let (gap, overlap) = match side {
                Side::Right => (r.x - (a.x + a.w), (a.y + a.h).min(r.y + r.h) - a.y.max(r.y)),
                Side::Left => (a.x - (r.x + r.w), (a.y + a.h).min(r.y + r.h) - a.y.max(r.y)),
                Side::Down => (r.y - (a.y + a.h), (a.x + a.w).min(r.x + r.w) - a.x.max(r.x)),
                Side::Up => (a.y - (r.y + r.h), (a.x + a.w).min(r.x + r.w) - a.x.max(r.x)),
            };
            if gap < -eps || overlap <= eps {
                continue;
            }
            let better = best
                .is_none_or(|(_, g, o)| gap < g - eps || ((gap - g).abs() <= eps && overlap > o));
            if better {
                best = Some((id, gap, overlap));
            }
        }
        best.map(|(id, _, _)| id.to_string())
    }

    /// Give the keyboard to the neighbour on `side` (`pane.go`).
    pub fn go(&mut self, side: Side) -> bool {
        match self.neighbor(side) {
            Some(id) => self.show(&id),
            None => false,
        }
    }

    /// The next or previous pane of the split, wrapping (`panes.next`, `panes.prev`).
    pub fn cycle(&mut self, by: isize) -> bool {
        let shown = self.shown();
        let Some(at) = shown
            .iter()
            .position(|id| Some(id.as_str()) == self.active())
        else {
            return false;
        };
        if shown.len() < 2 {
            return false;
        }
        let to = (at as isize + by).rem_euclid(shown.len() as isize) as usize;
        self.show(&shown[to].clone())
    }

    /// Swap the focused pane's place with another pane's (`pane.swap`). Focus stays with the tab.
    pub fn swap_with(&mut self, other: &str) -> bool {
        let Some(active) = self.active.clone() else {
            return false;
        };
        let Some(i) = self.set_of(Some(&active)) else {
            return false;
        };
        if !self.sets[i].has(other) || other == active {
            return false;
        }
        self.sets[i] = self.sets[i].swap(&active, other);
        true
    }

    /// Swap with the neighbour on `side`.
    pub fn swap_side(&mut self, side: Side) -> bool {
        match self.neighbor(side) {
            Some(id) => self.swap_with(&id),
            None => false,
        }
    }

    /// Swap with the next pane in layout order.
    pub fn swap_next(&mut self) -> bool {
        let shown = self.shown();
        let Some(at) = shown
            .iter()
            .position(|id| Some(id.as_str()) == self.active())
        else {
            return false;
        };
        if shown.len() < 2 {
            return false;
        }
        let next = shown[(at + 1) % shown.len()].clone();
        self.swap_with(&next)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tabs(ids: &[&str]) -> Tabs {
        let mut t = Tabs::default();
        for id in ids {
            t.open(id);
        }
        t
    }

    fn pane(id: &str) -> Node {
        Node::Pane(id.into())
    }

    #[test]
    fn opening_adds_a_tab_once_and_shows_it() {
        let mut t = tabs(&["a", "b"]);
        assert_eq!(t.strip(), ["a", "b"]);
        assert_eq!(t.active(), Some("b"));
        t.open("a");
        assert_eq!(t.strip(), ["a", "b"], "a tab already open is only shown");
        assert_eq!(t.active(), Some("a"));
        assert!(!t.show("nope"));
    }

    #[test]
    fn selecting_by_number_and_stepping_wrap() {
        let mut t = tabs(&["a", "b", "c"]);
        assert!(t.jump(Some(1)));
        assert_eq!(t.active(), Some("a"));
        assert!(!t.jump(Some(0)));
        assert!(!t.jump(Some(4)));
        assert!(t.jump(None));
        assert_eq!(t.active(), Some("c"));
        t.step(1);
        assert_eq!(t.active(), Some("a"));
        t.step(-1);
        assert_eq!(t.active(), Some("c"));
    }

    #[test]
    fn closing_the_shown_tab_shows_the_next_else_the_one_before() {
        let mut t = tabs(&["a", "b", "c"]);
        t.show("b");
        assert!(t.close("b"));
        assert_eq!(t.active(), Some("c"));
        assert!(t.close("c"));
        assert_eq!(t.active(), Some("a"));
        assert!(t.close("a"));
        assert_eq!(t.active(), None, "the last tab leaves an empty area");
        assert!(!t.close("a"));
        // Closing another tab leaves the shown one.
        let mut t = tabs(&["a", "b", "c"]);
        t.close("a");
        assert_eq!(t.active(), Some("c"));
    }

    #[test]
    fn a_tab_moves_to_a_number_in_the_strip() {
        let mut t = tabs(&["a", "b", "c"]);
        assert!(t.move_tab("c", 1));
        assert_eq!(t.strip(), ["c", "a", "b"]);
        assert!(!t.move_tab("c", 4));
        assert!(!t.move_tab("c", 0));
        assert!(!t.move_tab("x", 1));
    }

    #[test]
    fn splitting_puts_the_new_tab_beside_the_focused_one_and_focuses_it() {
        let mut t = tabs(&["a"]);
        assert!(t.split("b", Side::Right));
        assert_eq!(t.strip(), ["a", "b"]);
        assert_eq!(t.active(), Some("b"));
        assert_eq!(
            t.visible(),
            Some(Node::Split {
                dir: Dir::Row,
                kids: vec![pane("a"), pane("b")],
                sizes: vec![0.5, 0.5]
            })
        );
        // Down from b nests a column in the row.
        assert!(t.split("c", Side::Down));
        let Some(Node::Split { kids, .. }) = t.visible() else {
            panic!("a split")
        };
        assert_eq!(
            kids[1],
            Node::Split {
                dir: Dir::Col,
                kids: vec![pane("b"), pane("c")],
                sizes: vec![0.5, 0.5]
            }
        );
        // Left of c: a sibling in the column.
        assert!(t.split("d", Side::Up));
        assert_eq!(t.shown(), ["a", "b", "d", "c"].map(String::from));
    }

    #[test]
    fn a_split_holds_four_and_never_a_tab_twice() {
        let mut t = tabs(&["a"]);
        assert!(t.split("b", Side::Right));
        assert!(t.split("c", Side::Right));
        assert!(t.split("d", Side::Right));
        assert!(!t.split("e", Side::Right), "a fifth pane is refused");
        assert_eq!(t.shown().len(), 4);
        assert!(!t.split("a", Side::Right), "a pane already in it");
        // A tab in another set leaves it to join this one.
        let mut t = tabs(&["a", "b"]);
        t.show("a");
        assert!(t.split("c", Side::Right));
        t.show("b");
        assert!(t.split("d", Side::Right));
        t.show("a");
        assert!(t.split("d", Side::Down), "d moves from b's split to a's");
        assert_eq!(t.shown().len(), 3);
        t.show("b");
        assert_eq!(t.shown(), ["b"], "b is alone again");
    }

    #[test]
    fn closing_a_pane_collapses_the_split_around_it() {
        let mut t = tabs(&["a"]);
        t.split("b", Side::Right);
        t.split("c", Side::Down);
        t.close("c");
        assert_eq!(t.shown(), ["a", "b"].map(String::from));
        t.close("b");
        assert_eq!(t.visible(), Some(pane("a")), "one pane left is no split");
        assert_eq!(t.active(), Some("a"));
    }

    #[test]
    fn focus_moves_by_the_geometry_of_nested_splits() {
        // a | (b over c)
        let mut t = tabs(&["a"]);
        t.split("b", Side::Right);
        t.split("c", Side::Down);
        assert_eq!(t.active(), Some("c"));
        assert_eq!(t.neighbor(Side::Up).as_deref(), Some("b"));
        assert_eq!(t.neighbor(Side::Left).as_deref(), Some("a"));
        assert_eq!(t.neighbor(Side::Right), None);
        assert_eq!(t.neighbor(Side::Down), None);
        assert!(t.go(Side::Left));
        assert_eq!(t.active(), Some("a"));
        // From a, right is the pane that overlaps most: b and c tie, the nearest first wins.
        assert!(t.go(Side::Right));
        assert!(matches!(t.active(), Some("b" | "c")));
        // Alone, there is nowhere to go.
        let mut solo = tabs(&["a"]);
        assert!(!solo.go(Side::Left));
    }

    #[test]
    fn next_and_previous_pane_cycle_through_the_split() {
        let mut t = tabs(&["a"]);
        t.split("b", Side::Right);
        t.split("c", Side::Right);
        assert_eq!(t.active(), Some("c"));
        assert!(t.cycle(1));
        assert_eq!(t.active(), Some("a"));
        assert!(t.cycle(-1));
        assert_eq!(t.active(), Some("c"));
        assert!(!tabs(&["a"]).cycle(1));
    }

    #[test]
    fn zoom_fills_the_area_until_restored_or_another_tab_is_shown() {
        let mut t = tabs(&["a"]);
        assert!(!t.zoom(), "a lone pane has nothing to zoom out of");
        t.split("b", Side::Right);
        assert!(t.zoom());
        assert_eq!(t.visible(), Some(pane("b")));
        assert!(t.zoomed());
        assert!(t.zoom());
        assert_eq!(t.shown().len(), 2);
        t.zoom();
        t.show("a");
        assert!(!t.zoomed(), "showing another pane restores the split");
    }

    #[test]
    fn swap_exchanges_places_and_focus_stays_with_the_tab() {
        let mut t = tabs(&["a"]);
        t.split("b", Side::Right);
        assert!(t.swap_side(Side::Left));
        assert_eq!(t.shown(), ["b", "a"].map(String::from));
        assert_eq!(t.active(), Some("b"));
        assert!(t.swap_next());
        assert_eq!(t.shown(), ["a", "b"].map(String::from));
        assert!(!t.swap_side(Side::Up));
        assert!(!t.swap_with("nope"));
    }

    #[test]
    fn unsplit_keeps_the_tab_and_shows_it_alone() {
        let mut t = tabs(&["a"]);
        t.split("b", Side::Right);
        t.unsplit("b");
        assert_eq!(t.strip(), ["a", "b"]);
        assert_eq!(t.visible(), Some(pane("b")));
    }

    #[test]
    fn sides_are_the_web_words() {
        assert_eq!(Side::parse("below"), Some(Side::Down));
        assert_eq!(Side::parse("right"), Some(Side::Right));
        assert_eq!(Side::parse("diagonal"), None);
    }
}
