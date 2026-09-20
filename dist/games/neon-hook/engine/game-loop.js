(() => {
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  class NeonHookEngine {
    constructor(config,callbacks={}){this.config=config;this.callbacks=callbacks;this.raf=0;this.last=0;this.levelIndex=0;this.state='idle';this.arcadeLoop=new window.ArcadeGameLoop({update:dt=>this.update(dt),onFrame:()=>this.callbacks.onFrame?.(this.snapshot())});this.reset(0)}
    reset(levelIndex=this.levelIndex){
      this.levelIndex=clamp(levelIndex,0,this.config.levels.length-1);this.level=window.NeonHookEntities.cloneLevel(this.config.levels[this.levelIndex]);
      this.player=window.NeonHookEntities.createPlayer(this.level.start);this.physics=new window.NeonHookPhysics(this.config);this.physics.levelSpeed=this.level.speed||1;this.physics.reset(this.player);this.camera=new window.NeonHookCamera();this.camera.reset(this.player);
      this.state='idle';this.elapsed=0;this.distance=0;this.score=0;this.bonusScore=0;this.coins=0;this.hooks=0;this.perfectReleases=0;this.combo=1;this.maxCombo=1;this.trail=[];this.lastHookId=null;
    }
    start(levelIndex=this.levelIndex){this.arcadeLoop.stop();this.stop();this.reset(levelIndex);this.state='playing';this.last=performance.now();this.callbacks.onStart?.(this.snapshot());this.arcadeLoop.start()}
    restart(){this.callbacks.onRestart?.();this.start(this.levelIndex)}
    pause(){if(this.state==='playing'){this.state='paused';this.arcadeLoop.pause();this.callbacks.onPause?.()}}
    resume(){if(this.state==='paused'){this.state='playing';this.arcadeLoop.resume();this.callbacks.onResume?.()}}
    stop(){this.arcadeLoop.stop();this.raf=0;if(this.state==='playing'||this.state==='paused')this.state='idle'}
    destroy(){this.stop();this.arcadeLoop.destroy();this.callbacks={}}
    findHook(){
      let best=null,bestDistance=Infinity;
      this.level.hookPoints.forEach(point=>{if(!point.active)return;const d=window.NeonHookCollision.distance(this.player.x,this.player.y,point.x,point.y);if(d<=this.config.attachRadius&&point.x>this.player.x-120&&d<bestDistance){best=point;bestDistance=d}});
      return best;
    }
    pointerDown(){
      if(this.state!=='playing'||this.physics.hook)return false;
      const point=this.findHook();if(!point)return false;
      this.physics.attach(point);this.hooks+=1;this.bonusScore+=window.ArcadeScore.award(10,this.combo);this.lastHookId=point.id;this.callbacks.onHook?.({point,snapshot:this.snapshot()});return true;
    }
    pointerUp(){
      if(this.state!=='playing'||!this.physics.hook)return false;
      const release=this.physics.release();release.point.active=false;const perfect=Math.abs(window.NeonHookCollision.normalizeAngle(release.angle-Math.PI/2))<.6&&release.velocityX>75;
      if(perfect){const points=50;this.bonusScore+=window.ArcadeScore.award(points,this.combo);this.perfectReleases+=1;this.combo=window.ArcadeScore.nextCombo(this.combo,5);this.maxCombo=Math.max(this.maxCombo,this.combo);this.callbacks.onPerfectRelease?.({points:points*this.combo,release,snapshot:this.snapshot()})}
      else this.callbacks.onRelease?.({release,snapshot:this.snapshot()});
      return true;
    }
    update(dt){
      this.elapsed+=dt;this.physics.step(dt);this.player=this.physics.player;this.distance=Math.max(0,this.player.x-this.level.start.x);this.score=Math.floor(this.distance)+this.bonusScore;this.camera.update(this.player,dt);
      this.trail.push({x:this.player.x,y:this.player.y});if(this.trail.length>22)this.trail.shift();
      for(const coin of this.level.coins){if(!coin.collected&&window.NeonHookCollision.distance(this.player.x,this.player.y,coin.x,coin.y)<this.player.radius+coin.radius+8){coin.collected=true;this.coins+=coin.risk==='risk'?2:1;this.bonusScore+=window.ArcadeScore.award(coin.risk==='risk'?20:8,this.combo);this.callbacks.onCoin?.({coin,snapshot:this.snapshot()})}}
      for(const object of this.level.objects){if(window.NeonHookCollision.circleRect(this.player.x,this.player.y,this.player.radius,object)){this.die('obstacle');return}}
      if(this.player.x<this.level.bounds.left||this.player.y<this.level.bounds.top||this.player.y>this.level.bounds.bottom||this.player.x>this.level.bounds.right){this.die('boundary');return}
      const finishDistance=window.NeonHookCollision.distance(this.player.x,this.player.y,this.level.finish.x,this.level.finish.y);
      if(finishDistance<=Math.max(8,this.level.finish.radius-this.player.radius)){this.finish();return}
    }
    die(reason){if(this.state!=='playing')return;this.state='dead';this.arcadeLoop.stop();this.raf=0;this.combo=window.ArcadeScore.resetCombo();this.camera.kick(12);this.callbacks.onDeath?.({reason,snapshot:this.snapshot()})}
    finish(){if(this.state!=='playing')return;this.state='finished';this.arcadeLoop.stop();this.raf=0;this.callbacks.onFinish?.(this.snapshot())}
    snapshot(){const start=this.level.start.x,finish=this.level.finish.x,rawProgress=this.distance/Math.max(1,finish-start)*100;return {state:this.state,levelIndex:this.levelIndex,levelId:this.level.id,player:{...this.player},hook:this.physics.hook?{point:{...this.physics.hook.point},angle:this.physics.hook.angle,ropeLength:this.physics.hook.ropeLength}:null,camera:this.camera.snapshot(),trail:this.trail.slice(),score:this.score,distance:Math.floor(this.distance),progress:this.state==='finished'?100:clamp(rawProgress,0,99),coins:this.coins,hooks:this.hooks,perfectReleases:this.perfectReleases,combo:this.combo,maxCombo:this.maxCombo,elapsed:this.elapsed}}
  }
  window.NeonHookEngine=NeonHookEngine;
})();
