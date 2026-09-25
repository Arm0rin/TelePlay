(() => {
  const screen = () => document.getElementById('adminScreen');
  const root = () => document.getElementById('adminApp');
  const auth = () => window.TelePlayAdmin?.Auth;
  const data = () => window.TelePlayAdmin?.Data;
  const actions = () => window.TelePlayAdmin?.Actions;
  const view = () => window.TelePlayAdmin?.View;
  let activeTab = 'dashboard', query = '', filters = { filter: '', sort: '' }, selectedPlayerId = null, closeHandler = null;
  const notify = (message, tone = 'success') => { const host = root(); if (!host) return; let toast = host.querySelector('.admin-toast'); if (!toast) { toast = document.createElement('div'); toast.className = 'admin-toast'; host.appendChild(toast); } toast.className = `admin-toast ${tone}`; toast.textContent = message; toast.hidden = false; clearTimeout(notify.timer); notify.timer = setTimeout(() => { toast.hidden = true; }, 2600); };
  const denied = () => { const host = root(); if (!host) return; host.innerHTML = `<div class="admin-denied"><span>⛔</span><h2>Access Denied</h2><p>Этот раздел доступен только владельцу TelePlay.</p><button class="play-button" type="button" id="adminDeniedBack">На главную</button></div>`; host.querySelector('#adminDeniedBack').onclick = () => closeHandler?.(); };
  const renderContent = () => {
    const host = document.getElementById('adminContent'); if (!host || !auth()?.isOwner?.()) return;
    if (activeTab === 'dashboard') host.innerHTML = view().dashboard(data().dashboard(), data().analytics?.());
    if (activeTab === 'players') { const selected = selectedPlayerId ? data().selectedPlayer?.(selectedPlayerId) : null; host.innerHTML = view().players(data().playerRows(query, filters), { query, ...filters, player: selected, globalStatus: data().globalStatus?.() }); }
    if (activeTab === 'economy') host.innerHTML = view().economy(data().economy());
    if (activeTab === 'shop') host.innerHTML = view().shop(data().shop());
    if (activeTab === 'payments') host.innerHTML = view().payments(data().payments?.() || []);
    if (activeTab === 'games') host.innerHTML = view().games(data().games());
    if (activeTab === 'security') host.innerHTML = view().security(data().security());
    if (activeTab === 'logs') host.innerHTML = view().logs(data().events(), data().actions());
  };
  const loadGlobalPlayers = async () => { if (!data()?.loadGlobal) return; await data().loadGlobal(query, filters); renderContent(); };
  const render = () => { const host = root(), session = auth()?.current?.(); if (!host || !session) return; if (!session.isOwner) { denied(); return; } host.innerHTML = view().renderShell(session, activeTab); renderContent(); };
  const formValue = (form, name) => form.elements[name]?.value?.trim?.() || '';
  const handlePaymentCompensation = async form => { const result = await actions()?.paymentCompensation?.({ targetPlayerId: formValue(form, 'targetPlayerId'), paymentId: formValue(form, 'paymentId'), amount: formValue(form, 'amount'), reason: formValue(form, 'reason') }); if (result?.ok) { notify('Компенсация выдана и записана в журнал.'); await data()?.loadGlobal?.(query, filters); renderContent(); } else notify(`Не выполнено: ${result?.reason || 'ошибка'}`, 'error'); };
  const handleAction = async (form, submitter) => {
    const player = selectedPlayerId ? data().selectedPlayer?.(selectedPlayerId) : data().currentPlayer();
    if (!player) { notify('Игрок недоступен. Обновите список и попробуйте снова.', 'error'); return; }
    const targetPlayerId = player.id, reason = formValue(form, 'reason'); let result;
    if (form.dataset.adminAction === 'currency') result = actions().adjustCurrency({ targetPlayerId, currencyType: formValue(form, 'currencyType'), amount: formValue(form, 'amount'), reason });
    if (form.dataset.adminAction === 'xp') result = actions().setXP({ targetPlayerId, totalXP: formValue(form, 'totalXP'), reason });
    if (form.dataset.adminAction === 'streak') result = actions().setStreak({ targetPlayerId, currentStreak: formValue(form, 'currentStreak'), bestStreak: formValue(form, 'bestStreak'), reason });
    if (form.dataset.adminAction === 'achievement') result = submitter?.value === 'revoke' ? actions().revokeAchievement({ targetPlayerId, achievementId: formValue(form, 'achievementId'), reason }) : actions().grantAchievement({ targetPlayerId, achievementId: formValue(form, 'achievementId'), reason });
    if (form.dataset.adminAction === 'item') result = submitter?.value === 'revoke' ? actions().revokeItem({ targetPlayerId, itemId: formValue(form, 'itemId'), reason }) : actions().grantItem({ targetPlayerId, itemId: formValue(form, 'itemId'), reason });
    if (form.dataset.adminAction === 'game-item') { const option = form.elements.itemId?.selectedOptions?.[0]; result = submitter?.value === 'revoke' ? actions().revokeItem({ targetPlayerId, itemId: formValue(form, 'itemId'), gameId: option?.dataset.gameId, reason }) : actions().grantItem({ targetPlayerId, itemId: formValue(form, 'itemId'), gameId: option?.dataset.gameId, reason }); }
    result = await Promise.resolve(result);
    if (result?.ok) { notify('Действие выполнено и записано в журнал.'); await data()?.loadGlobal?.(query, filters); renderContent(); } else notify(`Не выполнено: ${result?.reason || 'ошибка'}`, 'error');
  };
  const bind = () => {
    const host = root(); if (!host || host.dataset.bound) return; host.dataset.bound = 'true';
    host.addEventListener('click', event => { const retry = event.target.closest('[data-admin-retry-global]'); if (retry) { loadGlobalPlayers(); return; } const tab = event.target.closest('[data-admin-tab]'); if (tab) { activeTab = tab.dataset.adminTab; render(); if (activeTab === 'players' || activeTab === 'security' || activeTab === 'payments') loadGlobalPlayers(); } const playerRow = event.target.closest('[data-admin-player]'); if (playerRow) { selectedPlayerId = playerRow.dataset.adminPlayer; renderContent(); const pending = data()?.loadPlayer?.(selectedPlayerId); pending?.then?.(() => renderContent()).catch?.(() => notify('Не удалось загрузить игрока с сервера.', 'error')); } if (event.target.closest('#adminClose')) closeHandler?.(); });
    host.addEventListener('submit', event => { event.preventDefault(); const form = event.target; if (form.matches('[data-admin-search]')) { query = formValue(form, 'query'); filters = { filter: formValue(form, 'filter'), sort: formValue(form, 'sort') }; render(); loadGlobalPlayers(); return; } if (form.matches('[data-admin-payment-compensation]')) { handlePaymentCompensation(form); return; } if (form.matches('[data-admin-action]')) handleAction(form, event.submitter); });
  };
  const AdminPanel = {
    mountLauncher(slot, onOpen) { if (!slot) return; slot.replaceChildren(); if (!auth()?.isOwner?.()) return; const button = document.createElement('button'); button.type = 'button'; button.className = 'admin-launcher'; button.setAttribute('aria-label', 'Открыть Admin Panel'); button.innerHTML = '<span>⚙️</span><b>Admin</b>'; button.onclick = onOpen; slot.appendChild(button); },
    setCloseHandler(handler) { closeHandler = handler; },
    open() { const host = root(), node = screen(); if (!host || !node) return; node.hidden = false; bind(); render(); loadGlobalPlayers(); window.TelePlayCore?.Analytics?.track?.('admin_panel_opened', null, { role: auth()?.current?.().role || null }); },
    refresh() { if (!screen()?.hidden) { renderContent(); if (activeTab === 'players' || activeTab === 'security' || activeTab === 'payments') loadGlobalPlayers(); } },
    close() { if (closeHandler) closeHandler(); }
  };
  window.TelePlayAdminPanel = AdminPanel;
})();
