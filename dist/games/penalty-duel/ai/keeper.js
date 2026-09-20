(() => {
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const zones = () => window.PenaltyDuelConfig.zones;
  const zoneIndex = id => (zones().findIndex(z => z.id === id) + 1) || 5;
  const directionFor = zone => ['left', 'center', 'right'][zone?.col ?? 1] || 'center';
  const rowFor = zone => zone?.row === 0 ? 'top' : zone?.row === 2 ? 'bottom' : 'mid';
  const directionIndex = direction => ({ left: 0, center: 1, right: 2 }[direction] ?? 1);
  const otherDirection = (target, roll) => ['left', 'center', 'right'][(directionIndex(target) + (roll < .5 ? 1 : 2)) % 3];

  class KeeperAI {
    constructor(difficulty = 'medium', type) { this.history = []; this.pendingDecision = null; this.fakeDirection = 'center'; this.setDifficulty(difficulty, type); }
    setDifficulty(difficulty = 'medium', type) {
      const preset = window.PenaltyDuelConfig.difficulties[difficulty] || window.PenaltyDuelConfig.difficulties.medium;
      this.difficulty = difficulty; this.type = type || preset.type; this.skill = preset.skill; this.reaction = preset.reaction; this.fakeChance = preset.fakeChance;
      this.diveAccuracy = preset.diveAccuracy ?? .62; this.reach = preset.reach || { top: .55, mid: .74, bottom: .64 };
    }
    observe(shot) { if (shot?.zoneId) this.history.push(shot.zoneId); if (this.history.length > 8) this.history.shift(); }
    _predictZone(zone) {
      const counts = {};
      this.history.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
      const frequent = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      if (frequent && counts[frequent] > 1 && this.skill > .5) return zones().find(z => z.id === frequent) || zone;
      const idx = zoneIndex(zone?.id) + Math.round((this.skill - .5) * 2);
      return zones()[(idx + 9) % 9] || zone || zones()[4];
    }
    _roll(seed, turn) { return ((turn * seed + this.history.length * 19 + seed * 3) % 100) / 100; }
    _makeDecision(zone, shot, turn = this.history.length) {
      const actualDirection = directionFor(zone), predictedZone = this._predictZone(zone), predictedDirection = directionFor(predictedZone);
      const readRoll = this._roll(37, turn) + Math.abs(shot?.curve || 0) * .04;
      const readsShot = readRoll % 1 < this.diveAccuracy;
      const wrong = otherDirection(actualDirection, this._roll(17, turn));
      // The keeper commits before the ball is released. A read sends him to
      // the ball's column; a miss follows his history-based prediction or a
      // deterministic wrong lane.
      const direction = readsShot ? actualDirection : (predictedDirection === actualDirection ? wrong : predictedDirection);
      return { zoneId: zone?.id, targetDirection: actualDirection, predictedZone: predictedZone?.id, predictedDirection, direction, readsShot, readRoll };
    }
    mindMove(shot, turn = this.history.length) {
      const zone = shot?.zone || zones()[4];
      const decision = this._makeDecision(zone, shot, turn);
      const fakeRoll = this._roll(23, turn);
      const fake = fakeRoll < this.fakeChance;
      this.pendingDecision = decision;
      this.fakeDirection = fake ? otherDirection(decision.direction, fakeRoll) : decision.direction;
      return { direction: decision.direction, displayDirection: this.fakeDirection, fake, type: this.type, predictedZone: decision.predictedZone };
    }
    resolve({ zone, shot, training = false } = {}) {
      const turn = this.history.length;
      const decision = this.pendingDecision?.zoneId === zone?.id ? this.pendingDecision : this._makeDecision(zone, shot, turn);
      const targetDirection = directionFor(zone), row = rowFor(zone), intersects = decision.direction === targetDirection;
      const reachChance = clamp(this.reach[row] + (zone?.difficulty - .5) * .04 - (shot?.power || 0) * .04 - Math.abs(shot?.curve || 0) * .025, .2, .95);
      const reachRoll = this._roll(53, turn) + zoneIndex(zone?.id) * .007;
      const saved = !training && intersects && reachRoll % 1 < reachChance;
      this.observe(shot); this.pendingDecision = null;
      return { saved, direction: decision.direction, targetDirection, predictedZone: decision.predictedZone, intersects, reachChance, reachRoll, type: this.type, timing: saved ? 'hands' : intersects ? 'late' : 'wrong_lane' };
    }
    getCoverage(direction) { return zones().filter(zone => directionFor(zone) === direction).map(zone => zone.id); }
  }
  window.PenaltyDuelKeeperAI = KeeperAI;
})();
