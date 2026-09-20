/* Small deterministic trajectory helper shared by future shot-based games. */
(() => {
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  function create({ start = { x: 0, y: 0 }, target = { x: 1, y: 0 }, power = .7, curve = 0, height = .5, duration = 1 } = {}) {
    const d = Math.max(.18, duration), lift = 90 + clamp(height, 0, 1) * 180 + power * 65;
    const dx = target.x - start.x, dy = target.y - start.y;
    return {
      duration: d,
      sample(t) {
        const p = clamp(t / d, 0, 1), ease = p * p * (3 - 2 * p);
        return { x: start.x + dx * ease + Math.sin(p * Math.PI) * curve * 32, y: start.y + dy * ease - Math.sin(p * Math.PI) * lift };
      },
      velocityAt(t) {
        const p = clamp(t / d, 0, 1);
        return { x: dx * (6 * p * (1 - p)) / d + Math.cos(p * Math.PI) * curve * Math.PI * 32 / d, y: dy * (6 * p * (1 - p)) / d - Math.cos(p * Math.PI) * Math.PI * lift / d };
      }
    };
  }
  window.PenaltyDuelTrajectory = { create, clamp };
  window.TelePlaySportsEngine ??= {};
  window.TelePlaySportsEngine.Trajectory = { create, clamp };
})();
