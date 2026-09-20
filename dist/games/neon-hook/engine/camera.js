(() => {
  class NeonHookCamera extends window.ArcadeCamera {
    constructor(){super({anchorX:110,anchorY:300,lookAhead:.22})}
  }
  window.NeonHookCamera=NeonHookCamera;
})();
