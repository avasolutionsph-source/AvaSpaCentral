-- Drop redundant auth_* permissive RLS policies that have qual=true / with_check=true.
-- These were duplicating the legacy tenant-gated policies (e.g. "Business isolation") AND
-- silently widening access (since they OR with the gates and pass everyone). The legacy
-- policies remain as the sole authoritative gate.

-- ===== Tables with full 4-action auth_* duplicates =====
DROP POLICY IF EXISTS "auth_select_active_services" ON public.active_services;
DROP POLICY IF EXISTS "auth_insert_active_services" ON public.active_services;
DROP POLICY IF EXISTS "auth_update_active_services" ON public.active_services;
DROP POLICY IF EXISTS "auth_delete_active_services" ON public.active_services;

DROP POLICY IF EXISTS "auth_select_activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "auth_insert_activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "auth_update_activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "auth_delete_activity_logs" ON public.activity_logs;

DROP POLICY IF EXISTS "auth_select_advance_bookings" ON public.advance_bookings;
DROP POLICY IF EXISTS "auth_insert_advance_bookings" ON public.advance_bookings;
DROP POLICY IF EXISTS "auth_update_advance_bookings" ON public.advance_bookings;
DROP POLICY IF EXISTS "auth_delete_advance_bookings" ON public.advance_bookings;

DROP POLICY IF EXISTS "auth_select_attendance" ON public.attendance;
DROP POLICY IF EXISTS "auth_insert_attendance" ON public.attendance;
DROP POLICY IF EXISTS "auth_update_attendance" ON public.attendance;
DROP POLICY IF EXISTS "auth_delete_attendance" ON public.attendance;

DROP POLICY IF EXISTS "auth_select_business_config" ON public.business_config;
DROP POLICY IF EXISTS "auth_insert_business_config" ON public.business_config;
DROP POLICY IF EXISTS "auth_update_business_config" ON public.business_config;
DROP POLICY IF EXISTS "auth_delete_business_config" ON public.business_config;

DROP POLICY IF EXISTS "auth_select_cash_drawer_sessions" ON public.cash_drawer_sessions;
DROP POLICY IF EXISTS "auth_insert_cash_drawer_sessions" ON public.cash_drawer_sessions;
DROP POLICY IF EXISTS "auth_update_cash_drawer_sessions" ON public.cash_drawer_sessions;
DROP POLICY IF EXISTS "auth_delete_cash_drawer_sessions" ON public.cash_drawer_sessions;

DROP POLICY IF EXISTS "auth_select_customers" ON public.customers;
DROP POLICY IF EXISTS "auth_insert_customers" ON public.customers;
DROP POLICY IF EXISTS "auth_update_customers" ON public.customers;
DROP POLICY IF EXISTS "auth_delete_customers" ON public.customers;

DROP POLICY IF EXISTS "auth_select_expenses" ON public.expenses;
DROP POLICY IF EXISTS "auth_insert_expenses" ON public.expenses;
DROP POLICY IF EXISTS "auth_update_expenses" ON public.expenses;
DROP POLICY IF EXISTS "auth_delete_expenses" ON public.expenses;

DROP POLICY IF EXISTS "auth_select_gift_certificates" ON public.gift_certificates;
DROP POLICY IF EXISTS "auth_insert_gift_certificates" ON public.gift_certificates;
DROP POLICY IF EXISTS "auth_update_gift_certificates" ON public.gift_certificates;
DROP POLICY IF EXISTS "auth_delete_gift_certificates" ON public.gift_certificates;

DROP POLICY IF EXISTS "auth_select_home_services" ON public.home_services;
DROP POLICY IF EXISTS "auth_insert_home_services" ON public.home_services;
DROP POLICY IF EXISTS "auth_update_home_services" ON public.home_services;
DROP POLICY IF EXISTS "auth_delete_home_services" ON public.home_services;

DROP POLICY IF EXISTS "auth_select_inventory_movements" ON public.inventory_movements;
DROP POLICY IF EXISTS "auth_insert_inventory_movements" ON public.inventory_movements;
DROP POLICY IF EXISTS "auth_update_inventory_movements" ON public.inventory_movements;
DROP POLICY IF EXISTS "auth_delete_inventory_movements" ON public.inventory_movements;

DROP POLICY IF EXISTS "auth_select_loyalty_history" ON public.loyalty_history;
DROP POLICY IF EXISTS "auth_insert_loyalty_history" ON public.loyalty_history;
DROP POLICY IF EXISTS "auth_update_loyalty_history" ON public.loyalty_history;
DROP POLICY IF EXISTS "auth_delete_loyalty_history" ON public.loyalty_history;

DROP POLICY IF EXISTS "auth_select_online_bookings" ON public.online_bookings;
DROP POLICY IF EXISTS "auth_insert_online_bookings" ON public.online_bookings;
DROP POLICY IF EXISTS "auth_update_online_bookings" ON public.online_bookings;
DROP POLICY IF EXISTS "auth_delete_online_bookings" ON public.online_bookings;

DROP POLICY IF EXISTS "auth_select_payroll_config" ON public.payroll_config;
DROP POLICY IF EXISTS "auth_insert_payroll_config" ON public.payroll_config;
DROP POLICY IF EXISTS "auth_update_payroll_config" ON public.payroll_config;
DROP POLICY IF EXISTS "auth_delete_payroll_config" ON public.payroll_config;

DROP POLICY IF EXISTS "auth_select_payroll_config_logs" ON public.payroll_config_logs;
DROP POLICY IF EXISTS "auth_insert_payroll_config_logs" ON public.payroll_config_logs;
DROP POLICY IF EXISTS "auth_update_payroll_config_logs" ON public.payroll_config_logs;
DROP POLICY IF EXISTS "auth_delete_payroll_config_logs" ON public.payroll_config_logs;

DROP POLICY IF EXISTS "auth_select_payroll_requests" ON public.payroll_requests;
DROP POLICY IF EXISTS "auth_insert_payroll_requests" ON public.payroll_requests;
DROP POLICY IF EXISTS "auth_update_payroll_requests" ON public.payroll_requests;
DROP POLICY IF EXISTS "auth_delete_payroll_requests" ON public.payroll_requests;

DROP POLICY IF EXISTS "auth_select_product_consumption" ON public.product_consumption;
DROP POLICY IF EXISTS "auth_insert_product_consumption" ON public.product_consumption;
DROP POLICY IF EXISTS "auth_update_product_consumption" ON public.product_consumption;
DROP POLICY IF EXISTS "auth_delete_product_consumption" ON public.product_consumption;

DROP POLICY IF EXISTS "auth_select_purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "auth_insert_purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "auth_update_purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "auth_delete_purchase_orders" ON public.purchase_orders;

DROP POLICY IF EXISTS "auth_select_service_rotation" ON public.service_rotation;
DROP POLICY IF EXISTS "auth_insert_service_rotation" ON public.service_rotation;
DROP POLICY IF EXISTS "auth_update_service_rotation" ON public.service_rotation;
DROP POLICY IF EXISTS "auth_delete_service_rotation" ON public.service_rotation;

DROP POLICY IF EXISTS "auth_select_settings" ON public.settings;
DROP POLICY IF EXISTS "auth_insert_settings" ON public.settings;
DROP POLICY IF EXISTS "auth_update_settings" ON public.settings;
DROP POLICY IF EXISTS "auth_delete_settings" ON public.settings;

DROP POLICY IF EXISTS "auth_select_shift_schedules" ON public.shift_schedules;
DROP POLICY IF EXISTS "auth_insert_shift_schedules" ON public.shift_schedules;
DROP POLICY IF EXISTS "auth_update_shift_schedules" ON public.shift_schedules;
DROP POLICY IF EXISTS "auth_delete_shift_schedules" ON public.shift_schedules;

DROP POLICY IF EXISTS "auth_select_stock_history" ON public.stock_history;
DROP POLICY IF EXISTS "auth_insert_stock_history" ON public.stock_history;
DROP POLICY IF EXISTS "auth_update_stock_history" ON public.stock_history;
DROP POLICY IF EXISTS "auth_delete_stock_history" ON public.stock_history;

DROP POLICY IF EXISTS "auth_select_suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "auth_insert_suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "auth_update_suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "auth_delete_suppliers" ON public.suppliers;

DROP POLICY IF EXISTS "auth_select_sync_metadata" ON public.sync_metadata;
DROP POLICY IF EXISTS "auth_insert_sync_metadata" ON public.sync_metadata;
DROP POLICY IF EXISTS "auth_update_sync_metadata" ON public.sync_metadata;
DROP POLICY IF EXISTS "auth_delete_sync_metadata" ON public.sync_metadata;

DROP POLICY IF EXISTS "auth_select_sync_queue" ON public.sync_queue;
DROP POLICY IF EXISTS "auth_insert_sync_queue" ON public.sync_queue;
DROP POLICY IF EXISTS "auth_update_sync_queue" ON public.sync_queue;
DROP POLICY IF EXISTS "auth_delete_sync_queue" ON public.sync_queue;

DROP POLICY IF EXISTS "auth_select_time_off_requests" ON public.time_off_requests;
DROP POLICY IF EXISTS "auth_insert_time_off_requests" ON public.time_off_requests;
DROP POLICY IF EXISTS "auth_update_time_off_requests" ON public.time_off_requests;
DROP POLICY IF EXISTS "auth_delete_time_off_requests" ON public.time_off_requests;

-- ===== Tables where only INSERT/SELECT/UPDATE auth_* are duplicates (auth_delete_* is the lone DELETE policy and stays) =====
DROP POLICY IF EXISTS "auth_select_cash_advance_requests" ON public.cash_advance_requests;
DROP POLICY IF EXISTS "auth_insert_cash_advance_requests" ON public.cash_advance_requests;
DROP POLICY IF EXISTS "auth_update_cash_advance_requests" ON public.cash_advance_requests;

DROP POLICY IF EXISTS "auth_select_incident_reports" ON public.incident_reports;
DROP POLICY IF EXISTS "auth_insert_incident_reports" ON public.incident_reports;
DROP POLICY IF EXISTS "auth_update_incident_reports" ON public.incident_reports;

DROP POLICY IF EXISTS "auth_select_leave_requests" ON public.leave_requests;
DROP POLICY IF EXISTS "auth_insert_leave_requests" ON public.leave_requests;
DROP POLICY IF EXISTS "auth_update_leave_requests" ON public.leave_requests;

DROP POLICY IF EXISTS "auth_select_ot_requests" ON public.ot_requests;
DROP POLICY IF EXISTS "auth_insert_ot_requests" ON public.ot_requests;
DROP POLICY IF EXISTS "auth_update_ot_requests" ON public.ot_requests;

-- ===== Tables where only the SELECT auth_* duplicates a legacy SELECT policy =====
DROP POLICY IF EXISTS "auth_select_appointments" ON public.appointments;
DROP POLICY IF EXISTS "auth_select_rooms" ON public.rooms;
DROP POLICY IF EXISTS "auth_select_transactions" ON public.transactions;
DROP POLICY IF EXISTS "auth_select_employees" ON public.employees;
DROP POLICY IF EXISTS "auth_select_products" ON public.products;

-- ===== branches: special — has 3-way DELETE duplicate including a second qual=true legacy =====
DROP POLICY IF EXISTS "Allow authenticated delete branches" ON public.branches;
DROP POLICY IF EXISTS "auth_delete_branches" ON public.branches;
DROP POLICY IF EXISTS "auth_insert_branches" ON public.branches;
DROP POLICY IF EXISTS "auth_select_branches" ON public.branches;
DROP POLICY IF EXISTS "auth_update_branches" ON public.branches;
