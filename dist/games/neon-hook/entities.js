(() => {
  const createPlayer = start => ({x:start.x,y:start.y,vx:115,vy:-25,radius:16,skinId:'neon-core'});
  const cloneLevel = level => ({...level, hookPoints:level.hookPoints.map(p=>({...p,active:true})), coins:level.coins.map(c=>({...c,collected:false})), objects:level.objects.map(o=>({...o}))});
  window.NeonHookEntities = {createPlayer,cloneLevel};
})();
