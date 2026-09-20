(() => {
  class SportsGameAdapter extends window.TelePlayAdapters.GameAdapter { constructor(gameId,module){super(gameId,module);this.engineType='sports'} }
  window.TelePlayAdapters.SportsGameAdapter=SportsGameAdapter;
})();
