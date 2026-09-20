(() => {
  const webApp = () => window.Telegram?.WebApp;
  const user = () => webApp()?.initDataUnsafe?.user || null;
  const initData = () => String(webApp()?.initData || '');
  const identity = () => {
    const value = user();
    return {
      telegramId: value?.id != null ? String(value.id) : '',
      username: String(value?.username || ''),
      firstName: String(value?.first_name || ''),
      avatar: String(value?.photo_url || ''),
      initData: initData(),
      authenticated: Boolean(value && initData())
    };
  };
  const headers = (extra = {}) => {
    const token = initData();
    return { Accept: 'application/json', ...(token ? { 'X-Telegram-Init-Data': token } : {}), ...extra };
  };
  const TelegramAuth = { user, identity, initData, headers, hasIdentity: () => Boolean(identity().telegramId) };
  window.TelePlayCore ??= {};
  window.TelePlayCore.TelegramAuth = TelegramAuth;
  window.TelePlayTelegramAuth = TelegramAuth;
})();
