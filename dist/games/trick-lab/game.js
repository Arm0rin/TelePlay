(() => {
  const ID = 'trick-lab';
  const tg = window.Telegram?.WebApp;
  const shell = () => window.TelePlayGameShell;
  let screen, startLayer, resultLayer, scene, rules, feedback, runButton, levelLabel, movesLabel, scoreLabel, callbacks = {}, level = 0, moves = 0, score = 0, selected = 'gravity', paused = false, finished = false, initialized = false;
  const levels = [
    { title: 'Сила тянет вниз', hint: 'Подними объект над стеной.', rules: [['gravity','Гравитация','Вниз'],['bounce','Отскок','Включён'],['push','Импульс','Вправо']] },
    { title: 'Цвет открывает путь', hint: 'Сделай красную стену проходимой.', rules: [['color','Красный','Мягкий'],['gravity','Гравитация','Вниз'],['light','Свет','Включён']] },
    { title: 'Последний закон', hint: 'Выбери импульс и отправь объект к цели.', rules: [['push','Импульс','Вправо'],['gravity','Гравитация','Вверх'],['bounce','Отскок','Включён']] }
  ];
  const $ = id => document.getElementById(id);
  const haptic = type => { try { tg?.HapticFeedback?.impactOccurred(type); } catch (_) {} };
  const current = () => levels[level];
  function render() {
    const item = current();
    levelLabel.textContent = `${level + 1} / ${levels.length}`; movesLabel.textContent = moves; scoreLabel.textContent = score.toLocaleString('ru-RU');
    scene.innerHTML = `<span class="trick-lab-gravity">${item.title}</span><span class="trick-lab-object" id="trickLabObject">◆</span><span class="trick-lab-wall" id="trickLabWall"></span><span class="trick-lab-goal"></span>`;
    feedback.textContent = item.hint;
    rules.innerHTML = item.rules.map(([id, title, value]) => `<button class="trick-rule ${id === selected ? 'is-selected' : ''}" type="button" data-rule="${id}"><b>${title}</b><small>${value}</small></button>`).join('');
  }
  function choose(id) { if (paused || finished) return; selected = id; rules.querySelectorAll('.trick-rule').forEach(button => button.classList.toggle('is-selected', button.dataset.rule === id)); feedback.textContent = `Правило «${rules.querySelector(`[data-rule="${id}"] b`).textContent}» выбрано. Запусти его.`; haptic('light'); }
  function run() {
    if (paused || finished) return;
    moves += 1; movesLabel.textContent = moves;
    const object = $('trickLabObject'), wall = $('trickLabWall');
    if ((level === 0 && selected === 'gravity') || (level === 1 && selected === 'color') || (level === 2 && selected === 'push')) {
      object.classList.add('is-moving'); wall.classList.add('is-open'); score += Math.max(100, 420 - moves * 40); scoreLabel.textContent = score.toLocaleString('ru-RU'); feedback.textContent = 'Правило сработало. Цель достигнута!'; haptic('medium');
      setTimeout(() => level + 1 >= levels.length ? finish() : nextLevel(), 500);
    } else { feedback.textContent = 'Не сработало. Наблюдай внимательнее и измени правило.'; score = Math.max(0, score - 20); scoreLabel.textContent = score.toLocaleString('ru-RU'); haptic('heavy'); }
  }
  function nextLevel() { level += 1; moves = 0; selected = levels[level].rules[0][0]; render(); }
  function finish() {
    if (finished) return; finished = true; const previous = shell().getStats(ID), result = shell().saveResult(ID, score, { bestMoves: previous.bestMoves ? Math.min(previous.bestMoves, moves) : moves, levelsCompleted: levels.length, lastResult: { score, moves, levels: levels.length } });
    const reward = Math.max(1, Math.floor(score / 180)); window.TelePlayCore?.RewardManager?.award(ID, { coins: reward, score, metadata: { transactionId: `game:${ID}:run:${Date.now()}`, levels: levels.length, moves } });
    shell().emit('trick_lab_finished', { gameId: ID, score, moves, levels: levels.length, reward }); shell().emit('game_finished', { gameId: ID, score, reward, moves, levels: levels.length, completed: true });
    shell().ResultScreen.show(resultLayer, { score, bestScore: result.bestScore, reward, newRecord: result.newRecord, title: 'Решение<br>найдено!', details: { moves, levels: `${levels.length} / ${levels.length}` } }); resultLayer.hidden = false;
  }
  function start() { level = 0; moves = 0; score = 0; selected = levels[0].rules[0][0]; paused = false; finished = false; startLayer.hidden = true; resultLayer.hidden = true; render(); shell().emit('trick_lab_started', { gameId: ID }); shell().emit('game_started', { gameId: ID }); haptic('light'); }
  function open(options = {}) { callbacks = options; screen.hidden = false; startLayer.hidden = false; resultLayer.hidden = true; paused = false; finished = false; const stats = shell().getStats(ID); $('trickLabMenuBest').textContent = Number(stats.bestScore || 0).toLocaleString('ru-RU'); render(); try { tg?.requestFullscreen?.(); tg?.disableVerticalSwipes?.(); } catch (_) {} }
  function hide() { screen.hidden = true; paused = false; try { tg?.enableVerticalSwipes?.(); tg?.exitFullscreen?.(); } catch (_) {} }
  function close() { hide(); callbacks.onHome?.(); }
  function pause() { if (finished) return; paused = !paused; $('trickLabPause').textContent = paused ? '▶' : 'Ⅱ'; feedback.textContent = paused ? 'Пауза' : current().hint; shell().emit(paused ? 'game_paused' : 'game_resumed', { gameId: ID }); }
  function init() { if (initialized) return; initialized = true; screen = $('trickLabScreen'); startLayer = $('trickLabStart'); resultLayer = $('trickLabResult'); scene = $('trickLabScene'); rules = $('trickLabRules'); feedback = $('trickLabFeedback'); runButton = $('trickLabRun'); levelLabel = $('trickLabLevel'); movesLabel = $('trickLabMoves'); scoreLabel = $('trickLabScore'); $('trickLabStartButton').addEventListener('click', start); $('trickLabReplay').addEventListener('click', start); $('trickLabClose').addEventListener('click', close); $('trickLabHome').addEventListener('click', close); $('trickLabPause').addEventListener('click', pause); runButton.addEventListener('click', run); rules.addEventListener('click', event => { const button = event.target.closest('[data-rule]'); if (button) choose(button.dataset.rule); }); document.addEventListener('visibilitychange', () => { if (document.hidden && !screen.hidden && !paused && !finished) pause(); }); render(); }
  window.TrickLabGame = { init, open, close, hide, start, restart: start, pause, resume: () => { if (paused) pause(); }, destroy: hide };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
