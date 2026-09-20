(() => {
  const tg=()=>window.Telegram?.WebApp,HapticManager={impact(style='light'){try{tg()?.HapticFeedback?.impactOccurred(style)}catch(_){}},notification(type='success'){try{tg()?.HapticFeedback?.notificationOccurred(type)}catch(_){}},selection(){try{tg()?.HapticFeedback?.selectionChanged()}catch(_){}}};
  window.TelePlayCore??={};window.TelePlayCore.HapticManager=HapticManager;
})();
