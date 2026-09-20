(() => {
  class NeonRaceRenderer {
    constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.dpr=1;this.width=0;this.height=0;this.resize()}
    resize(){this.dpr=Math.min(window.devicePixelRatio||1,2);this.width=window.innerWidth;this.height=window.innerHeight;this.canvas.width=Math.round(this.width*this.dpr);this.canvas.height=Math.round(this.height*this.dpr);this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0)}
    render(drawer){drawer?.(this.ctx,this.width,this.height)}
  }
  window.NeonRaceRenderer=NeonRaceRenderer;
})();
