(() => {
  class PenaltyScore {
    constructor() { this.reset(); }
    reset() { this.score = 0; this.combo = 1; this.maxCombo = 1; }
    awardShot({ goal = false, perfect = false, corner = false, power = false, multiplier = 1 } = {}) {
      if (!goal) { this.combo = 1; return { points: 0, combo: this.combo, score: this.score }; }
      let base = 100;
      if (perfect) base += 50;
      if (corner) base += 75;
      if (power) base += 25;
      const points = Math.round(base * multiplier * this.combo);
      this.score += points; this.combo = Math.min(5, this.combo + 1); this.maxCombo = Math.max(this.maxCombo, this.combo);
      return { points, combo: this.combo, score: this.score };
    }
  }
  window.PenaltyDuelScore = PenaltyScore;
  window.TelePlaySportsEngine ??= {};
  window.TelePlaySportsEngine.Score = PenaltyScore;
})();
