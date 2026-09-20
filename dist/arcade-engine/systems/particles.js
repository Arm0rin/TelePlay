(() => {
  class ArcadeParticles {
    constructor(){this.items=[]}
    spawn(x,y,color,count=12){for(let i=0;i<count;i++)this.items.push({x,y,vx:(Math.random()-.5)*180,vy:(Math.random()-.5)*180,life:.8+Math.random()*.5,size:2+Math.random()*3,color})}
    update(dt){this.items.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=80*dt;p.life-=dt*1.8});this.items=this.items.filter(p=>p.life>0)}
    render(ctx){this.items.forEach(p=>{ctx.save();ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=10;ctx.fillRect(p.x,p.y,p.size,p.size);ctx.restore()})}
    clear(){this.items=[]}
  }
  window.ArcadeParticles=ArcadeParticles;
})();
