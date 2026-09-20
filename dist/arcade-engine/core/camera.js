(() => {
  class ArcadeCamera {
    constructor({anchorX=110,anchorY=300,lookAhead=.22}={}){this.anchorX=anchorX;this.anchorY=anchorY;this.lookAhead=lookAhead;this.x=0;this.y=0;this.zoom=1;this.shake=0}
    reset(target){this.x=target.x-this.anchorX;this.y=target.y-this.anchorY;this.zoom=1;this.shake=0}
    update(target,dt){const targetX=target.x-this.anchorX+Math.max(0,target.vx||0)*this.lookAhead;const targetY=target.y-this.anchorY;const ease=1-Math.pow(.0008,Math.min(dt,.034));this.x+=(targetX-this.x)*ease;this.y+=(targetY-this.y)*ease;const targetZoom=1+Math.min(.07,Math.abs(target.vx||0)/2200);this.zoom+=(targetZoom-this.zoom)*Math.min(1,dt*5);if(this.shake>0)this.shake*=.88}
    kick(amount=8){this.shake=Math.max(this.shake,amount)}
    snapshot(){return {x:this.x,y:this.y,zoom:this.zoom,shake:this.shake,anchorX:this.anchorX,anchorY:this.anchorY}}
  }
  window.ArcadeCamera=ArcadeCamera;
})();
