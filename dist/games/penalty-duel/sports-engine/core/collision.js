(() => {
  const circleRect = (circle, rect) => {
    const x = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
    const y = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));
    return Math.hypot(circle.x - x, circle.y - y) <= (circle.radius || 0);
  };
  const inside = (point, rect) => point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
  window.PenaltyDuelCollision = { circleRect, inside };
  window.TelePlaySportsEngine ??= {};
  window.TelePlaySportsEngine.Collision = { circleRect, inside };
})();
