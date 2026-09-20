(() => {
  const spikes = [
    [650,'easy'],[980,'easy'],[1320,'easy'],[1580,'good'],[2260,'good'],[2520,'good'],
    [2880,'good'],[3150,'good'],[3720,'hard'],[4050,'hard'],[4380,'hard'],
    [4780,'hard'],[5130,'hard'],[5480,'hard'],[5880,'hard'],[6230,'hard'],[6650,'hard'],[7100,'hard']
  ].map(([x,difficulty]) => ({ type:'spike', x, width:28, height:30, difficulty }));
  const gaps = [
    { type:'gap', x:1870, width:130 },
    { type:'gap', x:3400, width:145 },
    { type:'gap', x:5200, width:160 },
    { type:'gap', x:6900, width:175 }
  ];
  const moving = [
    { type:'moving', x:3650, width:34, height:32, baseY:48, amplitude:36, frequency:2.2 },
    { type:'moving', x:5750, width:36, height:34, baseY:60, amplitude:44, frequency:2.8 }
  ];
  const timing = [
    { type:'timing', x:4580, width:28, height:175, windowMin:56, windowMax:164, pulse:1.8 },
    { type:'timing', x:6440, width:28, height:175, windowMin:64, windowMax:170, pulse:2.1 }
  ];
  const coins = [
    [430,44,'safe'],[760,92,'risk'],[1110,48,'safe'],[1450,105,'risk'],[1760,48,'safe'],[2170,112,'risk'],
    [2400,48,'safe'],[2780,105,'risk'],[3310,45,'safe'],[3560,116,'risk'],[3910,52,'safe'],[4310,112,'risk'],
    [4700,48,'safe'],[5050,118,'risk'],[5440,50,'safe'],[5660,112,'risk'],[6120,48,'safe'],[6550,115,'risk'],
    [6820,50,'safe'],[7290,118,'risk'],[7600,54,'safe']
  ].map(([x,y,risk]) => ({ type:'coin', x, y, risk, collected:false }));
  const GameConfig = {
    id:'beat-dash', width:390, height:844,
    gravity:1300, jumpForce:820, doubleJumpForce:780, maxJumps:2, speed:138, difficulty:1,
    player:{x:112,width:32,height:32,hitRadius:12}, level:{length:7800, ground:0},
    obstacles:[...spikes,...gaps,...moving,...timing], coins,
    colors:{background:'#07091a',ground:'#121934',grid:'#4d5eff',cyan:'#62efff',purple:'#9369ff',pink:'#ff54b7',yellow:'#ffd45b'}
  };
  window.BeatDashConfig = Object.freeze(GameConfig);
})();
