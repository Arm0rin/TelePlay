(() => {
  const config = () => window.PenaltyDuelConfig;
  function goalRect(width, height) {
    const g = config().goal;
    return { x: width * g.x, y: height * g.y, width: width * g.width, height: height * g.height };
  }
  function zones(width, height) {
    const rect = goalRect(width, height), pad = 3, cw = rect.width / 3, ch = rect.height / 3;
    return config().zones.map(z => ({ ...z, rect: { x: rect.x + z.col * cw + pad, y: rect.y + z.row * ch + pad, width: cw - pad * 2, height: ch - pad * 2 }, center: { x: rect.x + (z.col + .5) * cw, y: rect.y + (z.row + .5) * ch } }));
  }
  function zoneAt(x, y, width, height) {
    const all = zones(width, height), hit = all.find(z => x >= z.rect.x && x <= z.rect.x + z.rect.width && y >= z.rect.y && y <= z.rect.y + z.rect.height);
    return hit || all[4];
  }
  function get(id, width, height) { return zones(width, height).find(z => z.id === id) || zones(width, height)[4]; }
  function isCorner(zone) { return ['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(zone?.id); }
  window.PenaltyDuelGoalSystem = { goalRect, zones, zoneAt, get, isCorner };
})();
