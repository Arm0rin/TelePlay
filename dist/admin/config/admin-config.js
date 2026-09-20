(() => {
  // Numeric Telegram IDs are the primary identity. Usernames are display data
  // and are only retained as a no-ID demo fallback.
  const ADMINS = Object.freeze([
    { telegramId: '1328706856', username: 'reef_ru', role: 'owner', label: '@reef_ru' }
  ]);
  const ROLES = Object.freeze({
    owner: { id: 'owner', label: 'OWNER', permissions: ['*'] },
    admin: { id: 'admin', label: 'ADMIN', permissions: ['view', 'manage_players', 'manage_economy'] },
    moderator: { id: 'moderator', label: 'MODERATOR', permissions: ['view'] }
  });
  window.TelePlayAdminConfig = Object.freeze({ ADMINS, ROLES, ownerUsername: 'reef_ru' });
})();
