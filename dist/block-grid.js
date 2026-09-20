(() => {
  const GAME_ID = 'block-grid', SIZE = 8;
  const SHAPES = [
    [[0,0]], [[0,0],[1,0]], [[0,0],[1,0],[2,0]], [[0,0],[0,1]], [[0,0],[0,1],[0,2]],
    [[0,0],[1,0],[0,1]], [[0,0],[1,0],[1,1]], [[0,0],[0,1],[1,1]], [[1,0],[0,1],[1,1]],
    [[0,0],[1,0],[0,1],[1,1]], [[0,0],[1,0],[2,0],[1,1]], [[0,0],[1,0],[2,0],[3,0]],
    [[0,0],[0,1],[0,2],[0,3]], [[0,0],[1,0],[2,0],[2,1]], [[0,0],[0,1],[1,1],[2,1]]
  ];
  const colors = ['violet','cyan','blue','pink'];
  let screen, boardEl, trayEl, scoreEl, comboEl, startLayer, resultLayer;
  let board, pieces, score, streak, bestCombo, linesCleared, playing, callbacks = {}, drag = null, clearing = false, runToken = 0;
  const $ = id => document.getElementById(id);
  const newRunToken = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const shell = () => window.TelePlayGameShell;
  function applyCosmeticTheme() {
    if (!screen) return;
    const theme = window.TelePlayShop?.visualForGame?.(GAME_ID, 'block-themes') || { color: '#a978ff', accent: '#43edff' };
    const background = window.TelePlayShop?.visualForGame?.(GAME_ID, 'backgrounds') || { color: '#28245c', accent: '#0d1025' };
    const effect = window.TelePlayShop?.visualForGame?.(GAME_ID, 'effects') || { color: '#71edff', accent: '#a477ff' };
    screen.style.setProperty('--block-violet', theme.accent || theme.color); screen.style.setProperty('--block-cyan', theme.color); screen.style.setProperty('--block-blue', theme.accent || theme.color); screen.style.setProperty('--block-pink', theme.color);
    screen.style.setProperty('--block-background', `radial-gradient(circle at 50% 5%, ${background.color} 0, ${background.accent || '#0d1025'} 34%, #060814 82%)`); screen.style.setProperty('--block-effect', effect.color || theme.color); screen.style.setProperty('--block-effect-accent', effect.accent || theme.accent || theme.color);
  }
  const randomShape = () => SHAPES[Math.floor(Math.random()*SHAPES.length)].map(([x,y])=>[x,y]);
  function makePieces() { return Array.from({length:3}, (_,id)=>({ id, shape:randomShape(), color:colors[Math.floor(Math.random()*colors.length)], used:false })); }
  function getBounds(shape) { return { w:Math.max(...shape.map(p=>p[0]))+1, h:Math.max(...shape.map(p=>p[1]))+1 }; }
  function renderBoard() {
    boardEl.innerHTML = board.map((value,index)=>`<span class="block-cell ${value ? `filled ${value}` : ''}" data-cell="${index}"></span>`).join('');
  }
  function pieceMarkup(piece, floating=false) {
    const {w,h}=getBounds(piece.shape);
    return `<span class="block-piece-grid ${floating?'floating-grid':''}" style="--pw:${w};--ph:${h}">${piece.shape.map(([x,y])=>`<i class="block-unit ${piece.color}" style="--x:${x};--y:${y}"></i>`).join('')}</span>`;
  }
  function renderTray() {
    trayEl.innerHTML = pieces.map(p=>`<button class="block-piece ${p.used?'used':''}" data-piece="${p.id}" ${p.used?'disabled':''} aria-label="Фигура ${p.id+1}">${pieceMarkup(p)}</button>`).join('');
  }
  function updateHud() { scoreEl.textContent=score.toLocaleString('ru-RU'); comboEl.textContent=streak>1?`×${Math.min(streak,4)}`:'×1'; comboEl.parentElement.classList.toggle('hot',streak>1); }
  function canPlaceOn(grid,shape,col,row) { return shape.every(([x,y])=>col+x>=0&&col+x<SIZE&&row+y>=0&&row+y<SIZE&&!grid[(row+y)*SIZE+col+x]); }
  function canPlace(shape,col,row) { return canPlaceOn(board,shape,col,row); }
  function completedLines(grid) {
    const rows=[], cols=[];
    for(let r=0;r<SIZE;r++) if(Array.from({length:SIZE},(_,c)=>grid[r*SIZE+c]).every(Boolean)) rows.push(r);
    for(let c=0;c<SIZE;c++) if(Array.from({length:SIZE},(_,r)=>grid[r*SIZE+c]).every(Boolean)) cols.push(c);
    return {rows,cols};
  }
  const lineScore = count => [0,100,250,500,1000][Math.min(count,4)];
  function anyPlacement(shape) { for(let row=0;row<SIZE;row++) for(let col=0;col<SIZE;col++) if(canPlace(shape,col,row)) return true; return false; }
  function clearPreview() { boardEl.querySelectorAll('.preview,.invalid').forEach(cell=>cell.classList.remove('preview','invalid')); }
  function showPreview(piece,col,row,valid) {
    clearPreview(); piece.shape.forEach(([x,y])=>{ const cell=boardEl.children[(row+y)*SIZE+col+x]; if(cell) cell.classList.add(valid?'preview':'invalid'); });
  }
  function cellFromPoint(x,y,piece) {
    const rect=boardEl.getBoundingClientRect(), cell=rect.width/SIZE, {w,h}=getBounds(piece.shape);
    return { col:Math.round((x-rect.left)/cell-w/2), row:Math.round((y-rect.top)/cell-h/2) };
  }
  function startDrag(event) {
    if(!playing||clearing) return;
    const button=event.target.closest('.block-piece'); if(!button) return;
    const piece=pieces[Number(button.dataset.piece)]; if(!piece||piece.used) return;
    event.preventDefault(); button.setPointerCapture?.(event.pointerId);
    const ghost=document.createElement('div'); ghost.className='block-drag-ghost'; ghost.innerHTML=pieceMarkup(piece,true); document.body.appendChild(ghost);
    drag={piece,ghost,pointerId:event.pointerId,col:-1,row:-1,valid:false}; moveDrag(event);
  }
  function moveDrag(event) {
    if(!drag||event.pointerId!==drag.pointerId) return;
    event.preventDefault(); drag.ghost.style.transform=`translate3d(${event.clientX}px,${event.clientY-72}px,0)`;
    const position=cellFromPoint(event.clientX,event.clientY-72,drag.piece);
    drag.col=position.col; drag.row=position.row; drag.valid=canPlace(drag.piece.shape,drag.col,drag.row);
    showPreview(drag.piece,drag.col,drag.row,drag.valid);
  }
  function endDrag(event) {
    if(!drag||event.pointerId!==drag.pointerId) return;
    const current=drag; drag=null; current.ghost.remove(); clearPreview();
    if(current.valid) place(current.piece,current.col,current.row);
    else navigator.vibrate?.(18);
  }
  async function place(piece,col,row) {
    piece.shape.forEach(([x,y])=>board[(row+y)*SIZE+col+x]=piece.color);
    piece.used=true; score+=1; shell().SoundManager.play('place'); navigator.vibrate?.(12);
    renderBoard(); renderTray(); updateHud();
    piece.shape.forEach(([x,y])=>boardEl.children[(row+y)*SIZE+col+x]?.classList.add('placed'));
    const {rows,cols}=completedLines(board);
    const lineCount=rows.length+cols.length;
    if(lineCount){
      streak++; bestCombo=Math.max(bestCombo,Math.min(streak,4)); linesCleared+=lineCount;
      score+=lineScore(lineCount)*Math.min(streak,4);
      const cells=new Set(); rows.forEach(r=>{for(let c=0;c<SIZE;c++)cells.add(r*SIZE+c)}); cols.forEach(c=>{for(let r=0;r<SIZE;r++)cells.add(r*SIZE+c)});
      clearing=true; cells.forEach(index=>boardEl.children[index].classList.add('clearing'));
      shell().SoundManager.play(streak>1?'combo':'clear'); navigator.vibrate?.([18,25,18]);
      if(streak>1) particles(); updateHud(); await new Promise(resolve=>setTimeout(resolve,280));
      cells.forEach(index=>board[index]=null); clearing=false; renderBoard();
    } else streak=0;
    updateHud();
    if(pieces.every(p=>p.used)){ pieces=makePieces(); renderTray(); }
    requestAnimationFrame(checkGameOver);
  }
  function particles(){ const layer=$('blockParticles'); for(let i=0;i<18;i++){const p=document.createElement('i');p.style.cssText=`--dx:${(Math.random()-.5)*180}px;--dy:${-30-Math.random()*150}px;--delay:${Math.random()*.12}s`;layer.appendChild(p);setTimeout(()=>p.remove(),800)} }
  function checkGameOver(){ if(playing&&!pieces.some(piece=>!piece.used&&anyPlacement(piece.shape))) finish(); }
  function start() {
    runToken = newRunToken(); board=Array(SIZE*SIZE).fill(null); pieces=makePieces(); score=0; streak=0; bestCombo=1; linesCleared=0; playing=true; clearing=false;
    startLayer.hidden=true; resultLayer.hidden=true; applyCosmeticTheme(); renderBoard();renderTray();updateHud();
    shell().emit('game_started',{gameId:GAME_ID}); shell().SoundManager.play('place');
  }
  function finish() {
    playing=false; const stats=shell().saveResult(GAME_ID,score); const reward=Math.max(1,Math.floor(score/500)+linesCleared);
    window.TelePlayCore.RewardManager.award(GAME_ID,{coins:reward,score,metadata:{transactionId:`game:${GAME_ID}:run:${runToken}`,runToken}}); shell().emit('game_finished',{gameId:GAME_ID,score,reward}); shell().emit('reward_claimed',{gameId:GAME_ID,reward});
    if(stats.newRecord){shell().emit('new_record',{gameId:GAME_ID,score});shell().SoundManager.play('record')}else shell().SoundManager.play('gameover');
    shell().ResultScreen.show(resultLayer,{score,bestScore:stats.bestScore,reward,newRecord:stats.newRecord,title:'Block<br>Grid'});
    callbacks.onWalletChange?.(); navigator.vibrate?.([35,40,70]);
  }
  function open(options={}) {
    callbacks=options; screen.hidden=false; startLayer.hidden=false; resultLayer.hidden=true; playing=false; applyCosmeticTheme();
    const stats=shell().getStats(GAME_ID); $('blockMenuBest').textContent=stats.bestScore.toLocaleString('ru-RU');
    try { window.Telegram?.WebApp?.requestFullscreen(); window.Telegram?.WebApp?.disableVerticalSwipes(); } catch(_){}
  }
  function hide(){ if(!screen)return; screen.hidden=true; playing=false; drag?.ghost.remove();drag=null;try{window.Telegram?.WebApp?.enableVerticalSwipes();window.Telegram?.WebApp?.exitFullscreen()}catch(_){} }
  function init(){
    screen=$('blockGridScreen');boardEl=$('blockBoard');trayEl=$('blockTray');scoreEl=$('blockScore');comboEl=$('blockCombo');startLayer=$('blockStart');resultLayer=$('blockResult');
    trayEl.addEventListener('pointerdown',startDrag);window.addEventListener('pointermove',moveDrag,{passive:false});window.addEventListener('pointerup',endDrag);window.addEventListener('pointercancel',endDrag);
    $('startBlockGrid').addEventListener('click',start);$('replayBlockGrid').addEventListener('click',start);$('closeBlockGrid').addEventListener('click',()=>callbacks.onHome?.());$('blockHome').addEventListener('click',()=>callbacks.onHome?.());
  }
  window.BlockGrid={init,open,hide,start,restart:start,pause:()=>{},resume:()=>{},destroy:hide,_test:{canPlaceOn,completedLines,lineScore,getState:()=>({board:[...board],pieces,score,playing})}};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
