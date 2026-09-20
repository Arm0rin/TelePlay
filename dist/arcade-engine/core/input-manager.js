(() => {
  class ArcadeInputManager {
    constructor(target,handlers={}){this.target=target;this.handlers=handlers;this.enabled=true;this.onDown=this.handle('onDown');this.onUp=this.handle('onUp');this.onCancel=this.handle('onCancel');target.addEventListener('pointerdown',this.onDown,{passive:false});target.addEventListener('pointerup',this.onUp,{passive:false});target.addEventListener('pointercancel',this.onCancel,{passive:false})}
    handle(name){return event=>{if(!this.enabled)return;const handled=this.handlers[name]?.(event);if(handled){event.preventDefault();try{if(name==='onDown')this.target.setPointerCapture?.(event.pointerId);if(name!=='onDown')this.target.releasePointerCapture?.(event.pointerId)}catch(_){}}}}
    setEnabled(value){this.enabled=Boolean(value)}
    destroy(){this.target.removeEventListener('pointerdown',this.onDown);this.target.removeEventListener('pointerup',this.onUp);this.target.removeEventListener('pointercancel',this.onCancel);this.enabled=false}
  }
  window.ArcadeInputManager=ArcadeInputManager;
})();
