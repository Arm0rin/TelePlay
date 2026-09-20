(() => {
  class NeonHookPhysics {
    constructor(config){this.config=config;this.reset({x:0,y:0,vx:0,vy:0,radius:config.playerRadius})}
    reset(player){this.player={...player};this.hook=null}
    step(dt){
      const steps=Math.max(1,Math.ceil(dt/.008)),subDt=dt/steps;
      for(let i=0;i<steps;i++)this.integrate(subDt);
      return this.player;
    }
    integrate(dt){
      const p=this.player;
      if(this.hook){
        const h=this.hook;
        const acceleration=this.config.gravity*Math.cos(h.angle)/Math.max(70,h.ropeLength);
        const maxSpeed=this.config.maxAngularSpeed||6;
        h.angularVelocity=Math.max(-maxSpeed,Math.min(maxSpeed,(h.angularVelocity+acceleration*dt)*Math.pow(this.config.swingDamping||.992,dt*60)));
        h.angle+=h.angularVelocity*dt;
        p.x=h.point.x+Math.cos(h.angle)*h.ropeLength;
        p.y=h.point.y+Math.sin(h.angle)*h.ropeLength;
        p.vx=-Math.sin(h.angle)*h.ropeLength*h.angularVelocity;
        p.vy=Math.cos(h.angle)*h.ropeLength*h.angularVelocity;
      }else{
        p.vy+=this.config.gravity*dt;
        p.vx*=Math.pow(this.config.airDrag,dt*60);
        p.x+=p.vx*dt;p.y+=p.vy*dt;
      }
    }
    attach(point){
      if(this.hook)return false;
      const p=this.player,dx=p.x-point.x,dy=p.y-point.y,ropeLength=Math.max(72,Math.hypot(dx,dy));
      const rawAngularVelocity=(dx*p.vy-dy*p.vx)/(ropeLength*ropeLength),maxSpeed=this.config.maxAngularSpeed||6;
      this.hook={point,ropeLength,angle:Math.atan2(dy,dx),angularVelocity:Math.max(-maxSpeed,Math.min(maxSpeed,rawAngularVelocity))};
      p.x=point.x+Math.cos(this.hook.angle)*ropeLength;p.y=point.y+Math.sin(this.hook.angle)*ropeLength;
      return true;
    }
    release(){
      if(!this.hook)return null;
      const h=this.hook,p=this.player;
      // A short forward/lift impulse keeps the release readable on mobile:
      // the swing supplies the direction while the assist carries the core
      // into the next hook window instead of dropping it under the anchor.
      const levelSpeed=this.levelSpeed||1;
      p.vx=p.vx*(this.config.releaseBoost||1)+(this.config.releaseImpulse||0)*levelSpeed;
      p.vy=p.vy*(this.config.releaseBoost||1)-(this.config.releaseLift||0)*levelSpeed;
      this.hook=null;
      return {angle:h.angle,velocityX:p.vx,velocityY:p.vy,point:h.point};
    }
  }
  window.NeonHookPhysics=NeonHookPhysics;
})();
