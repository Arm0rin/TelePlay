import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function fixture(width = 390, height = 844) {
  const nodes = new Map(), frames = new Map(), events = [];
  let nextFrame = 1;
  const node = key => {
    if (!nodes.has(key)) nodes.set(key, {
      textContent: '', hidden: false, style: {}, dataset: {}, disabled: false,
      classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
      querySelector: selector => node(key + selector),
      querySelectorAll: () => Array.from({ length: 5 }, (_,i) => node(key+i))
    });
    return nodes.get(key);
  };
  const sandbox = {
    window: { matchMedia: () => ({matches:false}), TelePlayGameShell: { getStats:()=>({}), saveResult:(_,score)=>({bestScore:score,newRecord:true}), emit: (name,payload) => events.push({name,payload}) } },
    document: { readyState:'loading', addEventListener() {} },
    requestAnimationFrame: fn => { const id=nextFrame++;frames.set(id,fn);return id; },
    cancelAnimationFrame: id => frames.delete(id), setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    performance:{now:()=>0}, Math, console
  };
  const source = readFileSync(new URL('../dist/games/void/game.js',import.meta.url),'utf8')
    .replace('window.VoidGame =', 'window.fixture = {state, CONFIG, resetRun, spawnBody, consumeBody, updateWorld, updateStage, damageFromObstacle, pickSpawnType}; window.VoidGame =');
  vm.runInNewContext(source,sandbox);
  const f=sandbox.window.fixture; f.state.screen={...node('screen'),querySelector:node};f.state.viewport={width,height,dpr:1};
  return {...f,game:sandbox.window.VoidGame,frames,events,nodes};
}

test('Void opens each run with visible targets on narrow and tall screens',()=>{
  for(const [w,h] of [[320,568],[390,844],[720,390]]) {
    const f=fixture(w,h); f.resetRun();
    const visible=f.state.bodies.filter(b=> Math.abs(b.x)*f.state.camera.zoom<w/2 && Math.abs(b.y)*f.state.camera.zoom<h/2);
    assert.ok(visible.length>=8, w+'x'+h+' must have visible targets');
    assert.equal(f.state.health,100); assert.equal(f.CONFIG.stageDuration,80);
  }
});
test('Void healing caps HP, preserves mass and cannot consume the same star twice',()=>{
  const f=fixture();f.resetRun();f.state.health=90;const mass=f.state.mass;
  const star=f.spawnBody('healthStar',true);f.consumeBody(star);
  assert.equal(f.state.health,100);assert.equal(f.state.mass,mass);
  assert.equal(f.events.find(e=>e.name==='void_health_restored').payload.amount,10);
  f.consumeBody(star);assert.equal(f.state.counts.healthStar,1);
});
test('Void stages reset the 80 second deadline and expiration finishes once',()=>{
  const f=fixture();f.resetRun();f.state.running=true;f.state.stageElapsed=79;
  f.state.mass=30;f.updateStage();assert.equal(f.state.stageElapsed,0);
  f.state.stageElapsed=79.99;f.updateWorld(.02);
  assert.equal(f.state.finished,true);assert.equal(f.state.collapseReason,'stage_timeout');
  f.updateWorld(.02);assert.equal(f.events.filter(e=>e.name==='game_finished').length,1);
});
test('Void pause, resume and five restarts keep a single frame loop',()=>{
  const f=fixture();
  for(let i=0;i<5;i++){
    f.game.start(); assert.equal(f.frames.size,1);
    f.game.pause();assert.equal(f.frames.size,0);assert.equal(f.state.paused,true);
    f.game.resume();assert.equal(f.frames.size,1);assert.equal(f.state.paused,false);
    f.state.health=20;
  }
  f.game.start();assert.equal(f.state.health,100);assert.equal(f.state.stageElapsed,0);
  assert.equal(f.nodes.get('[data-void-pause-panel]').hidden,true);
});
test('Void collision invulnerability prevents repeated damage in one impact',()=>{
  const f=fixture();f.resetRun();f.state.running=true;
  f.damageFromObstacle({type:'mine',state:'active',x:0,y:0,radius:15});
  assert.equal(f.state.health,77);
  f.damageFromObstacle({type:'mine',state:'active',x:0,y:0,radius:15});
  assert.equal(f.state.health,77); assert.equal(f.state.obstaclesHit,1);
});
