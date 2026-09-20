(() => {
  class ArcadeGameLoop {
    constructor({update,onFrame}={}){this.update=update||(()=>{});this.onFrame=onFrame||(()=>{});this.raf=0;this.last=0;this.running=false;this.paused=false}
    start(){this.stop();this.running=true;this.paused=false;this.last=performance.now();this.raf=requestAnimationFrame(this.tick.bind(this))}
    tick(now){if(!this.running||this.paused)return;const dt=Math.min(.034,Math.max(0,(now-this.last)/1000||0));this.last=now;this.update(dt);this.onFrame(dt);if(this.running&&!this.paused)this.raf=requestAnimationFrame(this.tick.bind(this))}
    pause(){if(!this.running)return;this.paused=true;if(this.raf)cancelAnimationFrame(this.raf);this.raf=0}
    resume(){if(!this.running||!this.paused)return;this.paused=false;this.last=performance.now();this.raf=requestAnimationFrame(this.tick.bind(this))}
    stop(){if(this.raf)cancelAnimationFrame(this.raf);this.raf=0;this.running=false;this.paused=false}
    destroy(){this.stop();this.update=()=>{};this.onFrame=()=>{}}
  }
  window.ArcadeGameLoop=ArcadeGameLoop;
})();
