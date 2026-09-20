(() => {
  class CanvasGameAdapter extends window.TelePlayAdapters.GameAdapter { constructor(gameId,module){super(gameId,module);this.engineType='canvas'} }
  window.TelePlayAdapters.CanvasGameAdapter=CanvasGameAdapter;
})();
