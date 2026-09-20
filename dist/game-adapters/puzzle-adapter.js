(() => {
  class PuzzleGameAdapter extends window.TelePlayAdapters.GameAdapter { constructor(gameId,module){super(gameId,module);this.engineType='puzzle'} }
  window.TelePlayAdapters.PuzzleGameAdapter=PuzzleGameAdapter;
})();
