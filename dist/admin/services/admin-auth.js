(() => {
  const config = () => window.TelePlayAdminConfig || {};
  const normalizeUsername = value => String(value || '').replace(/^@/, '').trim().toLowerCase();
  const telegramUser = () => window.Telegram?.WebApp?.initDataUnsafe?.user || null;
  const identity = () => {
    const user = telegramUser();
    return {
      telegramId: user?.id != null ? String(user.id) : '',
      username: normalizeUsername(user?.username),
      firstName: String(user?.first_name || ''),
      source: user ? 'telegram' : 'none'
    };
  };
  const entryFor = current => {
    if (!current.telegramId && !current.username) return null;
    return (config().ADMINS || []).find(admin => {
      const configuredId = String(admin.telegramId || '').trim();
      const configuredUsername = normalizeUsername(admin.username);
      const idMatch = configuredId && configuredId !== 'OWNER_ID' && current.telegramId && configuredId === current.telegramId;
      const usernameMatch = !current.telegramId && configuredUsername && configuredUsername === current.username;
      return idMatch || usernameMatch;
    }) || null;
  };
  const current = () => {
    const user = identity(), admin = entryFor(user), role = admin?.role || null;
    return { ...user, role, roleLabel: config().ROLES?.[role]?.label || '', isOwner: role === 'owner', isAdmin: Boolean(admin) };
  };
  const AdminAuth = {
    current,
    isAuthenticated() { return identity().source === 'telegram'; },
    isOwner() { return current().isOwner; },
    isAdmin() { return current().isAdmin; },
    hasPermission(permission) { const session = current(); return session.isOwner || Boolean(session.role && (config().ROLES?.[session.role]?.permissions || []).includes(permission)); },
    guard(permission = 'view') { const session = current(); return { ok: Boolean(session.isAdmin && this.hasPermission(permission)), session, reason: session.isAdmin ? 'forbidden' : 'access_denied' }; }
  };
  window.TelePlayAdmin = window.TelePlayAdmin || {};
  window.TelePlayAdmin.Auth = AdminAuth;
})();
