(() => {
  const AudioManager={play(name){window.TelePlayGameShell?.SoundManager?.play(name)},start(name){name?this.play(name):window.TelePlayGameShell?.SoundManager?.startEngine()},stop(){window.TelePlayGameShell?.SoundManager?.stopEngine()},setEnabled(value){window.TelePlayGameShell?.SoundManager?.setEnabled(value)},enabled(){return window.TelePlayGameShell?.SoundManager?.enabled?.()??true}};
  window.TelePlayCore??={};window.TelePlayCore.AudioManager=AudioManager;
})();
