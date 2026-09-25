(() => {
  'use strict';
  const TAU = Math.PI * 2;
  let sky, skyKey;
  const noise = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const circle = (c, x, y, r) => { c.beginPath(); c.arc(x, y, Math.max(.01, r), 0, TAU); };
  function glow(c, x, y, r, color, alpha = 1) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, 'transparent');
    c.save(); c.globalAlpha *= alpha; c.fillStyle = g; c.fillRect(x-r, y-r, r*2, r*2); c.restore();
  }
  function background(c, s, t = s.elapsed) {
    const { width: w, height: h } = s.viewport;
    const key = [w, h, s.stageIndex].join(':');
    if (key !== skyKey) {
      skyKey = key; sky = document.createElement('canvas'); sky.width = Math.ceil(w); sky.height = Math.ceil(h);
      const b = sky.getContext('2d'); b.fillStyle = '#05080e'; b.fillRect(0, 0, w, h);
      // Nebula is rasterized once per viewport / stage, never blurred every frame.
      for (let i = 0; i < 25; i++) {
        const x = w * (.1 + noise(i+1) * .9), y = h * (.2 + noise(i+23) * .65);
        glow(b, x, y, Math.max(w,h) * (.12 + noise(i+43)*.2),
          i % 3 === 0 ? (s.stageIndex >= 3 ? '#713a3035' : '#49407729') : '#16495925');
      }
      for (let i = 0; i < 220; i++) {
        const x = noise(i+101)*w, y = noise(i+809)*h, r = .25 + noise(i+600)*.8;
        b.fillStyle = i%5 === 0 ? '#dabfa057' : '#b3d7df55'; circle(b,x,y,r); b.fill();
      }
      const v = b.createRadialGradient(w*.5,h*.48, w*.1,w*.5,h*.48,Math.max(w,h)*.76);
      v.addColorStop(0,'transparent'); v.addColorStop(1,'#020408cf'); b.fillStyle=v; b.fillRect(0,0,w,h);
    }
    c.drawImage(sky,0,0,w,h);
    s.stars.forEach((star,i) => {
      const x=((star.x-s.camera.x*.06)%(w+40)+w+40)%(w+40)-20;
      const y=((star.y-s.camera.y*.06)%(h+40)+h+40)%(h+40)-20;
      const a=star.alpha*(.55+Math.sin(t*.65+star.twinkle)*.18);
      c.fillStyle=i%4===0 ? '#fce0b1' : '#d7edf7'; c.globalAlpha=a;
      circle(c,x,y,star.size*.62); c.fill();
      if(i%19===0) { c.strokeStyle='#b8dce8'; c.lineWidth=.5; c.beginPath(); c.moveTo(x-3,y);c.lineTo(x+3,y);c.moveTo(x,y-3);c.lineTo(x,y+3);c.stroke(); }
    });
    c.globalAlpha=1;
  }
  function singularity(c, x, y, r, t, energy = 0, heal = 0) {
    c.save(); c.translate(x,y); c.rotate(-.27);
    glow(c,0,0,r*4.7, heal > 0 ? '#75ff9a30' : '#b6692725');
    glow(c,0,0,r*2.1,'#ffb76638');
    c.save(); c.scale(1,.26); glow(c,0,0,r*3.4,'#f4ae4d42'); c.restore();
    // Lensed back half, then event horizon, then the foreground accretion disk.
    for(let i=0;i<20;i++) {
      const rr=r*(1.1+i*.017);
      c.strokeStyle=i%3===0 ? '#ffe4b0' : '#ec984f';
      c.globalAlpha=(.07+(20-i)*.023)*(1+energy*.35);
      c.lineWidth=i<5 ? 1.6 : .9;
      c.beginPath();c.ellipse(0,-r*.08,rr,rr*.88,0,Math.PI,TAU);c.stroke();
    }
    c.globalAlpha=1;
    const rim=c.createRadialGradient(-r*.18,-r*.15,r*.72,0,0,r*1.13);
    rim.addColorStop(0,'#010204');rim.addColorStop(.83,'#010204');rim.addColorStop(.94,'#ffd69b');rim.addColorStop(1,'#7a442d');
    c.fillStyle=rim;circle(c,0,0,r*1.13);c.fill();
    for(let i=0;i<44;i++) {
      const rr=r*(1.25+i*.029), phase=i*2.39996+t*(.15+i*.012);
      c.globalAlpha=.1+noise(i+7)*.4;
      c.strokeStyle=i%4===0?'#fff0c9':i%3===0?'#b6a0cf':'#eea15a';
      c.lineWidth=.8+noise(i+20)*1.25;
      c.beginPath();c.ellipse(0,0,rr,rr*.29,0,phase,phase+Math.PI*(.7+noise(i+80)*.8));c.stroke();
    }
    c.globalAlpha=.78;c.strokeStyle='#ffe5b4';c.lineWidth=Math.max(.8,r*.025);
    c.beginPath();c.ellipse(0,0,r*1.45,r*.41,0,0,Math.PI);c.stroke();
    c.globalCompositeOperation='lighter';
    for(let i=0;i<38;i++) {
      const angle=t*(.25+noise(i+200)*.3)+i*2.39996, orbit=r*(1.45+noise(i+500)*1.5);
      c.globalAlpha=.2+noise(i+700)*.65;c.fillStyle=i%3===0?'#dcceff':'#ffcc87';
      circle(c,Math.cos(angle)*orbit,Math.sin(angle)*orbit*.3,.4+noise(i+400)*Math.min(1.5,r*.035));c.fill();
    }
    c.restore();
  }
  function body(c, s, spec, b, p, capturable) {
    const r=b.radius*s.camera.zoom, devour=b.state==='devouring'?Math.min(1,b.devourProgress):0;
    if(p.x < -r*5 || p.x>s.viewport.width+r*5 || p.y < -r*5 || p.y>s.viewport.height+r*5)return;
    c.save(); c.translate(p.x,p.y);
    if(b.type==='dust') {
      glow(c,0,0,r*4,'#9bdfff50');c.fillStyle='#d1edee';circle(c,0,0,r*.7);c.fill();c.restore();return;
    }
    const health=b.type==='healthStar', star=b.type==='star';
    glow(c,0,0,r*(health?3.3:star?2.8:1.65),health?'#57ff7655':star?'#ffb63a66':spec.glow+'27');
    if(health) {
      c.rotate(Math.sin(s.elapsed*.9+b.seed)*.16);
      const pulse=1+Math.sin(s.elapsed*3+b.seed)*.07;
      c.fillStyle='#a5ff7c';c.strokeStyle='#edffd1';c.lineWidth=1.2;c.beginPath();
      for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,rr=r*(i%2?.46:1.14)*pulse;i?c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):c.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);}
      c.closePath();c.fill();c.stroke();
      c.strokeStyle='#164e2b';c.lineWidth=2;c.beginPath();c.moveTo(-r*.26,0);c.lineTo(r*.26,0);c.moveTo(0,-r*.26);c.lineTo(0,r*.26);c.stroke();
      c.restore();return;
    }
    if(b.type==='comet') {
      c.rotate(Math.atan2(b.vy,b.vx));
      const g=c.createLinearGradient(-r*7,0,r,0);g.addColorStop(0,'transparent');g.addColorStop(1,'#9be9ffaa');
      c.fillStyle=g;c.beginPath();c.moveTo(-r*7,0);c.quadraticCurveTo(-r,-r*1.4,r,0);c.quadraticCurveTo(-r,r*1.4,-r*7,0);c.fill();
      c.fillStyle='#e0fcff';circle(c,0,0,r*.8);c.fill();c.restore();return;
    }
    c.rotate(b.rotation*.25);
    if(devour) c.scale(1+devour*.5,1-devour*.45);
    if(b.type==='gasGiant'){
      c.save();c.rotate(-.4);c.strokeStyle='#e3c5a463';c.lineWidth=r*.19;c.beginPath();c.ellipse(0,0,r*1.8,r*.47,0,0,TAU);c.stroke();c.restore();
    }
    const g=c.createRadialGradient(-r*.4,-r*.43,r*.02,r*.15,r*.18,r*1.3);
    g.addColorStop(0,star?'#fff6cf':'#dae6e6');g.addColorStop(.24,spec.color);g.addColorStop(.73,star?'#e17a32':'#233344');g.addColorStop(1,'#060b14');
    c.fillStyle=g;c.beginPath();
    const rock=b.type==='asteroid'||b.type==='largeAsteroid';
    if(rock) {
      for(let i=0;i<10;i++){const a=i/10*TAU,rr=r*(.79+noise(b.seed+i)*.25);i?c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):c.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);}c.closePath();
    }else c.arc(0,0,r,0,TAU);
    c.fill();c.save();c.clip();
    for(let i=0;i<(star?12:7);i++){
      c.fillStyle=i%2?'#060e193d':'#def1e51e';
      const x=(noise(b.seed+i+21)-.5)*r*1.6,y=(noise(b.seed+i+71)-.5)*r*1.6;
      c.beginPath();c.ellipse(x,y,r*(.06+noise(i+b.seed)*.17),r*(b.type==='gasGiant'?.06:.12),.25,0,TAU);c.fill();
    }
    if(b.type==='gasGiant') {
      c.strokeStyle='#ffe7c02c';c.lineWidth=r*.09;
      for(let i=-3;i<=3;i++){c.beginPath();c.ellipse(0,i*r*.25,r*1.15,r*.12,.1,0,TAU);c.stroke();}
    }
    c.restore();
    c.strokeStyle=star?'#ffd78988':spec.glow+'80';c.lineWidth=.8;c.beginPath();c.arc(0,0,r*.99,-Math.PI*.93,-Math.PI*.12);c.stroke();
    if(!capturable){c.strokeStyle='#e9b98b70';c.lineWidth=.7;c.setLineDash([2,5]);circle(c,0,0,r+5);c.stroke();}
    c.restore();
  }
  function obstacle(c,s,spec,b,p) {
    const r=b.radius*s.camera.zoom;
    if(p.x < -80 || p.x>s.viewport.width+80 || p.y < -80 || p.y>s.viewport.height+80)return;
    c.save();c.translate(p.x,p.y);glow(c,0,0,r*3,'#ff45662c');c.rotate(b.rotation);
    c.strokeStyle='#ff7386';c.fillStyle='#301a2b';c.lineWidth=1.4;
    const sides=b.type==='shard'?3:b.type==='mine'?6:4;
    c.beginPath();for(let i=0;i<sides;i++){const a=i/sides*TAU-Math.PI/2;i?c.lineTo(Math.cos(a)*r,Math.sin(a)*r):c.moveTo(Math.cos(a)*r,Math.sin(a)*r);}c.closePath();c.fill();c.stroke();
    c.fillStyle='#ff8f99';circle(c,0,0,r*.18);c.fill();
    c.strokeStyle='#ff596860';c.lineWidth=.8;
    for(let i=0;i<sides;i++){const a=i/sides*TAU-Math.PI/2;c.beginPath();c.moveTo(Math.cos(a)*r*1.25,Math.sin(a)*r*1.25);c.lineTo(Math.cos(a)*r*1.65,Math.sin(a)*r*1.65);c.stroke();}
    c.restore();
    c.fillStyle='#ff8794';c.font='600 8px system-ui';c.textAlign='center';c.fillText('−'+Math.round(spec.damage*(1+s.stageIndex*.12)),p.x,p.y+r*2.6);
  }
  window.VoidArt = { background, singularity, body, obstacle, glow };
})();
