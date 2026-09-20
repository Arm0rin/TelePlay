/* SportsBallPhysics keeps the ball state independent from rendering and UI. */
(() => {
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  class SportsBallPhysics {
    constructor(config = {}) { this.config = config; this.reset(); }
    reset() {
      this.state = 'ready';
      this.position = { x: 0, y: 0, z: 0 };
      this.velocity = { x: 0, y: 0, z: 0 };
      this.direction = { x: 0, y: 1 };
      this.power = 0; this.curve = 0; this.spin = 0; this.height = 0; this.elapsed = 0; this.duration = 1; this.bounds = null; this.deflectDirection = { x: 0, y: -1 };
    }
    setBounds(bounds) { this.bounds = bounds || null; return this; }
    kick(shot = {}) {
      const requestedTarget = shot.target || { x: 0, y: 0 };
      const target = this.bounds ? { x: clamp(requestedTarget.x, this.bounds.minX, this.bounds.maxX), y: clamp(requestedTarget.y, this.bounds.minY, this.bounds.maxY) } : requestedTarget;
      const start = shot.start || { x: 0, y: 0 };
      this.position = { x: start.x, y: start.y, z: 0 };
      this.direction = shot.direction || { x: 0, y: 1 };
      this.power = clamp(Number(shot.power || 0), 0, 1);
      this.curve = clamp(Number(shot.curve || 0), -1, 1);
      this.spin = clamp(Number(shot.spin || this.curve), -1, 1);
      this.height = clamp(Number(shot.height ?? .5), 0, 1);
      this.elapsed = 0;
      this.duration = clamp((this.config.shotDuration || 1.05) * (.86 + this.power * .2), .62, 1.38);
      const dx = target.x - start.x, dy = target.y - start.y, d = Math.max(.1, this.duration);
      this.velocity = { x: dx / d, y: dy / d, z: 145 + this.height * 185 + this.power * 70 };
      this.target = target; this.state = 'flying';
      return this.snapshot();
    }
    deflect({ x = this.position.x, y = this.position.y, direction = 'left' } = {}) {
      this.position = { x, y, z: 28 };
      this.velocity = { x: direction === 'right' ? 175 : direction === 'left' ? -175 : 0, y: -115, z: 220 };
      this.deflectDirection = { x: this.velocity.x, y: this.velocity.y };
      this.elapsed = 0; this.duration = .48; this.state = 'deflected';
      return this.snapshot();
    }
    step(dt) {
      if (this.state !== 'flying' && this.state !== 'deflected') return { done: this.state === 'landed', snapshot: this.snapshot() };
      const safeDt = Math.min(.035, Math.max(1 / 240, Number(dt) || 1 / 60));
      this.elapsed += safeDt;
      this.velocity.z -= (this.state === 'deflected' ? (this.config.gravity || 780) * .45 : (this.config.gravity || 780)) * safeDt;
      this.position.x += this.velocity.x * safeDt + this.spin * Math.sin(this.elapsed * 8) * safeDt * 22;
      this.position.y += this.velocity.y * safeDt;
      this.position.z = Math.max(0, this.position.z + this.velocity.z * safeDt);
      if (this.bounds) { this.position.x = clamp(this.position.x, this.bounds.minX, this.bounds.maxX); this.position.y = clamp(this.position.y, this.bounds.minY, this.bounds.maxY); }
      const done = this.elapsed >= this.duration;
      if (done) { const wasFlight = this.state === 'flying'; this.state = 'landed'; if (wasFlight) { this.position.x = this.target?.x ?? this.position.x; this.position.y = this.target?.y ?? this.position.y; } }
      return { done, snapshot: this.snapshot() };
    }
    snapshot() { return { state: this.state, position: { ...this.position }, velocity: { ...this.velocity }, direction: { ...this.direction }, power: this.power, curve: this.curve, spin: this.spin, height: this.height, elapsed: this.elapsed, duration: this.duration }; }
  }
  window.PenaltyDuelSportsPhysics = SportsBallPhysics;
  window.TelePlaySportsEngine ??= {};
  window.TelePlaySportsEngine.Physics = SportsBallPhysics;
})();
