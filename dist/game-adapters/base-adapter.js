(() => {
  class GameAdapter { constructor(gameId,module){this.gameId=gameId;this.module=module} init(options){this.module.init?.(options)} start(options){this.module.start?.(options)} pause(){this.module.pause?.()} resume(){this.module.resume?.()} restart(){this.module.restart?.()} finish(result){this.module.finish?.(result)} destroy(){this.module.destroy?.()}};
  window.TelePlayAdapters??={};window.TelePlayAdapters.GameAdapter=GameAdapter;
})();
