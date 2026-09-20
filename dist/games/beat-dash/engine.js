(() => {
  class BeatDashEngine {
    constructor(config, callbacks = {}) {
      this.config = config; this.callbacks = callbacks; this.raf = 0; this.last = 0; this.state = 'idle';
      this.arcadeLoop = new window.ArcadeGameLoop({update:dt=>this.update(dt),onFrame:()=>this.callbacks.onFrame?.(this.snapshot())});
      this.reset();
    }
    reset() {
      this.worldX=0; this.playerY=0; this.velocityY=0; this.elapsed=0; this.score=0; this.bonusScore=0;
      this.distanceMeters=0; this.coins=0; this.nearPerfect=0; this.combo=1; this.maxCombo=1; this.grounded=true;this.jumpsUsed=0;
      this.jumpAction=null; this.effects=[]; this.lastPassedX=-1; this.state='idle';
      this.config.coins.forEach(coin=>{coin.collected=false});
    }
    start() { this.arcadeLoop.stop(); this.reset(); this.state='playing'; this.last=performance.now(); this.callbacks.onStart?.(this.snapshot()); this.arcadeLoop.start(); }
    restart() { this.callbacks.onRestart?.(); this.start(); }
    pause() { if(this.state==='playing'){this.state='paused';this.arcadeLoop.pause();this.callbacks.onPause?.()} }
    resume() { if(this.state==='paused'){this.state='playing';this.arcadeLoop.resume();this.callbacks.onResume?.()} }
    stop() { this.arcadeLoop.stop();this.raf=0;if(this.state==='playing'||this.state==='paused')this.state='idle'; }
    destroy() { this.stop();this.arcadeLoop.destroy();this.callbacks={}; }
    tap() {
      if(this.state!=='playing')return false;
      const isDoubleJump=!this.grounded;
      if(isDoubleJump&&this.jumpsUsed>=this.config.maxJumps)return false;
      this.velocityY=-(isDoubleJump?(this.config.doubleJumpForce||this.config.jumpForce):this.config.jumpForce);
      this.grounded=false;this.jumpsUsed+=1;this.callbacks.onJump?.({doubleJump:isDoubleJump,jumpsUsed:this.jumpsUsed,snapshot:this.snapshot()});
      // worldX is the core's world position. player.x is only its fixed
      // screen offset in the renderer and must not affect physics.
      const playerWorld=this.worldX;
      const next=this.config.obstacles.filter(ob=>ob.x>playerWorld+20).sort((a,b)=>a.x-b.x)[0];
      if(next&&!isDoubleJump){const distance=next.x-playerWorld;this.jumpAction={x:next.x,kind:distance>=82&&distance<=188?'perfect':distance<330?'good':null,awarded:false};}
      return true;
    }
    loop(time) {
      if(this.state!=='playing')return;
      const dt=Math.min(.034,Math.max(0,(time-this.last)/1000||0));this.last=time;this.update(dt);this.callbacks.onFrame?.(this.snapshot());
    }
    update(dt) {
      this.elapsed+=dt;this.worldX+=this.config.speed*this.config.difficulty*dt;
      this.velocityY+=this.config.gravity*dt;this.playerY-=this.velocityY*dt;
      if(this.playerY<=0){this.playerY=0;this.velocityY=0;this.grounded=true;this.jumpsUsed=0}else this.grounded=false;
      this.distanceMeters=Math.floor(this.worldX/10);this.score=this.distanceMeters+this.bonusScore;
      const ground=this.groundAt(this.worldX);
      if(!ground&&this.playerY<16)this.die('gap');
      for(const obstacle of this.config.obstacles){
        const left=obstacle.x-this.worldX,right=left+(obstacle.width||34);
        // `left`/`right` are already relative to the player's screen space.
        // Comparing them with player.x (the player's world offset) made every
        // obstacle collide roughly one player-width before it was drawn.
        const hitRadius=this.config.player.hitRadius||12;
        if(left>hitRadius+34||right<-hitRadius-20)continue;
        const obstacleY=obstacle.type==='moving'?obstacle.baseY+Math.sin(this.elapsed*obstacle.frequency)*obstacle.amplitude:0;
        let collision=false;
        if(obstacle.type==='spike'){
          // A spike is a triangle, not a rectangle. Its hit area narrows at
          // both edges, so the core no longer snags on an invisible square.
          const coreAtSpike=Math.max(0,Math.min(obstacle.width,-left));
          const spikeHeight=(1-Math.abs(coreAtSpike/(obstacle.width/2)-1))*obstacle.height;
          collision=right>-hitRadius&&left<hitRadius&&this.playerY-hitRadius<spikeHeight-2;
        }
        if(obstacle.type==='gap')collision=!ground&&this.playerY<18;
        if(obstacle.type==='moving')collision=right>-hitRadius&&left<hitRadius&&this.playerY-hitRadius<obstacleY+obstacle.height&&this.playerY+hitRadius>obstacleY;
        if(obstacle.type==='timing')collision=this.playerY<obstacle.windowMin+hitRadius||this.playerY>obstacle.windowMax-hitRadius;
        if(collision){this.die(obstacle.type);return}
        if(this.jumpAction&&!this.jumpAction.awarded&&obstacle.x===this.jumpAction.x&&this.worldX>obstacle.x+obstacle.width){
          this.jumpAction.awarded=true;if(this.jumpAction.kind)this.successfulJump(this.jumpAction.kind);
        }
      }
      for(const coin of this.config.coins){
        const playerWorld=this.worldX;
        if(coin.collected||coin.x<playerWorld-45||coin.x>playerWorld+80)continue;
        // Keep pickup aligned with the visible core instead of collecting
        // while the coin is still noticeably ahead of it.
        if(Math.abs(coin.x-playerWorld)<22&&Math.abs(this.playerY+16-coin.y)<28){coin.collected=true;this.coins+=coin.risk==='risk'?2:1;this.bonusScore+=window.ArcadeScore.award(coin.risk==='risk'?18:8,1);this.callbacks.onCoin?.(coin,this.snapshot());}
      }
      if(this.worldX>=this.config.level.length)this.finish();
    }
    groundAt(x){return !this.config.obstacles.some(ob=>ob.type==='gap'&&x>ob.x-8&&x<ob.x+ob.width+8)}
    successfulJump(kind){const points=kind==='perfect'?25:10;this.bonusScore+=window.ArcadeScore.award(points,this.combo);this.combo=window.ArcadeScore.nextCombo(this.combo,4);this.maxCombo=Math.max(this.maxCombo,this.combo);if(kind==='perfect')this.nearPerfect++;this.callbacks.onJumpSuccess?.({kind,points,combo:this.combo,snapshot:this.snapshot()});}
    die(reason){if(this.state!=='playing')return;this.state='dead';this.arcadeLoop.stop();this.raf=0;this.combo=window.ArcadeScore.resetCombo();this.callbacks.onDeath?.({reason,snapshot:this.snapshot()})}
    finish(){if(this.state!=='playing')return;this.state='finished';this.arcadeLoop.stop();this.raf=0;this.callbacks.onFinish?.(this.snapshot())}
    snapshot(){return {state:this.state,worldX:this.worldX,playerY:this.playerY,velocityY:this.velocityY,elapsed:this.elapsed,score:this.score,distanceMeters:this.distanceMeters,progress:Math.min(100,this.worldX/this.config.level.length*100),coins:this.coins,combo:this.combo,maxCombo:this.maxCombo,grounded:this.grounded,jumpsUsed:this.jumpsUsed,jumpsLeft:this.config.maxJumps-this.jumpsUsed,effects:this.effects}}
  }
  window.BeatDashEngine=BeatDashEngine;
})();
