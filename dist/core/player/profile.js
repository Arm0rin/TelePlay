(() => {
  const profileDefaults = () => ({ id: '', username: 'Игрок', firstName: '', avatar: '', createdAt: 0 });
  function fromTelegram(existing = {}) {
    const user = window.Telegram?.WebApp?.initDataUnsafe?.user || {};
    return { ...profileDefaults(), ...existing, id: String(existing.id || user.id || 'guest'), username: existing.username || user.username || user.first_name || 'Игрок', firstName: existing.firstName || user.first_name || '', avatar: existing.avatar || user.photo_url || '', createdAt: Number(existing.createdAt || Date.now()) };
  }
  window.TelePlayPlayer ??= {};
  window.TelePlayPlayer.Profile = { defaults: profileDefaults, fromTelegram };
})();
