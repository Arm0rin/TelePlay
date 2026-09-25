(() => {
  const core = () => window.TelePlayCore || {};
  let cache = null;
  const id = prefix => `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const refresh = () => core().DataProvider?.syncCurrentPlayer?.().catch?.(() => null);
  const packages = async () => { if (cache) return cache; cache = await core().DataProvider.getPaymentPackages(); return cache; };
  const resetPackages = () => { cache = null; };
  const history = () => core().DataProvider.getMyPayments();
  const buyPackage = async packageId => {
    const key = id(`payment:${packageId}`);
    try {
      const invoice = await core().DataProvider.createPaymentInvoice(packageId, key);
      const invoiceUrl = invoice?.invoiceUrl || invoice?.payment?.invoiceUrl;
      if (!invoiceUrl) { core().Analytics?.track?.('payment_invoice_unavailable', null, { productId: packageId }); return { ok: false, reason: 'invoice_unavailable', payment: invoice?.payment || null }; }
      core().Analytics?.track?.('payment_started', null, { productId: packageId, paymentId: invoice?.payment?.id || null });
      const webApp = window.Telegram?.WebApp;
      if (typeof webApp?.openInvoice !== 'function') { core().Analytics?.track?.('payment_invoice_unavailable', null, { productId: packageId, platform: 'non_telegram' }); return { ok: false, reason: 'telegram_invoice_unavailable', payment: invoice?.payment || null }; }
      return await new Promise(resolve => {
        try {
          webApp.openInvoice(invoiceUrl, async status => {
            // Telegram's client status is only a UI hint. The webhook is the
            // authority; never mutate Gems from this callback.
            if (status === 'paid' || status === 'pending') {
              for (let attempt = 0; attempt < 4; attempt += 1) { await wait(800 * (attempt + 1)); const rows = await history().catch(() => []); const payment = rows.find(item => item.id === invoice?.payment?.id); if (payment?.status === 'completed') { await refresh(); core().Analytics?.track?.('payment_completed', null, { productId: packageId, paymentId: payment.id, amount: payment.amount, currency: payment.currency }); return resolve({ ok: true, status: 'completed', payment }); } if (payment?.status === 'failed' || payment?.status === 'refunded') { core().Analytics?.track?.('payment_failed', null, { productId: packageId, paymentId: payment.id, status: payment.status }); return resolve({ ok: false, status: payment.status, payment }); } }
            }
            if (status === 'cancelled') core().Analytics?.track?.('payment_cancelled', null, { productId: packageId, paymentId: invoice?.payment?.id || null });
            resolve({ ok: status === 'paid', status, payment: invoice.payment });
          });
        } catch (error) {
          resolve({ ok: false, reason: 'telegram_invoice_failed', error: error?.message || String(error), payment: invoice?.payment || null });
        }
      });
    } catch (error) {
      return { ok: false, reason: String(error?.code || error?.message || 'payment_request_failed'), error: error?.message || String(error) };
    }
  };
  window.TelePlayCore = window.TelePlayCore || {};
  window.TelePlayCore.PaymentManager = { packages, resetPackages, history, buyPackage };
})();
