-- Add the 20 remaining syncable tables to supabase_realtime so the client can
-- replace its 5-minute REST polling fallback with realtime subscriptions.
-- REPLICA IDENTITY FULL is set so UPDATE/DELETE payloads include every column
-- (Supabase realtime needs this to deliver the full `old` record).

ALTER PUBLICATION supabase_realtime ADD TABLE
  public.business_config,
  public.cash_drawer_sessions,
  public.cash_drawer_shifts,
  public.gift_certificates,
  public.purchase_orders,
  public.attendance,
  public.shift_schedules,
  public.payroll_requests,
  public.payroll_config,
  public.time_off_requests,
  public.ot_requests,
  public.leave_requests,
  public.cash_advance_requests,
  public.incident_reports,
  public.advance_bookings,
  public.active_services,
  public.suppliers,
  public.service_rotation,
  public.home_services,
  public.loyalty_history;

ALTER TABLE public.business_config         REPLICA IDENTITY FULL;
ALTER TABLE public.cash_drawer_sessions    REPLICA IDENTITY FULL;
ALTER TABLE public.cash_drawer_shifts      REPLICA IDENTITY FULL;
ALTER TABLE public.gift_certificates       REPLICA IDENTITY FULL;
ALTER TABLE public.purchase_orders         REPLICA IDENTITY FULL;
ALTER TABLE public.attendance              REPLICA IDENTITY FULL;
ALTER TABLE public.shift_schedules         REPLICA IDENTITY FULL;
ALTER TABLE public.payroll_requests        REPLICA IDENTITY FULL;
ALTER TABLE public.payroll_config          REPLICA IDENTITY FULL;
ALTER TABLE public.time_off_requests       REPLICA IDENTITY FULL;
ALTER TABLE public.ot_requests             REPLICA IDENTITY FULL;
ALTER TABLE public.leave_requests          REPLICA IDENTITY FULL;
ALTER TABLE public.cash_advance_requests   REPLICA IDENTITY FULL;
ALTER TABLE public.incident_reports        REPLICA IDENTITY FULL;
ALTER TABLE public.advance_bookings        REPLICA IDENTITY FULL;
ALTER TABLE public.active_services         REPLICA IDENTITY FULL;
ALTER TABLE public.suppliers               REPLICA IDENTITY FULL;
ALTER TABLE public.service_rotation        REPLICA IDENTITY FULL;
ALTER TABLE public.home_services           REPLICA IDENTITY FULL;
ALTER TABLE public.loyalty_history         REPLICA IDENTITY FULL;
