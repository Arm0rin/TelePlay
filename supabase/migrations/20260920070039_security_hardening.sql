-- TelePlay writes through the authenticated Edge Function's direct database
-- connection. Keep the public Supabase Data API roles from reading or writing
-- the server-owned tables if a future RLS policy is accidentally changed.
REVOKE ALL ON TABLE public.players,
  public.progress,
  public.economy,
  public.inventory,
  public.transactions,
  public.game_sessions,
  public.analytics_events,
  public.admin_actions
FROM anon, authenticated;
