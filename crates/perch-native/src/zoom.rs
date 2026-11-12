//! The window's zoom: the level the web keeps in `zoom.ts`, each step scaling the terminals by
//! 1.2 between five steps down and eight up. It is the window's own, in memory: a new window
//! starts at 100%.

const MIN: i32 = -5;
const MAX: i32 = 8;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Zoom(i32);

impl Zoom {
    pub fn in_(self) -> Self {
        Self((self.0 + 1).min(MAX))
    }

    pub fn out(self) -> Self {
        Self((self.0 - 1).max(MIN))
    }

    pub fn reset(self) -> Self {
        Self(0)
    }

    /// What sizes are multiplied by (1 is 100%), rounded to three places as the web does.
    pub fn factor(self) -> f32 {
        ((1.2f64.powi(self.0) * 1000.0).round() / 1000.0) as f32
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn each_step_scales_by_one_point_two_and_stops_at_the_ends() {
        let mut zoom = Zoom::default();
        assert_eq!(zoom.factor(), 1.0);
        zoom = zoom.in_();
        assert_eq!(zoom.factor(), 1.2);
        zoom = zoom.in_();
        assert_eq!(zoom.factor(), 1.44);
        assert_eq!(zoom.reset().factor(), 1.0);
        assert_eq!(Zoom::default().out().factor(), 0.833);
        let top = (0..20).fold(Zoom::default(), |z, _| z.in_());
        assert_eq!(top.factor(), 4.3);
        let bottom = (0..20).fold(Zoom::default(), |z, _| z.out());
        assert_eq!(bottom.factor(), 0.402);
    }
}
