(() => {
  const ArcadeScore={award:(points,multiplier=1)=>Math.max(0,Math.floor(points))*Math.max(1,Math.floor(multiplier)),nextCombo:(current,max=5)=>Math.min(max,Math.max(1,current)+1),resetCombo:()=>1};
  window.ArcadeScore=ArcadeScore;
})();
