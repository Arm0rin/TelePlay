(() => {
  const distance=(ax,ay,bx,by)=>Math.hypot(ax-bx,ay-by);
  const circleRect=(cx,cy,r,rect)=>{const x=Math.max(rect.x,Math.min(cx,rect.x+rect.width));const y=Math.max(rect.y,Math.min(cy,rect.y+rect.height));return distance(cx,cy,x,y)<r};
  const normalizeAngle=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));
  window.ArcadeCollision={distance,circleRect,normalizeAngle};
})();
