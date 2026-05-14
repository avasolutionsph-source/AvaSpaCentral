-- ============================================================================
-- AVA SPA CENTRAL — CONSOLIDATED SUPABASE SETUP
-- ----------------------------------------------------------------------------
-- I-paste mo lahat ng laman ng file na ito sa Supabase SQL Editor (single
-- page lang, no need i-split) tapos pindutin Run.
--
-- Kung may "policy ... already exists" error — run mo muna
-- `00-reset-public-schema.sql` para malinis ang previous partial run,
-- tapos paste mo ulit ito.
--
-- Idempotent: pwedeng patak-patakan i-run nang paulit-ulit. Every CREATE
-- POLICY / CREATE TRIGGER is preceded by DROP ... IF EXISTS, and every
-- ALTER PUBLICATION ADD TABLE is wrapped in an existence check.
-- ============================================================================


-- ============================================================================
-- BLOCK: supabase-schema.sql
-- ============================================================================
-- ============================================
-- SUPABASE SCHEMA FOR SPA ERP
-- ============================================
-- Run this SQL in your Supabase SQL Editor to create all required tables.
-- This schema matches the Dexie.js local database structure.
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CORE BUSINESS TABLES
-- ============================================

-- Business/Organization table
CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    tagline TEXT,
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Philippines',
    phone VARCHAR(50),
    email VARCHAR(255),
    logo_url TEXT,
    cover_photo_url TEXT,
    primary_color VARCHAR(20) DEFAULT '#1B5E37',
    booking_slug VARCHAR(100),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Branches/Locations
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users/Auth accounts (linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('Owner', 'Manager', 'Receptionist', 'Therapist')),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    employee_id UUID,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    password VARCHAR(255),
    last_login TIMESTAMPTZ,
    sync_status VARCHAR(20) DEFAULT 'synced',
    deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PRODUCTS & SERVICES
-- ============================================

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL CHECK (type IN ('service', 'retail', 'package')),
    category VARCHAR(100),
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    cost DECIMAL(10,2) DEFAULT 0,
    duration INTEGER,
    stock_quantity INTEGER DEFAULT 0,
    reorder_level INTEGER DEFAULT 0,
    sku VARCHAR(100),
    active BOOLEAN DEFAULT TRUE,
    hide_from_pos BOOLEAN DEFAULT FALSE,
    services_since_last_adjustment INTEGER DEFAULT 0,
    image_url TEXT,
    items_used JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    sync_status VARCHAR(20) DEFAULT 'synced',
    deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PEOPLE TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    department VARCHAR(100),
    position VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
    hire_date DATE,
    hourly_rate DECIMAL(10,2) DEFAULT 0,
    commission_rate DECIMAL(5,2) DEFAULT 0,
    photo_url TEXT,
    address TEXT,
    emergency_contact TEXT,
    skills JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    sync_status VARCHAR(20) DEFAULT 'synced',
    deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    birthday DATE,
    gender VARCHAR(20),
    tier VARCHAR(20) DEFAULT 'NEW' CHECK (tier IN ('NEW', 'REGULAR', 'VIP')),
    loyalty_points INTEGER DEFAULT 0,
    total_spent DECIMAL(12,2) DEFAULT 0,
    visit_count INTEGER DEFAULT 0,
    last_visit TIMESTAMPTZ,
    notes TEXT,
    preferences JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active',
    sync_status VARCHAR(20) DEFAULT 'synced',
    deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    payment_terms TEXT,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'active',
    sync_status VARCHAR(20) DEFAULT 'synced',
    deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- OPERATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50),
    capacity INTEGER DEFAULT 1,
    description TEXT,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'cleaning')),
    sync_status VARCHAR(20) DEFAULT 'synced',
    deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id UUID,
    employee_id UUID,
    date DATE NOT NULL,
    subtotal DECIMAL(12,2) DEFAULT 0,
    discount DECIMAL(10,2) DEFAULT 0,
    discount_type VARCHAR(50),
    tax DECIMAL(10,2) DEFAULT 0,
    service_charge DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(12,2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(50),
    amount_paid DECIMAL(12,2) DEFAULT 0,
    change_amount DECIMAL(12,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled', 'refunded')),
    items JSONB NOT NULL DEFAULT '[]',
    notes TEXT,
    receipt_number VARCHAR(50),
    gift_certificate_code VARCHAR(50),
    gift_certificate_amount DECIMAL(10,2) DEFAULT 0,
    sync_status VARCHAR(20) DEFAULT 'synced',
    deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id UUID,
    employee_id UUID,
    room_id UUID,
    scheduled_date_time TIMESTAMPTZ NOT NULL,
    duration INTEGER,
    service_id UUID,
    service_name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
    notes TEXT,
    sync_status VARCHAR(20) DEFAULT 'synced',
    deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INVENTORY
-- ============================================

CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    supplier_id UUID,
    order_date DATE NOT NULL,
    expected_date DATE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'ordered', 'received', 'cancelled')),
    items JSONB NOT NULL DEFAULT '[]',
    total DECIMAL(12,2) DEFAULT 0,
    notes TEXT,
    sync_status VARCHAR(20) DEFAULT 'synced',
    deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    product_id UUID,
    type VARCHAR(50) NOT NULL CHECK (type IN ('purchase', 'sale', 'adjustment', 'return', 'consumption')),
    quantity INTEGER NOT NULL,
    date DATE NOT NULL,
    reference_id UUID,
    notes TEXT,
    sync_status VARCHAR(20) DEFAULT 'synced',
    deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    product_id UUID,
    date DATE NOT NULL,
    type VARCHAR(50),
    quantity_before INTEGER,
    quantity_after INTEGER,
    reason TEXT,
    user_id UUID,
    sync_status VARCHAR(20) DEFAULT 'synced',
    deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_consumption (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    product_id UUID,
    date DATE NOT NULL,
    month VARCHAR(7),
    quantity_used DECIMAL(10,2) DEFAULT 0,
    transaction_id UUID,
    service_id UUID,
    employee_id UUID,
    sync_status VARCHAR(20) DEFAULT 'synced',
    deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FINANCIAL
-- ============================================

CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    category VARCHAR(100),
    expense_type VARCHAR(100),
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    description TEXT,
    vendor VARCHAR(255),
    receipt_url TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by UUID,
    sync_status VARCHAR(20) DEFAULT 'synced',
    deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cash_drawer_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID,
    open_time TIMESTAMPTZ NOT NULL,
    close_time TIMESTAMPTZ,
    opening_balance DECIMAL(12,2) DEFAULT 0,
    closing_balance DECIMAL(12,2) DEFAULT 0,
    expected_balance DECIMAL(12,2) DEFAULT 0,
    difference DECIMAL(12,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    transactions JSONB DEFAULT '[]',
    notes TEXT,
    sync_status VARCHAR(20) DEFAULT 'synced',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gift_certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    balance DECIMAL(10,2) NOT NULL DEFAULT 0,
    recipient_name VARCHAR(255),
    recipient_email VARCHAR(255),
    purchaser_name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'expired', 'cancelled')),
    expiry_date DATE,
    no_expiry BOOLEAN DEFAULT FALSE,
    usage_history JSONB DEFAULT '[]',
    sync_status VARCHAR(20) DEFAULT 'synced',
    deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- HR
-- ============================================

CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL,
    date DATE NOT NULL,
    clock_in TIMESTAMPTZ,
    clock_out TIMESTAMPTZ,
    status VARCHAR(20),
    hours_worked DECIMAL(5,2) DEFAULT 0,
    overtime_hours DECIMAL(5,2) DEFAULT 0,
    late_minutes INTEGER DEFAULT 0,
    notes TEXT,
    clock_in_location JSONB,
    clock_out_location JSONB,
    sync_status VARCHAR(20) DEFAULT 'synced',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shift_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL,
    week_start DATE,
    is_active BOOLEAN DEFAULT TRUE,
    schedule JSONB DEFAULT '{}',
    sync_status VARCHAR(20) DEFAULT 'synced',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL,
    request_type VARCHAR(50),
    amount DECIMAL(12,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
    requested_date DATE,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    notes TEXT,
    sync_status VARCHAR(20) DEFAULT 'synced',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS time_off_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reason TEXT,
    approved_by UUID,
    sync_status VARCHAR(20) DEFAULT 'synced',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LOGS & CONFIGURATION
-- ============================================

CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID,
    user_name VARCHAR(255),
    type VARCHAR(100),
    action VARCHAR(100),
    entity_type VARCHAR(100),
    entity_id UUID,
    details JSONB,
    ip_address VARCHAR(50),
    sync_status VARCHAR(20) DEFAULT 'synced',
    deleted BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    key VARCHAR(100) NOT NULL,
    value JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_id, key)
);

CREATE TABLE IF NOT EXISTS payroll_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    key VARCHAR(100) NOT NULL,
    value JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_id, key)
);

CREATE TABLE IF NOT EXISTS payroll_config_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID,
    user_name VARCHAR(255),
    changes JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS business_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    key VARCHAR(100) NOT NULL,
    value JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_id, key)
);

CREATE TABLE IF NOT EXISTS service_rotation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    rotation_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_id, date)
);

-- ============================================
-- OTHER TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS loyalty_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id UUID,
    date DATE NOT NULL,
    type VARCHAR(50),
    points INTEGER DEFAULT 0,
    balance_after INTEGER DEFAULT 0,
    reference_id UUID,
    notes TEXT,
    sync_status VARCHAR(20) DEFAULT 'synced',
    deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS advance_bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id UUID,
    customer_name VARCHAR(255),
    employee_id UUID,
    booking_date_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    services JSONB DEFAULT '[]',
    total_amount DECIMAL(12,2) DEFAULT 0,
    payment_status VARCHAR(20) DEFAULT 'unpaid',
    notes TEXT,
    sync_status VARCHAR(20) DEFAULT 'synced',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS active_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    room_id UUID,
    advance_booking_id UUID,
    customer_id UUID,
    employee_id UUID,
    service_id UUID,
    status VARCHAR(20) DEFAULT 'in_progress',
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    duration INTEGER,
    sync_status VARCHAR(20) DEFAULT 'synced',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS home_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    employee_id UUID,
    transaction_id UUID,
    customer_id UUID,
    status VARCHAR(20) DEFAULT 'scheduled',
    scheduled_time TIMESTAMPTZ,
    address TEXT,
    notes TEXT,
    services JSONB DEFAULT '[]',
    sync_status VARCHAR(20) DEFAULT 'synced',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SYNC INFRASTRUCTURE
-- ============================================

CREATE TABLE IF NOT EXISTS sync_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    device_id VARCHAR(100),
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    operation VARCHAR(20) NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
    data JSONB,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    retry_count INTEGER DEFAULT 0,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sync_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    device_id VARCHAR(100),
    entity_type VARCHAR(100) NOT NULL,
    last_sync_timestamp TIMESTAMPTZ,
    last_push_timestamp TIMESTAMPTZ,
    last_pull_timestamp TIMESTAMPTZ,
    item_count INTEGER DEFAULT 0,
    UNIQUE(business_id, device_id, entity_type)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_business_id ON users(business_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);

CREATE INDEX IF NOT EXISTS idx_products_business_id ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_type ON products(type);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);

CREATE INDEX IF NOT EXISTS idx_employees_business_id ON employees(business_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);

CREATE INDEX IF NOT EXISTS idx_customers_business_id ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_tier ON customers(tier);

CREATE INDEX IF NOT EXISTS idx_suppliers_business_id ON suppliers(business_id);

CREATE INDEX IF NOT EXISTS idx_rooms_business_id ON rooms(business_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);

CREATE INDEX IF NOT EXISTS idx_transactions_business_id ON transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_employee_id ON transactions(employee_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

CREATE INDEX IF NOT EXISTS idx_appointments_business_id ON appointments(business_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled ON appointments(scheduled_date_time);
CREATE INDEX IF NOT EXISTS idx_appointments_employee_id ON appointments(employee_id);
CREATE INDEX IF NOT EXISTS idx_appointments_customer_id ON appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_business_id ON purchase_orders(business_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_business_id ON inventory_movements(business_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id ON inventory_movements(product_id);

CREATE INDEX IF NOT EXISTS idx_expenses_business_id ON expenses(business_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

CREATE INDEX IF NOT EXISTS idx_gift_certificates_business_id ON gift_certificates(business_id);
CREATE INDEX IF NOT EXISTS idx_gift_certificates_code ON gift_certificates(code);

CREATE INDEX IF NOT EXISTS idx_attendance_business_id ON attendance(business_id);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance(employee_id, date);

CREATE INDEX IF NOT EXISTS idx_shift_schedules_business_id ON shift_schedules(business_id);
CREATE INDEX IF NOT EXISTS idx_shift_schedules_employee_id ON shift_schedules(employee_id);

CREATE INDEX IF NOT EXISTS idx_payroll_requests_business_id ON payroll_requests(business_id);
CREATE INDEX IF NOT EXISTS idx_payroll_requests_employee_id ON payroll_requests(employee_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_business_id ON activity_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_activity_logs_type ON activity_logs(type);

CREATE INDEX IF NOT EXISTS idx_sync_queue_business_id ON sync_queue(business_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Helper function to get user's business_id
CREATE OR REPLACE FUNCTION get_user_business_id()
RETURNS UUID AS $$
    SELECT business_id FROM users WHERE auth_id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER;

-- Enable RLS on all tables
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_consumption ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_drawer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_off_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_config_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_rotation ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE advance_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE home_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_metadata ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Business isolation (users can only access their own business data)

-- Businesses table
DROP POLICY IF EXISTS "Users can view their business" ON businesses;
CREATE POLICY "Users can view their business" ON businesses
    FOR SELECT USING (id = get_user_business_id());

DROP POLICY IF EXISTS "Owners can update their business" ON businesses;
CREATE POLICY "Owners can update their business" ON businesses
    FOR UPDATE USING (
        id = get_user_business_id() AND
        EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'Owner')
    );

-- Users table
DROP POLICY IF EXISTS "Users can view own business users" ON users;
CREATE POLICY "Users can view own business users" ON users
    FOR SELECT USING (business_id = get_user_business_id());

DROP POLICY IF EXISTS "Owners can manage users" ON users;
CREATE POLICY "Owners can manage users" ON users
    FOR ALL USING (
        business_id = get_user_business_id() AND
        EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'Owner')
    );

-- Generic policy for all other tables
DROP POLICY IF EXISTS "Business isolation" ON products;
CREATE POLICY "Business isolation" ON products FOR ALL USING (business_id = get_user_business_id());
DROP POLICY IF EXISTS "Business isolation" ON employees;
CREATE POLICY "Business isolation" ON employees FOR ALL USING (business_id = get_user_business_id());
DROP POLICY IF EXISTS "Business isolation" ON customers;
CREATE POLICY "Business isolation" ON customers FOR ALL USING (business_id = get_user_business_id());
DROP POLICY IF EXISTS "Business isolation" ON suppliers;
CREATE POLICY "Business isolation" ON suppliers FOR ALL USING (business_id = get_user_business_id());
DROP POLICY IF EXISTS "Business isolation" ON rooms;
CREATE POLICY "Business isolation" ON rooms FOR ALL USING (business_id = get_user_business_id());
DROP POLICY IF EXISTS "Business isolation" ON transactions;
CREATE POLICY "Business isolation" ON transactions FOR ALL USING (business_id = get_user_business_id());
DROP POLICY IF EXISTS "Business isolation" ON appointments;
CREATE POLICY "Business isolation" ON appointments FOR ALL USING (business_id = get_user_business_id());
DROP POLICY IF EXISTS "Business isolation" ON purchase_orders;
CREATE POLICY "Business isolation" ON purchase_orders FOR ALL USING (business_id = get_user_business_id());
DROP POLICY IF EXISTS "Business isolation" ON inventory_movements;
CREATE POLICY "Business isolation" ON inventory_movements FOR ALL USING (business_id = get_user_business_id());
DROP POLICY IF EXISTS "Business isolation" ON stock_history;
CREATE POLICY "Business isolation" ON stock_history FOR ALL USING (business_id = get_user_business_id());
DROP POLICY IF EXISTS "Business isolation" ON product_consumption;
CREATE POLICY "Business isolation" ON product_consumption FOR ALL USING (business_id = get_user_business_id());
DROP POLICY IF EXISTS "Business isolation" ON expenses;
CREATE POLICY "Business isolation" ON expenses FOR ALL USING (business_id = get_user_business_id());
DROP POLICY IF EXISTS "Business isolation" ON cash_drawer_sessions;
CREATE POLICY "Business isolation" ON cash_drawer_sessions FOR ALL USING (business_id = get_user_business_id());
DROP POLICY IF EXISTS "Business isolation" ON gift_certificates;
CREATE POLICY "Business isolation" ON gift_certificates FOR ALL USING (business_id = get_user_business_id());
DROP POLICY IF EXISTS "Business isolation" ON attendance;
CREATE POLICY "Business isolation" ON attendance FOR ALL USING (business_id = get_user_business_id());
DROP POLICY IF EXISTS "Business isolation" ON shift_schedules;
CREATE POLICY "Business isolation" ON shift_schedules FOR ALL USING (business_id = get_user_business_id());
DROP POLICY IF EXISTS "Business isolation" ON payroll_requests;
CREATE POLICY "Business isolation" ON payroll_requests FOR ALL USING (business_id = get_user_business_id());
DROP POLICY IF EXISTS "Business isolation" ON time_off_requests;
CREATE POLICY "Business isolation" ON time_off_requests FOR ALL USING (business_id = get_user_business_id());
DROP POLICY IF EXISTS "Business isolation" ON activity_logs;
CREATE POLICY "Business isolation" ON activity_logs FOR ALL USING (business_id = get_user_business_id());
DROP POLICY IF EXISTS "Business isolation" ON settings;
CREATE POLICY "Business isolation" ON settings FOR ALL USING (business_id = get_user_business_id());
DROP POLICY IF EXISTS "Business isolation" ON payroll_config;
CREATE POLICY "Business isolation" ON payroll_config FOR ALL USING (business_id = get_user_business_id());
DROP POLICY IF EXISTS "Business isolation" ON payroll_config_logs;
CREATE POLICY "Business isolation" ON payroll_config_logs FOR ALL USING (business_id = get_user_business_id());
DROP POLICY IF EXISTS "Business isolation" ON business_config;
CREATE POLICY "Business isolation" ON business_config FOR ALL USING (business_id = get_user_business_id());
DROP POLICY IF EXISTS "Business isolation" ON service_rotation;
CREATE POLICY "Business isolation" ON service_rotation FOR ALL USING (business_id = get_user_business_id());
DROP POLICY IF EXISTS "Business isolation" ON loyalty_history;
CREATE POLICY "Business isolation" ON loyalty_history FOR ALL USING (business_id = get_user_business_id());
DROP POLICY IF EXISTS "Business isolation" ON advance_bookings;
CREATE POLICY "Business isolation" ON advance_bookings FOR ALL USING (business_id = get_user_business_id());
DROP POLICY IF EXISTS "Business isolation" ON active_services;
CREATE POLICY "Business isolation" ON active_services FOR ALL USING (business_id = get_user_business_id());
DROP POLICY IF EXISTS "Business isolation" ON home_services;
CREATE POLICY "Business isolation" ON home_services FOR ALL USING (business_id = get_user_business_id());
DROP POLICY IF EXISTS "Business isolation" ON sync_queue;
CREATE POLICY "Business isolation" ON sync_queue FOR ALL USING (business_id = get_user_business_id());
DROP POLICY IF EXISTS "Business isolation" ON sync_metadata;
CREATE POLICY "Business isolation" ON sync_metadata FOR ALL USING (business_id = get_user_business_id());

-- ============================================
-- ENABLE REALTIME FOR KEY TABLES
-- ============================================
-- Run these in Supabase Dashboard > Database > Replication
-- Or use the SQL below:

-- Note: You may need to run this via the Supabase Dashboard
-- ALTER PUBLICATION supabase_realtime ADD TABLE products;
-- ALTER PUBLICATION supabase_realtime ADD TABLE employees;
-- ALTER PUBLICATION supabase_realtime ADD TABLE customers;
-- ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
-- ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
-- ALTER PUBLICATION supabase_realtime ADD TABLE rooms;

-- ============================================
-- DONE!
-- ============================================
-- After running this schema:
-- 1. Create a business record for your spa
-- 2. Sign up a user via Supabase Auth
-- 3. Create a corresponding user record with the auth_id
-- 4. The app will handle the rest!


-- ============================================================================
-- BLOCK: supabase-migration-fix.sql
-- ============================================================================
-- ============================================
-- MIGRATION SCRIPT: Fix Missing Columns
-- ============================================
-- Run this SQL in your Supabase SQL Editor to add missing columns
-- to your existing tables. This fixes the sync errors.
-- ============================================

-- Add branding columns to businesses table
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS cover_photo_url TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS primary_color VARCHAR(20) DEFAULT '#1B5E37';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS booking_slug VARCHAR(100);

-- Add items_used to products table (for service-product linking)
ALTER TABLE products ADD COLUMN IF NOT EXISTS items_used JSONB DEFAULT '[]';

-- Add hide_from_pos to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS hide_from_pos BOOLEAN DEFAULT FALSE;

-- Add updated_at and other missing columns to inventory_movements
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;

-- Add updated_at and other missing columns to stock_history
ALTER TABLE stock_history ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE stock_history ADD COLUMN IF NOT EXISTS sync_status VARCHAR(20) DEFAULT 'synced';
ALTER TABLE stock_history ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;

-- Add updated_at and other missing columns to product_consumption
ALTER TABLE product_consumption ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE product_consumption ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;

-- Add updated_at and other missing columns to activity_logs
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS sync_status VARCHAR(20) DEFAULT 'synced';
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;

-- Add updated_at and other missing columns to loyalty_history
ALTER TABLE loyalty_history ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE loyalty_history ADD COLUMN IF NOT EXISTS sync_status VARCHAR(20) DEFAULT 'synced';
ALTER TABLE loyalty_history ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;

-- Add updated_at to payroll_config_logs
ALTER TABLE payroll_config_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- VERIFY THE CHANGES
-- ============================================
-- After running this script, you can verify the columns were added:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'products' AND column_name = 'hide_from_pos';

-- ============================================
-- DONE!
-- ============================================


-- ============================================================================
-- BLOCK: supabase-fix-rls.sql
-- ============================================================================
-- =============================================================================
-- FIX: Remove duplicate/conflicting RLS policy that causes 500 error on login
-- Run this IMMEDIATELY in Supabase SQL Editor
-- =============================================================================

-- The "owners_can_view_business_users" policy causes infinite recursion
-- because it queries the users table inside its own SELECT policy.
-- The existing "Users can view own business users" policy already handles this
-- correctly using get_user_business_id() which is SECURITY DEFINER (bypasses RLS).

DROP POLICY IF EXISTS "owners_can_view_business_users" ON users;

-- Also fix the UPDATE policy to use the SECURITY DEFINER function instead
DROP POLICY IF EXISTS "owners_can_update_branch_owner_profiles" ON users;

DROP POLICY IF EXISTS "owners_can_update_branch_owner_profiles" ON users;
CREATE POLICY "owners_can_update_branch_owner_profiles" ON users
  FOR UPDATE
  USING (
    business_id = get_user_business_id()
    AND EXISTS (
      SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('Owner', 'Manager')
    )
  )
  WITH CHECK (
    business_id = get_user_business_id()
    AND EXISTS (
      SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('Owner', 'Manager')
    )
  );

-- =============================================================================
-- DONE! Login should work again immediately after running this.
-- =============================================================================


-- ============================================================================
-- BLOCK: supabase-online-bookings.sql
-- ============================================================================
-- ============================================================================
-- ONLINE BOOKINGS TABLE
-- Run this script in your Supabase SQL Editor
-- ============================================================================

-- Create the online_bookings table
CREATE TABLE IF NOT EXISTS online_bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,

    -- Booking reference
    reference_number VARCHAR(50) NOT NULL UNIQUE,

    -- Customer details (not linked to customers table - public booking)
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    customer_email VARCHAR(255),
    notes TEXT,

    -- Scheduling
    preferred_date DATE NOT NULL,
    preferred_time VARCHAR(20) NOT NULL,
    preferred_therapist_id UUID REFERENCES employees(id) ON DELETE SET NULL,

    -- Services (stored as JSON array)
    services JSONB NOT NULL DEFAULT '[]',

    -- Pricing
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    deposit_amount DECIMAL(10,2) NOT NULL DEFAULT 0,

    -- Status tracking
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
    payment_status VARCHAR(50) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'deposit_paid', 'fully_paid', 'refunded')),

    -- Source tracking
    source VARCHAR(50) DEFAULT 'online_booking',

    -- Staff who confirmed/handled the booking
    confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMPTZ,

    -- If converted to an actual appointment
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Soft delete
    deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_online_bookings_business_id ON online_bookings(business_id);
CREATE INDEX IF NOT EXISTS idx_online_bookings_status ON online_bookings(status);
CREATE INDEX IF NOT EXISTS idx_online_bookings_preferred_date ON online_bookings(preferred_date);
CREATE INDEX IF NOT EXISTS idx_online_bookings_reference ON online_bookings(reference_number);
CREATE INDEX IF NOT EXISTS idx_online_bookings_created_at ON online_bookings(created_at DESC);

-- Enable Row Level Security
ALTER TABLE online_bookings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see bookings for their business
DROP POLICY IF EXISTS "Users can view own business bookings" ON online_bookings;
CREATE POLICY "Users can view own business bookings" ON online_bookings
    FOR SELECT
    USING (
        business_id IN (
            SELECT business_id FROM users WHERE auth_id = auth.uid()
        )
    );

-- Policy: Anyone can INSERT (public booking page)
DROP POLICY IF EXISTS "Anyone can create bookings" ON online_bookings;
CREATE POLICY "Anyone can create bookings" ON online_bookings
    FOR INSERT
    WITH CHECK (true);

-- Policy: Users can update bookings for their business
DROP POLICY IF EXISTS "Users can update own business bookings" ON online_bookings;
CREATE POLICY "Users can update own business bookings" ON online_bookings
    FOR UPDATE
    USING (
        business_id IN (
            SELECT business_id FROM users WHERE auth_id = auth.uid()
        )
    );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_online_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_online_bookings_updated_at ON online_bookings;
CREATE TRIGGER trigger_online_bookings_updated_at
    BEFORE UPDATE ON online_bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_online_bookings_updated_at();

-- ============================================================================
-- DONE! You can now receive online bookings.
-- ============================================================================


-- ============================================================================
-- BLOCK: supabase-booking-slug.sql
-- ============================================================================
                -- ============================================================================
                -- BOOKING SLUG FEATURE
                -- Run this script in your Supabase SQL Editor
                -- Allows businesses to have custom booking URLs like /book/daet-spa
                -- ============================================================================

                -- Add booking_slug column to businesses table
                ALTER TABLE businesses
                ADD COLUMN IF NOT EXISTS booking_slug VARCHAR(50) UNIQUE;

                -- Create index for fast lookups by slug
                CREATE INDEX IF NOT EXISTS idx_businesses_booking_slug
                ON businesses(booking_slug) WHERE booking_slug IS NOT NULL;

                -- Add RLS policy to allow public read of booking_slug
                -- (This is already covered by "Public can view businesses" policy if you have it)

                -- ============================================================================
                -- DONE! You can now set custom booking slugs for businesses.
                --
                -- Example: UPDATE businesses SET booking_slug = 'daet-spa' WHERE id = 'your-uuid';
                -- Then access: /book/daet-spa
                -- ============================================================================


-- ============================================================================
-- BLOCK: supabase-branches.sql
-- ============================================================================
-- ============================================================================
-- BRANCHES & MULTI-LOCATION FEATURE
-- Run this script in your Supabase SQL Editor
-- Allows businesses to have multiple branches with separate services & settings
-- ============================================================================

-- ============================================================================
-- 1. BRANCHES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  -- Branch info
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,  -- URL-friendly identifier (e.g., "naga", "daet")
  address TEXT,
  city VARCHAR(100),
  phone VARCHAR(50),
  email VARCHAR(255),

  -- Display settings
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,

  -- Service location options (Owner-configurable)
  enable_home_service BOOLEAN DEFAULT true,
  enable_hotel_service BOOLEAN DEFAULT true,
  home_service_fee DECIMAL(10,2) DEFAULT 200,
  hotel_service_fee DECIMAL(10,2) DEFAULT 150,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique slug per business
  UNIQUE(business_id, slug)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_branches_business_id ON branches(business_id);
CREATE INDEX IF NOT EXISTS idx_branches_slug ON branches(business_id, slug);
CREATE INDEX IF NOT EXISTS idx_branches_active ON branches(business_id, is_active);

-- ============================================================================
-- 2. ADD branch_id TO EXISTING TABLES
-- ============================================================================

-- Products/Services - can be branch-specific or shared (NULL = all branches)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_branch_id ON products(branch_id);

-- Employees - can be assigned to a specific branch
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employees_branch_id ON employees(branch_id);

-- Rooms - belong to a specific branch
ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rooms_branch_id ON rooms(branch_id);

-- Online Bookings - track which branch the booking is for
ALTER TABLE online_bookings
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_online_bookings_branch_id ON online_bookings(branch_id);

-- Appointments - track which branch
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_branch_id ON appointments(branch_id);

-- Transactions - track which branch for reporting
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_branch_id ON transactions(branch_id);

-- Users - Branch Owner can be assigned to a specific branch
ALTER TABLE users
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_branch_id ON users(branch_id);

-- Users - Add username column for username-based login
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL;

-- ============================================================================
-- 3. SERVICE LOCATION FIELDS FOR ONLINE BOOKINGS
-- ============================================================================

-- Add service location tracking to online_bookings
ALTER TABLE online_bookings
ADD COLUMN IF NOT EXISTS service_location VARCHAR(20) DEFAULT 'in_store',
ADD COLUMN IF NOT EXISTS service_address TEXT,
ADD COLUMN IF NOT EXISTS service_city VARCHAR(100),
ADD COLUMN IF NOT EXISTS service_landmark TEXT,
ADD COLUMN IF NOT EXISTS service_instructions TEXT,
ADD COLUMN IF NOT EXISTS transport_fee DECIMAL(10,2) DEFAULT 0;

-- Add check constraint for service_location values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'online_bookings_service_location_check'
  ) THEN
    ALTER TABLE online_bookings
    ADD CONSTRAINT online_bookings_service_location_check
    CHECK (service_location IN ('in_store', 'home_service', 'hotel_service'));
  END IF;
END $$;

-- ============================================================================
-- 4. UPDATE USER ROLE CHECK CONSTRAINT
-- ============================================================================

-- Drop existing constraint and recreate with Branch Owner
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('Owner', 'Manager', 'Receptionist', 'Therapist', 'Branch Owner'));

-- ============================================================================
-- 5. ROW LEVEL SECURITY POLICIES
-- ============================================================================

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Staff view business branches" ON branches;
DROP POLICY IF EXISTS "Owner manage branches" ON branches;
DROP POLICY IF EXISTS "Public view active branches" ON branches;

-- Staff can view branches for their business (uses helper function for performance)
DROP POLICY IF EXISTS "Staff view business branches" ON branches;
CREATE POLICY "Staff view business branches" ON branches
  FOR SELECT USING (
    business_id = get_current_user_business_id()
  );

-- Only Owner can create/update/delete branches (uses helper function for performance)
DROP POLICY IF EXISTS "Owner manage branches" ON branches;
CREATE POLICY "Owner manage branches" ON branches
  FOR ALL USING (
    business_id = get_current_user_business_id()
    AND get_current_user_role() = 'Owner'
  );

-- NOTE: Public branch viewing removed - use get_business_branches() function instead
-- This prevents exposing all businesses' branches to anonymous users

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Function to get branches for a business
CREATE OR REPLACE FUNCTION get_business_branches(p_business_id UUID)
RETURNS SETOF branches AS $$
  SELECT * FROM branches
  WHERE business_id = p_business_id AND is_active = true
  ORDER BY display_order, name;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Function to check if business has multiple branches
CREATE OR REPLACE FUNCTION has_multiple_branches(p_business_id UUID)
RETURNS BOOLEAN AS $$
  SELECT COUNT(*) > 1 FROM branches
  WHERE business_id = p_business_id AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_branches_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS branches_updated_at ON branches;
DROP TRIGGER IF EXISTS branches_updated_at ON branches;
CREATE TRIGGER branches_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW
  EXECUTE FUNCTION update_branches_timestamp();

-- ============================================================================
-- 6B. SECURITY DEFINER FUNCTIONS FOR RLS (PREVENTS RECURSION)
-- These functions bypass RLS to avoid infinite recursion when policies
-- need to check user attributes from the users table
-- ============================================================================

-- Get current user's role (bypasses RLS)
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Get current user's branch_id (bypasses RLS)
CREATE OR REPLACE FUNCTION get_current_user_branch_id()
RETURNS UUID AS $$
  SELECT branch_id FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Get current user's business_id (bypasses RLS)
CREATE OR REPLACE FUNCTION get_current_user_business_id()
RETURNS UUID AS $$
  SELECT business_id FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

-- ============================================================================
-- 7. BRANCH OWNER RLS POLICIES (Using helper functions to prevent recursion)
-- ============================================================================

-- Branch Owner can only see/modify their assigned branch's data
-- Non-Branch Owners (Owner, Manager, etc.) see all business data

-- ============================================================================
-- PRODUCTS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Branch owner view products" ON products;
DROP POLICY IF EXISTS "Branch owner insert products" ON products;
DROP POLICY IF EXISTS "Branch owner update products" ON products;
DROP POLICY IF EXISTS "Branch owner delete products" ON products;

DROP POLICY IF EXISTS "Branch owner view products" ON products;
CREATE POLICY "Branch owner view products" ON products
  FOR SELECT USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id IS NULL
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner insert products" ON products;
CREATE POLICY "Branch owner insert products" ON products
  FOR INSERT WITH CHECK (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner update products" ON products;
CREATE POLICY "Branch owner update products" ON products
  FOR UPDATE USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner delete products" ON products;
CREATE POLICY "Branch owner delete products" ON products
  FOR DELETE USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

-- ============================================================================
-- APPOINTMENTS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Branch owner view appointments" ON appointments;
DROP POLICY IF EXISTS "Branch owner insert appointments" ON appointments;
DROP POLICY IF EXISTS "Branch owner update appointments" ON appointments;
DROP POLICY IF EXISTS "Branch owner delete appointments" ON appointments;

DROP POLICY IF EXISTS "Branch owner view appointments" ON appointments;
CREATE POLICY "Branch owner view appointments" ON appointments
  FOR SELECT USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id IS NULL
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner insert appointments" ON appointments;
CREATE POLICY "Branch owner insert appointments" ON appointments
  FOR INSERT WITH CHECK (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner update appointments" ON appointments;
CREATE POLICY "Branch owner update appointments" ON appointments
  FOR UPDATE USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner delete appointments" ON appointments;
CREATE POLICY "Branch owner delete appointments" ON appointments
  FOR DELETE USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

-- ============================================================================
-- TRANSACTIONS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Branch owner view transactions" ON transactions;
DROP POLICY IF EXISTS "Branch owner insert transactions" ON transactions;
DROP POLICY IF EXISTS "Branch owner update transactions" ON transactions;
DROP POLICY IF EXISTS "Branch owner delete transactions" ON transactions;

DROP POLICY IF EXISTS "Branch owner view transactions" ON transactions;
CREATE POLICY "Branch owner view transactions" ON transactions
  FOR SELECT USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id IS NULL
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner insert transactions" ON transactions;
CREATE POLICY "Branch owner insert transactions" ON transactions
  FOR INSERT WITH CHECK (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner update transactions" ON transactions;
CREATE POLICY "Branch owner update transactions" ON transactions
  FOR UPDATE USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner delete transactions" ON transactions;
CREATE POLICY "Branch owner delete transactions" ON transactions
  FOR DELETE USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

-- ============================================================================
-- 8. ADDITIONAL BRANCH OWNER RLS POLICIES (DATA ISOLATION)
-- ============================================================================

-- ============================================================================
-- EMPLOYEES POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Branch owner view employees" ON employees;
DROP POLICY IF EXISTS "Branch owner insert employees" ON employees;
DROP POLICY IF EXISTS "Branch owner update employees" ON employees;
DROP POLICY IF EXISTS "Branch owner delete employees" ON employees;

DROP POLICY IF EXISTS "Branch owner view employees" ON employees;
CREATE POLICY "Branch owner view employees" ON employees
  FOR SELECT USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id IS NULL
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner insert employees" ON employees;
CREATE POLICY "Branch owner insert employees" ON employees
  FOR INSERT WITH CHECK (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner update employees" ON employees;
CREATE POLICY "Branch owner update employees" ON employees
  FOR UPDATE USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner delete employees" ON employees;
CREATE POLICY "Branch owner delete employees" ON employees
  FOR DELETE USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

-- ============================================================================
-- ROOMS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Branch owner view rooms" ON rooms;
DROP POLICY IF EXISTS "Branch owner insert rooms" ON rooms;
DROP POLICY IF EXISTS "Branch owner update rooms" ON rooms;
DROP POLICY IF EXISTS "Branch owner delete rooms" ON rooms;

DROP POLICY IF EXISTS "Branch owner view rooms" ON rooms;
CREATE POLICY "Branch owner view rooms" ON rooms
  FOR SELECT USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id IS NULL
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner insert rooms" ON rooms;
CREATE POLICY "Branch owner insert rooms" ON rooms
  FOR INSERT WITH CHECK (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner update rooms" ON rooms;
CREATE POLICY "Branch owner update rooms" ON rooms
  FOR UPDATE USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner delete rooms" ON rooms;
CREATE POLICY "Branch owner delete rooms" ON rooms
  FOR DELETE USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

-- ============================================================================
-- ONLINE BOOKINGS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Branch owner view online_bookings" ON online_bookings;
DROP POLICY IF EXISTS "Branch owner insert online_bookings" ON online_bookings;
DROP POLICY IF EXISTS "Branch owner update online_bookings" ON online_bookings;
DROP POLICY IF EXISTS "Branch owner delete online_bookings" ON online_bookings;

DROP POLICY IF EXISTS "Branch owner view online_bookings" ON online_bookings;
CREATE POLICY "Branch owner view online_bookings" ON online_bookings
  FOR SELECT USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id IS NULL
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner insert online_bookings" ON online_bookings;
CREATE POLICY "Branch owner insert online_bookings" ON online_bookings
  FOR INSERT WITH CHECK (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner update online_bookings" ON online_bookings;
CREATE POLICY "Branch owner update online_bookings" ON online_bookings
  FOR UPDATE USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner delete online_bookings" ON online_bookings;
CREATE POLICY "Branch owner delete online_bookings" ON online_bookings
  FOR DELETE USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

-- ============================================================================
-- USERS POLICIES (Branch Owner has limited access)
-- ============================================================================
DROP POLICY IF EXISTS "Branch owner view users" ON users;

-- Branch Owner can only see users in their branch (cannot create/modify users)
DROP POLICY IF EXISTS "Branch owner view users" ON users;
CREATE POLICY "Branch owner view users" ON users
  FOR SELECT USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id IS NULL
      OR branch_id = get_current_user_branch_id()
    )
  );

-- NOTE: Branch Owner cannot INSERT/UPDATE/DELETE users - only Owner can manage staff

-- ============================================================================
-- 9. BRANCH OWNER VALIDATION TRIGGER
-- Ensures Branch Owner users have a valid branch_id from the same business
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_branch_owner()
RETURNS TRIGGER AS $$
BEGIN
  -- Only validate Branch Owner role
  IF NEW.role = 'Branch Owner' THEN
    -- Branch Owner must have a branch_id
    IF NEW.branch_id IS NULL THEN
      RAISE EXCEPTION 'Branch Owner must be assigned to a branch';
    END IF;

    -- Verify branch exists and belongs to the same business
    IF NOT EXISTS (
      SELECT 1 FROM branches
      WHERE id = NEW.branch_id
      AND business_id = NEW.business_id
    ) THEN
      RAISE EXCEPTION 'Invalid branch_id: branch does not exist or belongs to a different business';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_branch_owner_trigger ON users;
DROP TRIGGER IF EXISTS validate_branch_owner_trigger ON users;
CREATE TRIGGER validate_branch_owner_trigger
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION validate_branch_owner();

-- ============================================================================
-- 10. PUBLIC BOOKING PAGE FUNCTION (Safe alternative to public RLS policy)
-- Use this function to fetch branches for public booking pages
-- Requires business_id as parameter - prevents exposing all businesses
-- ============================================================================

CREATE OR REPLACE FUNCTION get_public_branches(p_business_id UUID)
RETURNS TABLE (
  id UUID,
  name VARCHAR(255),
  slug VARCHAR(100),
  address TEXT,
  city VARCHAR(100),
  phone VARCHAR(50),
  enable_home_service BOOLEAN,
  enable_hotel_service BOOLEAN,
  home_service_fee DECIMAL(10,2),
  hotel_service_fee DECIMAL(10,2)
) AS $$
  SELECT
    id, name, slug, address, city, phone,
    enable_home_service, enable_hotel_service,
    home_service_fee, hotel_service_fee
  FROM branches
  WHERE business_id = p_business_id
  AND is_active = true
  ORDER BY display_order, name;
$$ LANGUAGE SQL SECURITY DEFINER;

-- ============================================================================
-- DONE!
--
-- Branches system is now ready:
-- 1. Create branches in Settings → Branches
-- 2. Assign services to specific branches (or leave NULL for all)
-- 3. Assign employees to branches
-- 4. Create Branch Owner users with branch_id set
-- 5. Configure home/hotel service fees per branch
--
-- Security improvements made:
-- - RLS policies use helper functions (better performance)
-- - Branch Owner has full CRUD on their branch's data
-- - Public branch exposure removed (use get_public_branches() instead)
-- - Branch Owner validation prevents invalid branch assignments
-- ============================================================================


-- ============================================================================
-- BLOCK: supabase-booking-rls.sql
-- ============================================================================
-- ============================================================================
-- RLS POLICIES FOR PUBLIC BOOKING PAGE
-- Run this in Supabase SQL Editor to allow the booking page to read data
-- ============================================================================

-- Allow anyone to read business info (needed for booking page header)
DROP POLICY IF EXISTS "Public can view businesses" ON businesses;
CREATE POLICY "Public can view businesses" ON businesses
    FOR SELECT
    USING (true);

-- Allow anyone to read active products/services (needed for booking page)
DROP POLICY IF EXISTS "Public can view active products" ON products;
CREATE POLICY "Public can view active products" ON products
    FOR SELECT
    USING (active = true AND deleted = false);

-- Allow anyone to read active employees (needed for therapist selection)
DROP POLICY IF EXISTS "Public can view active employees" ON employees;
CREATE POLICY "Public can view active employees" ON employees
    FOR SELECT
    USING (status = 'active' AND deleted = false);

-- Allow anyone to read hero/branding settings (needed for booking page hero)
DROP POLICY IF EXISTS "Public can view hero settings" ON settings;
CREATE POLICY "Public can view hero settings" ON settings
    FOR SELECT
    USING (key IN (
        'heroFont', 'heroFontColor', 'heroTextX', 'heroTextY',
        'heroAnimation', 'heroFontSize', 'heroAnimDelay', 'heroAnimDuration',
        'heroLogoEnabled', 'heroLogoX', 'heroLogoY', 'heroLogoSize'
    ));

-- ============================================================================
-- NOTE: If you get "policy already exists" errors, that's OK - it means
-- the policies are already in place. You can ignore those errors.
-- ============================================================================


-- ============================================================================
-- BLOCK: supabase-booking-rls-footer.sql
-- ============================================================================
-- ============================================================================
-- FIX: Allow public booking page to read footer + logo animation settings
-- Run this in Supabase SQL Editor.
--
-- The original "Public can view hero settings" policy only whitelisted hero
-- keys, so footerLine1-4, footerFont, footerFontSize, and heroLogoAnimation*
-- were silently filtered out when the booking page queried settings with the
-- anon key. The admin Settings page saved them successfully, but the live
-- booking page's anon-key fetch couldn't read them.
-- ============================================================================

DROP POLICY IF EXISTS "Public can view hero settings" ON settings;

DROP POLICY IF EXISTS "Public can view hero settings" ON settings;
CREATE POLICY "Public can view hero settings" ON settings
    FOR SELECT
    USING (key IN (
        'heroFont', 'heroFontColor', 'heroTextX', 'heroTextY',
        'heroAnimation', 'heroFontSize', 'heroAnimDelay', 'heroAnimDuration',
        'heroTextEnabled',
        'heroLogoEnabled', 'heroLogoX', 'heroLogoY', 'heroLogoSize',
        'heroLogoAnimation', 'heroLogoAnimDelay', 'heroLogoAnimDuration',
        'footerLine1', 'footerLine2', 'footerLine3', 'footerLine4',
        'footerFont', 'footerFontSize'
    ));

-- ============================================================================
-- DONE! After running, hard-refresh the live booking page (Ctrl+Shift+R) and
-- the footer should appear. No code redeploy needed — this is a database
-- policy change only.
-- ============================================================================


-- ============================================================================
-- BLOCK: supabase-customer-accounts.sql
-- ============================================================================
-- ============================================================================
-- CUSTOMER ACCOUNTS & PORTAL FEATURE
-- Run this script in your Supabase SQL Editor
-- Allows customers to create accounts, login, and view their booking history
-- ============================================================================

-- Customer accounts table (for customer login - separate from staff customers table)
CREATE TABLE IF NOT EXISTS customer_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  auth_id UUID UNIQUE,  -- Links to Supabase Auth user
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  customer_id UUID REFERENCES customers(id),  -- Links to customer record (created on first booking)

  -- Profile data
  birthday DATE,
  gender VARCHAR(20),
  preferences JSONB DEFAULT '{}',

  -- Loyalty system
  loyalty_points INTEGER DEFAULT 0,
  tier VARCHAR(20) DEFAULT 'NEW',  -- NEW, REGULAR, VIP
  total_spent DECIMAL(12,2) DEFAULT 0,
  visit_count INTEGER DEFAULT 0,

  -- Account status
  email_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique email per business (customer can have accounts at multiple businesses)
  UNIQUE(business_id, email)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_customer_accounts_business_id ON customer_accounts(business_id);
CREATE INDEX IF NOT EXISTS idx_customer_accounts_auth_id ON customer_accounts(auth_id);
CREATE INDEX IF NOT EXISTS idx_customer_accounts_email ON customer_accounts(business_id, email);
CREATE INDEX IF NOT EXISTS idx_customer_accounts_customer_id ON customer_accounts(customer_id);

-- Add customer_account_id to online_bookings to link bookings to customer accounts
ALTER TABLE online_bookings
ADD COLUMN IF NOT EXISTS customer_account_id UUID REFERENCES customer_accounts(id);

CREATE INDEX IF NOT EXISTS idx_online_bookings_customer_account ON online_bookings(customer_account_id);

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

ALTER TABLE customer_accounts ENABLE ROW LEVEL SECURITY;

-- Customers can view their own account
DROP POLICY IF EXISTS "Customers view own account" ON customer_accounts;
CREATE POLICY "Customers view own account" ON customer_accounts
  FOR SELECT USING (auth.uid() = auth_id);

-- Customers can update their own account (limited fields)
DROP POLICY IF EXISTS "Customers update own account" ON customer_accounts;
CREATE POLICY "Customers update own account" ON customer_accounts
  FOR UPDATE USING (auth.uid() = auth_id)
  WITH CHECK (auth.uid() = auth_id);

-- Public can create accounts (registration)
DROP POLICY IF EXISTS "Public can register" ON customer_accounts;
CREATE POLICY "Public can register" ON customer_accounts
  FOR INSERT WITH CHECK (true);

-- Staff can view customer accounts for their business
DROP POLICY IF EXISTS "Staff view business customers" ON customer_accounts;
CREATE POLICY "Staff view business customers" ON customer_accounts
  FOR SELECT USING (
    business_id IN (
      SELECT business_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Staff can update customer accounts for their business (e.g., add loyalty points)
DROP POLICY IF EXISTS "Staff update business customers" ON customer_accounts;
CREATE POLICY "Staff update business customers" ON customer_accounts
  FOR UPDATE USING (
    business_id IN (
      SELECT business_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- ============================================================================
-- UPDATE ONLINE BOOKINGS RLS FOR CUSTOMER ACCESS
-- ============================================================================

-- Allow customers to view their own bookings
DROP POLICY IF EXISTS "Customers view own bookings" ON online_bookings;
DROP POLICY IF EXISTS "Customers view own bookings" ON online_bookings;
CREATE POLICY "Customers view own bookings" ON online_bookings
  FOR SELECT USING (
    customer_account_id IN (
      SELECT id FROM customer_accounts WHERE auth_id = auth.uid()
    )
  );

-- Allow customers to update their own bookings (e.g., cancel)
DROP POLICY IF EXISTS "Customers update own bookings" ON online_bookings;
DROP POLICY IF EXISTS "Customers update own bookings" ON online_bookings;
CREATE POLICY "Customers update own bookings" ON online_bookings
  FOR UPDATE USING (
    customer_account_id IN (
      SELECT id FROM customer_accounts WHERE auth_id = auth.uid()
    )
  )
  WITH CHECK (
    customer_account_id IN (
      SELECT id FROM customer_accounts WHERE auth_id = auth.uid()
    )
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get customer account by auth_id and business_id
CREATE OR REPLACE FUNCTION get_customer_account(p_business_id UUID)
RETURNS customer_accounts AS $$
  SELECT * FROM customer_accounts
  WHERE auth_id = auth.uid() AND business_id = p_business_id
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Function to calculate loyalty tier based on points
CREATE OR REPLACE FUNCTION calculate_loyalty_tier(points INTEGER)
RETURNS VARCHAR(20) AS $$
BEGIN
  IF points >= 500 THEN
    RETURN 'VIP';
  ELSIF points >= 100 THEN
    RETURN 'REGULAR';
  ELSE
    RETURN 'NEW';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to add loyalty points and update tier
CREATE OR REPLACE FUNCTION add_loyalty_points(
  p_customer_account_id UUID,
  p_points INTEGER,
  p_amount DECIMAL DEFAULT 0
)
RETURNS customer_accounts AS $$
DECLARE
  v_account customer_accounts;
BEGIN
  UPDATE customer_accounts
  SET
    loyalty_points = loyalty_points + p_points,
    total_spent = total_spent + p_amount,
    visit_count = visit_count + 1,
    tier = calculate_loyalty_tier(loyalty_points + p_points),
    updated_at = NOW()
  WHERE id = p_customer_account_id
  RETURNING * INTO v_account;

  RETURN v_account;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_customer_account_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS customer_accounts_updated_at ON customer_accounts;
DROP TRIGGER IF EXISTS customer_accounts_updated_at ON customer_accounts;
CREATE TRIGGER customer_accounts_updated_at
  BEFORE UPDATE ON customer_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_account_timestamp();

-- ============================================================================
-- DONE!
-- Customers can now:
-- 1. Register at /book/{slug}/register
-- 2. Login at /book/{slug}/login
-- 3. View profile at /book/{slug}/profile
-- 4. See booking history
-- 5. Earn loyalty points
-- ============================================================================


-- ============================================================================
-- BLOCK: supabase-cancel-void-audit.sql
-- ============================================================================
-- ============================================================================
-- Cancel / Void audit columns
-- ----------------------------------------------------------------------------
-- Adds the missing actor + reason + timestamp columns the app's local Dexie
-- already writes, but which were never declared on the Supabase side. Without
-- these, the cancel/void state stays local-only and other devices never see
-- the exclusion that ServiceHistory applies for revenue/transaction counts.
--
-- Safe to re-run: every statement uses IF NOT EXISTS.
-- Run order: this script touches `transactions` and `advance_bookings`. No
-- existing rows are modified — new columns default to NULL.
-- ============================================================================

-- transactions: void (manual via Service History "Void" button)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS voided_at  TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS voided_by  TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS void_reason TEXT;

-- transactions: cancel (cascade from Rooms when a service is cancelled)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cancelled_at      TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cancelled_by      TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cancelled_by_role TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cancel_reason     TEXT;

-- advance_bookings: track who cancelled the booking (cancelled_at / cancel_reason
-- already exist on this table). cancelled_by / cancelled_by_role complete the
-- audit trail so the rider page and reports can show "cancelled by Maria
-- (Therapist)" with no client-side guessing.
ALTER TABLE advance_bookings ADD COLUMN IF NOT EXISTS cancelled_by      TEXT;
ALTER TABLE advance_bookings ADD COLUMN IF NOT EXISTS cancelled_by_role TEXT;

-- Optional indexes — only useful if you commonly filter Service History or
-- reports by cancellation status. Skip if your row counts are small.
CREATE INDEX IF NOT EXISTS idx_transactions_status_void    ON transactions(status) WHERE status = 'voided';
CREATE INDEX IF NOT EXISTS idx_transactions_status_cancel  ON transactions(status) WHERE status = 'cancelled';


-- ============================================================================
-- BLOCK: supabase-home-service-pickup.sql
-- ============================================================================
-- ============================================================================
-- Home services: rider + pickup workflow columns
-- ----------------------------------------------------------------------------
-- Adds the columns required for the rider-facing "magkano need bayaran" total
-- and the therapist's Pasundo (request pickup) flow:
--   * service_price / total_amount  — let the rider card show the amount to
--     collect at the door without re-fetching the linked transaction.
--   * pax_count                     — surface the guest count on the rider
--     and Rooms home-service cards.
--   * start_time                    — mirrors active_services/rooms so the
--     rider's My Deliveries page can show the same countdown the therapist
--     sees on Rooms.
--   * started_at / started_by       — audit trail for who tapped Start.
--   * completed_at / completed_by / completion_notes — completion audit.
--   * cancelled_at / cancelled_by / cancellation_reason — cancellation audit.
--   * pickup_requested_*            — therapist's Pasundo button stamps these;
--     a Supabase realtime listener on the rider device turns the transition
--     into a looping notification.
--
-- Safe to re-run: every statement uses IF NOT EXISTS. New columns default to
-- NULL — existing rows are not modified.
-- ============================================================================

-- Pricing surfaced on the rider card
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS service_price NUMERIC;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS total_amount  NUMERIC;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS pax_count     INTEGER;

-- Lifecycle stamps (mirrors rooms / active_services)
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS start_time          TIMESTAMPTZ;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS started_at          TIMESTAMPTZ;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS started_by          TEXT;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS completed_at        TIMESTAMPTZ;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS completed_by        TEXT;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS completion_notes    TEXT;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS cancelled_at        TIMESTAMPTZ;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS cancelled_by        TEXT;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Pasundo — therapist's pickup request fields
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS pickup_requested_at          TIMESTAMPTZ;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS pickup_requested_by          TEXT;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS pickup_requested_by_role     TEXT;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS pickup_requested_by_user_id  TEXT;

-- Rider acknowledgement — rider taps "On my way" on the pasundo card.
-- The therapist's Rooms card flips from "Pickup requested" (yellow) to
-- "Rider on the way" (green) when this is set, and a one-shot notification
-- fires to the therapist who originally tapped Pasundo.
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS pickup_acknowledged_at          TIMESTAMPTZ;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS pickup_acknowledged_by          TEXT;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS pickup_acknowledged_by_user_id  TEXT;

-- Rider completion — rider taps "Done" on the pasundo card after actually
-- picking the therapist up. Hides the card from the rider's active deliveries
-- (still visible under "Show completed") and flips the therapist's Rooms badge
-- to "Rider arrived".
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS pickup_completed_at          TIMESTAMPTZ;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS pickup_completed_by          TEXT;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS pickup_completed_by_user_id  TEXT;

-- Advance bookings also get the pickup fields — therapist may run the
-- service via an advance booking record (scheduled home service), not the
-- walk-in home_services row. The rider notification handler reads the
-- same field names on either source.
ALTER TABLE advance_bookings ADD COLUMN IF NOT EXISTS pickup_requested_at          TIMESTAMPTZ;
ALTER TABLE advance_bookings ADD COLUMN IF NOT EXISTS pickup_requested_by          TEXT;
ALTER TABLE advance_bookings ADD COLUMN IF NOT EXISTS pickup_requested_by_role     TEXT;
ALTER TABLE advance_bookings ADD COLUMN IF NOT EXISTS pickup_requested_by_user_id  TEXT;
ALTER TABLE advance_bookings ADD COLUMN IF NOT EXISTS pickup_acknowledged_at          TIMESTAMPTZ;
ALTER TABLE advance_bookings ADD COLUMN IF NOT EXISTS pickup_acknowledged_by          TEXT;
ALTER TABLE advance_bookings ADD COLUMN IF NOT EXISTS pickup_acknowledged_by_user_id  TEXT;

-- Live location tracking (Grab-style). While a pasundo is active each device
-- publishes its own GPS fix every ~15s to its row; the other side renders a
-- map with the two pins. Stops as soon as the pasundo is no longer active so
-- battery + privacy impact is bounded to the actual pickup window.
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS rider_current_lat          NUMERIC;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS rider_current_lng          NUMERIC;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS rider_location_updated_at  TIMESTAMPTZ;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS therapist_current_lat          NUMERIC;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS therapist_current_lng          NUMERIC;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS therapist_location_updated_at  TIMESTAMPTZ;

-- Optional index — only useful for "active pasundo" queries; skip if your
-- home-services row count stays small.
CREATE INDEX IF NOT EXISTS idx_home_services_pickup_pending
  ON home_services(pickup_requested_at)
  WHERE pickup_requested_at IS NOT NULL;


-- ============================================================================
-- BLOCK: supabase-transport-requests.sql
-- ============================================================================
-- ============================================================================
-- Transport requests ("Pahatid")
-- ----------------------------------------------------------------------------
-- Anyone in a branch (therapist, manager, receptionist, etc.) can request a
-- drop-off. Unlike Pasundo, which is tied to a specific home_service row and
-- means "come pick me up", Pahatid is a standalone request: "take me to <X>".
--
-- Notifications fan out to every Rider in the branch via the same posTriggers
-- machinery. The rider's My Deliveries page renders these alongside home
-- service pickups; ack + done are stamped on the same row.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.transport_requests (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id              UUID REFERENCES businesses(id) ON DELETE CASCADE,
  branch_id                UUID REFERENCES branches(id) ON DELETE SET NULL,

  -- Who asked
  requested_by_user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  requested_by_name        TEXT,
  requested_by_role        TEXT,

  -- Where + why
  pickup_address           TEXT,
  destination_address      TEXT NOT NULL,
  reason                   TEXT,

  -- Lifecycle
  status                   TEXT NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','acknowledged','completed','cancelled')),
  requested_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at          TIMESTAMPTZ,
  acknowledged_by          TEXT,
  acknowledged_by_user_id  UUID,
  completed_at             TIMESTAMPTZ,
  completed_by             TEXT,
  completed_by_user_id     UUID,
  cancelled_at             TIMESTAMPTZ,
  cancelled_by             TEXT,
  cancellation_reason      TEXT,

  -- Sync bookkeeping (mirrors home_services pattern)
  sync_status              VARCHAR(20) DEFAULT 'synced',
  deleted                  BOOLEAN DEFAULT FALSE,
  deleted_at               TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transport_requests_branch_status
  ON public.transport_requests(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_transport_requests_requested_at
  ON public.transport_requests(requested_at DESC);

ALTER TABLE public.transport_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Business isolation" ON public.transport_requests;
DROP POLICY IF EXISTS "Business isolation" ON public.transport_requests;
CREATE POLICY "Business isolation" ON public.transport_requests
  FOR ALL USING (business_id = (SELECT business_id FROM public.users WHERE auth_id = (SELECT auth.uid())));

-- Realtime: add to the supabase_realtime publication so the rider's device
-- gets new transport_requests rows live (no REST poll latency). REPLICA
-- IDENTITY FULL so UPDATE/DELETE deliver every column for cross-device
-- card updates (Confirm, Done, etc.). The ALTER PUBLICATION is wrapped in
-- a DO block because re-adding an already-published table raises an error
-- on Postgres; this makes the migration idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'transport_requests'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.transport_requests';
  END IF;
END $$;

ALTER TABLE public.transport_requests REPLICA IDENTITY FULL;


-- ============================================================================
-- BLOCK: supabase-update-password.sql
-- ============================================================================
-- ============================================================================
-- UPDATE AUTH USER PASSWORD RPC
-- ============================================================================
-- This function allows Owners/Managers to update staff passwords
-- via the Supabase Admin API. It runs as SECURITY DEFINER to access
-- auth.users, and validates that the caller is an Owner or Manager
-- in the same business as the target user.
-- ============================================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS update_auth_user_password(UUID, TEXT);

CREATE OR REPLACE FUNCTION update_auth_user_password(
  user_auth_id UUID,
  new_password TEXT
)
RETURNS JSON AS $$
DECLARE
  caller_role TEXT;
  caller_business_id UUID;
  target_business_id UUID;
BEGIN
  -- Get the caller's role and business
  SELECT role, business_id INTO caller_role, caller_business_id
  FROM users
  WHERE auth_id = auth.uid();

  -- Only Owners and Managers can update passwords
  IF caller_role NOT IN ('Owner', 'Manager') THEN
    RAISE EXCEPTION 'Unauthorized: only Owners and Managers can update passwords';
  END IF;

  -- Get the target user's business
  SELECT business_id INTO target_business_id
  FROM users
  WHERE auth_id = user_auth_id;

  IF target_business_id IS NULL THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  -- Ensure caller and target are in the same business
  IF caller_business_id != target_business_id THEN
    RAISE EXCEPTION 'Unauthorized: cannot update users from another business';
  END IF;

  -- Validate password length
  IF LENGTH(new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  -- Update the auth user's password
  UPDATE auth.users
  SET
    encrypted_password = crypt(new_password, gen_salt('bf')),
    updated_at = now()
  WHERE id = user_auth_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auth user not found';
  END IF;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_auth_user_password(UUID, TEXT) TO authenticated;


-- ============================================================================
-- BLOCK: supabase-update-branch-owner.sql
-- ============================================================================
-- =============================================================================
-- SQL Script: Allow updating Branch Owner profile when editing a branch
-- Run this in Supabase SQL Editor
-- =============================================================================

-- 1. Add RLS policy to allow Owner/Manager to update Branch Owner user profiles
-- This lets the main business owner update branch owner accounts via the Edit Branch modal

-- Drop existing update policy if it exists (safe to run multiple times)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'owners_can_update_branch_owner_profiles'
    AND tablename = 'users'
  ) THEN
    DROP POLICY "owners_can_update_branch_owner_profiles" ON users;
  END IF;
END $$;

-- Create policy: Owner and Manager roles can update user profiles in their business
DROP POLICY IF EXISTS "owners_can_update_branch_owner_profiles" ON users;
CREATE POLICY "owners_can_update_branch_owner_profiles" ON users
  FOR UPDATE
  USING (
    business_id IN (
      SELECT business_id FROM users WHERE auth_id = auth.uid()
    )
    AND (
      -- The current user must be Owner or Manager
      EXISTS (
        SELECT 1 FROM users
        WHERE auth_id = auth.uid()
        AND role IN ('Owner', 'Manager')
      )
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM users WHERE auth_id = auth.uid()
    )
    AND (
      EXISTS (
        SELECT 1 FROM users
        WHERE auth_id = auth.uid()
        AND role IN ('Owner', 'Manager')
      )
    )
  );

-- 2. Ensure Owner/Manager can SELECT branch owner profiles (needed to load owner data in edit modal)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'owners_can_view_business_users'
    AND tablename = 'users'
  ) THEN
    -- Policy already exists, skip
    RAISE NOTICE 'Policy owners_can_view_business_users already exists, skipping.';
  ELSE
    CREATE POLICY "owners_can_view_business_users" ON users
      FOR SELECT
      USING (
        business_id IN (
          SELECT business_id FROM users WHERE auth_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 3. Add updated_at trigger to users table if not exists
-- This automatically sets updated_at when a user profile is modified
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE users ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_users_updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS set_users_updated_at ON users;
CREATE TRIGGER set_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION update_users_updated_at();
  END IF;
END $$;

-- 4. Add unique constraint on email in users table to prevent duplicate accounts
-- This ensures one email can only be used once
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_email_unique'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
    RAISE NOTICE 'Added unique constraint on users.email';
  ELSE
    RAISE NOTICE 'Unique constraint users_email_unique already exists, skipping.';
  END IF;
END $$;

-- 5. Add unique constraint on username in users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_username_unique'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_username_unique UNIQUE (username);
    RAISE NOTICE 'Added unique constraint on users.username';
  ELSE
    RAISE NOTICE 'Unique constraint users_username_unique already exists, skipping.';
  END IF;
END $$;

-- =============================================================================
-- DONE!
-- This script enables:
-- - Owner/Manager can view all users in their business
-- - Owner/Manager can update Branch Owner profiles (name, email, username)
-- - Auto-updates the updated_at timestamp on user profile changes
-- - Unique constraint on email (prevents duplicate accounts)
-- - Unique constraint on username
-- =============================================================================


-- ============================================================================
-- BLOCK: supabase-settings-branch-scope.sql
-- ============================================================================
-- Per-branch settings migration
-- Adds branch_id to the settings table so feature settings (business hours,
-- tax, booking capacity/window, POS) can differ per branch. Branding keys
-- continue to use branch_id = NULL (business-wide).
--
-- Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS guards).
-- Requires Postgres 15+ for NULLS NOT DISTINCT.

BEGIN;

-- 1. Add the column (nullable — NULL means business-wide / branding).
ALTER TABLE settings
    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE;

-- 2. Drop the old unique constraint on (business_id, key).
ALTER TABLE settings
    DROP CONSTRAINT IF EXISTS settings_business_id_key_key;

-- 3. Add a new unique constraint that includes branch_id. NULLS NOT DISTINCT
--    makes two NULL branch_ids collide on upsert (required so the single
--    business-wide slot for branding keys doesn't produce duplicates).
--    PostgREST's on_conflict parameter accepts this constraint name directly.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'settings_business_branch_key_uniq'
          AND conrelid = 'settings'::regclass
    ) THEN
        ALTER TABLE settings
            ADD CONSTRAINT settings_business_branch_key_uniq
            UNIQUE NULLS NOT DISTINCT (business_id, branch_id, key);
    END IF;
END $$;

-- 4. RLS stays business-scoped — no branch-level RLS added here. Users who
--    can read the business already have access to every branch's rows; the
--    per-branch scoping is applied client-side by Settings.jsx.

COMMIT;


-- ============================================================================
-- BLOCK: supabase-branch-scope-phase3.sql
-- ============================================================================
-- Phase 3: add branch_id to the remaining per-branch-eligible tables.
-- Covers HR, payroll, cash drawer, gift cert, inventory, loyalty, activity log,
-- and active services so feature pages can scope those entities per branch.
--
-- All statements are idempotent. Each ALTER is wrapped in a table-existence
-- check so tables added in later migrations (HR request tables) don't cause
-- failures on environments where they don't exist yet.
--
-- Run this AFTER supabase-settings-branch-scope.sql.

BEGIN;

DO $$
DECLARE
    t TEXT;
    tables_with_branch TEXT[] := ARRAY[
        'inventory_movements',
        'stock_history',
        'product_consumption',
        'cash_drawer_sessions',
        'gift_certificates',
        'shift_schedules',
        'payroll_requests',
        'time_off_requests',
        'activity_logs',
        'loyalty_history',
        'active_services',
        'ot_requests',
        'leave_requests',
        'cash_advance_requests',
        'incident_reports'
    ];
BEGIN
    FOREACH t IN ARRAY tables_with_branch LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = t
        ) THEN
            -- Add branch_id column if missing
            EXECUTE format(
                'ALTER TABLE %I ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL',
                t
            );
            -- Index for efficient per-branch queries (partial — skip NULLs)
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS %I ON %I (branch_id) WHERE branch_id IS NOT NULL',
                t || '_branch_id_idx',
                t
            );
        END IF;
    END LOOP;
END $$;

COMMIT;


-- ============================================================================
-- BLOCK: supabase-suppliers-branch-scope.sql
-- ============================================================================
-- Add branch_id to suppliers so supplier records can be scoped per branch.
-- Without this, a supplier created in one branch leaks across every branch
-- under the same business. Idempotent — safe to re-run.
--
-- Run this AFTER supabase-branch-scope-phase3.sql.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'suppliers'
  ) THEN
    -- Add branch_id column if missing
    ALTER TABLE suppliers
      ADD COLUMN IF NOT EXISTS branch_id UUID
      REFERENCES branches(id) ON DELETE SET NULL;

    -- Partial index for fast per-branch queries (skip NULL legacy rows)
    CREATE INDEX IF NOT EXISTS suppliers_branch_id_idx
      ON suppliers (branch_id)
      WHERE branch_id IS NOT NULL;
  END IF;
END $$;

COMMIT;


-- ============================================================================
-- BLOCK: supabase-merge-duplicate-branches.sql
-- ============================================================================
-- ============================================================================
-- Merge duplicate branches  (Supabase SQL Editor friendly)
-- ----------------------------------------------------------------------------
-- WHY:
--   The original `branches` table had no uniqueness constraint on
--   (business_id, name). The "Add Branch" UI did a plain INSERT, so a second
--   "Test Branch" row could land beside the first with a different UUID.
--   POS would stamp records with one branchId while a Branch Owner / Rider
--   pointed at the other — the rider's strict per-branch filter then hid
--   every real record as "different branch".
--
-- HOW TO RUN (recommended path — single transaction auto-merge):
--   1. Take a manual database backup (Supabase Dashboard -> Database -> Backups).
--   2. Run STEP 1 to PREVIEW the dupe groups (read-only, safe to re-run).
--   3. Run STEP 2 — auto-merges every dupe group in one transaction. Oldest
--      row per (business_id, normalized_name) is kept as canonical; all
--      newer rows are merged into it and deleted.
--   4. Run STEP 3 to install the uniqueness guard so this can't recur.
--   5. Run STEP 4 to verify no orphan references remain.
--
-- SAFETY:
--   * STEP 1 and STEP 4 are read-only.
--   * STEP 2 runs inside one DO block (one transaction). If any single
--     UPDATE / DELETE fails (typo'd table, FK violation, missing column)
--     the whole merge rolls back — your data stays exactly as it was.
--   * STEP 2 is idempotent: re-running after a successful merge finds 0
--     dupe groups and is a no-op.
--   * STEP 5 (manual fallback) is included at the bottom for cases where
--     you want to pick a non-oldest UUID as canonical.
-- ============================================================================


-- ============================================================================
-- STEP 1 — Preview duplicates (read-only, safe to re-run)
-- ----------------------------------------------------------------------------
-- Run this FIRST. Confirm the groups look right before running STEP 2.
-- The "canonical_id_auto_will_keep" column is what STEP 2 will keep — the
-- oldest row by created_at. If you want to keep a different UUID, use the
-- manual fallback (STEP 5) instead of STEP 2.
-- ============================================================================
SELECT
  business_id,
  LOWER(TRIM(name))                            AS normalized_name,
  COUNT(*)                                     AS copies,
  ARRAY_AGG(name ORDER BY created_at)          AS names_as_stored,
  ARRAY_AGG(id ORDER BY created_at)            AS branch_ids,
  (ARRAY_AGG(id ORDER BY created_at))[1]       AS canonical_id_auto_will_keep,
  ARRAY_AGG(created_at ORDER BY created_at)    AS created_at_list
FROM branches
GROUP BY business_id, LOWER(TRIM(name))
HAVING COUNT(*) > 1
ORDER BY copies DESC, LOWER(TRIM(name));


-- ============================================================================
-- STEP 2 — Auto-merge every duplicate group (one transactional pass)
-- ----------------------------------------------------------------------------
-- One DO block, one transaction. For each (business_id, normalized_name)
-- group with >1 rows, picks the OLDEST id (by created_at) as canonical and
-- repoints every reference from the newer duplicates to that canonical id,
-- then deletes the now-orphaned duplicate branch rows.
--
-- Output: RAISE NOTICE lines per merge. Read them in the SQL Editor's
-- "Messages" / "Output" tab to confirm what happened.
-- ============================================================================
DO $$
DECLARE
  dupe_group   RECORD;
  canonical_id uuid;
  dupe_id      uuid;
  i            int;
  groups_seen  int := 0;
  merges_done  int := 0;
BEGIN
  FOR dupe_group IN
    SELECT
      business_id,
      LOWER(TRIM(name)) AS normalized_name,
      ARRAY_AGG(id ORDER BY created_at) AS branch_ids
    FROM branches
    GROUP BY business_id, LOWER(TRIM(name))
    HAVING COUNT(*) > 1
  LOOP
    groups_seen := groups_seen + 1;
    canonical_id := dupe_group.branch_ids[1];

    RAISE NOTICE 'Group "%": keeping % (oldest); merging % newer copy/copies into it',
      dupe_group.normalized_name,
      canonical_id,
      array_length(dupe_group.branch_ids, 1) - 1;

    FOR i IN 2..array_length(dupe_group.branch_ids, 1) LOOP
      dupe_id := dupe_group.branch_ids[i];
      RAISE NOTICE '  -> merging % into %', dupe_id, canonical_id;

      -- People & accounts
      UPDATE users        SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE employees    SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE customers    SET branch_id = canonical_id WHERE branch_id = dupe_id;

      -- Operational
      UPDATE rooms            SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE home_services    SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE advance_bookings SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE active_services  SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE transactions     SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE appointments     SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE notifications    SET branch_id = canonical_id WHERE branch_id = dupe_id;

      -- Attendance / HR
      UPDATE attendance            SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE shift_schedules       SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE time_off_requests     SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE cash_advance_requests SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE expense_requests      SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE incident_reports      SET branch_id = canonical_id WHERE branch_id = dupe_id;

      -- Inventory & money
      UPDATE products              SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE stock_movements       SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE product_consumption   SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE suppliers             SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE purchase_orders       SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE expenses              SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE gift_certificates     SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE cash_drawer_sessions  SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE cash_drawer_shifts    SET branch_id = canonical_id WHERE branch_id = dupe_id;

      -- Logs & history
      UPDATE activity_logs    SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE loyalty_history  SET branch_id = canonical_id WHERE branch_id = dupe_id;

      -- Finally drop the now-orphaned duplicate branch row.
      DELETE FROM branches WHERE id = dupe_id;
      merges_done := merges_done + 1;
    END LOOP;
  END LOOP;

  IF groups_seen = 0 THEN
    RAISE NOTICE 'No duplicate branch groups found — nothing to merge.';
  ELSE
    RAISE NOTICE 'Done. % dupe group(s) processed, % duplicate branch row(s) merged + deleted.',
      groups_seen, merges_done;
  END IF;
END $$;


-- ============================================================================
-- STEP 3 — Install the uniqueness guard (one-time)
-- ----------------------------------------------------------------------------
-- After every duplicate is merged, this partial unique index makes the DB
-- itself reject future duplicates at INSERT time. The app-level pre-check
-- in BranchesTab.jsx is the first line of defence; this is the
-- belt-and-suspenders backstop for direct SQL or migration writes.
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS branches_unique_business_name_idx
  ON branches (business_id, LOWER(TRIM(name)));


-- ============================================================================
-- STEP 4 — Verify no orphaned references remain (read-only)
-- ----------------------------------------------------------------------------
-- Expected: zero rows. Any row returned means STEP 2 missed a table — add
-- the table to the DO block above and re-run STEP 2.
-- ============================================================================
SELECT 'users' AS table_name, id::text AS row_id, branch_id FROM users u
WHERE branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM branches b WHERE b.id = u.branch_id)
UNION ALL
SELECT 'employees', id::text, branch_id FROM employees e
WHERE branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM branches b WHERE b.id = e.branch_id)
UNION ALL
SELECT 'home_services', id::text, branch_id FROM home_services h
WHERE branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM branches b WHERE b.id = h.branch_id)
UNION ALL
SELECT 'transactions', id::text, branch_id FROM transactions t
WHERE branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM branches b WHERE b.id = t.branch_id)
UNION ALL
SELECT 'advance_bookings', id::text, branch_id FROM advance_bookings a
WHERE branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM branches b WHERE b.id = a.branch_id)
UNION ALL
SELECT 'rooms', id::text, branch_id FROM rooms r
WHERE branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM branches b WHERE b.id = r.branch_id);


-- ============================================================================
-- STEP 5 — MANUAL FALLBACK: merge a single pair when you want non-oldest canonical
-- ----------------------------------------------------------------------------
-- Use this ONLY if you need to keep a specific UUID as canonical that is
-- NOT the oldest in the group (e.g. the older row has stale settings and
-- the newer one is the "real" branch row). Otherwise use STEP 2.
-- ============================================================================
-- DO $$
-- DECLARE
--   canonical_id uuid := 'REPLACE_WITH_CANONICAL_UUID';
--   dupe_id      uuid := 'REPLACE_WITH_DUPE_UUID';
--   v_canonical_business uuid;
--   v_dupe_business      uuid;
-- BEGIN
--   SELECT business_id INTO v_canonical_business FROM branches WHERE id = canonical_id;
--   SELECT business_id INTO v_dupe_business      FROM branches WHERE id = dupe_id;
--   IF v_canonical_business IS NULL THEN
--     RAISE EXCEPTION 'Canonical branch % not found', canonical_id;
--   END IF;
--   IF v_dupe_business IS NULL THEN
--     RAISE EXCEPTION 'Dupe branch % not found', dupe_id;
--   END IF;
--   IF v_canonical_business <> v_dupe_business THEN
--     RAISE EXCEPTION 'Refusing to merge across businesses';
--   END IF;
--   IF canonical_id = dupe_id THEN
--     RAISE EXCEPTION 'canonical_id and dupe_id are the same';
--   END IF;
--
--   UPDATE users        SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE employees    SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE customers    SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE rooms        SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE home_services SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE advance_bookings SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE active_services  SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE transactions     SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE appointments     SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE notifications    SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE attendance            SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE shift_schedules       SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE time_off_requests     SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE cash_advance_requests SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE expense_requests      SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE incident_reports      SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE products              SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE stock_movements       SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE product_consumption   SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE suppliers             SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE purchase_orders       SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE expenses              SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE gift_certificates     SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE cash_drawer_sessions  SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE cash_drawer_shifts    SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE activity_logs    SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE loyalty_history  SET branch_id = canonical_id WHERE branch_id = dupe_id;
--
--   DELETE FROM branches WHERE id = dupe_id;
--   RAISE NOTICE 'Manual merge done: % -> %', dupe_id, canonical_id;
-- END $$;


-- ============================================================================
-- MIGRATION: 20260501120000_create_payment_intents.sql
-- ============================================================================
-- AVADAETSPA/supabase/migrations/20260501120000_create_payment_intents.sql

CREATE TABLE payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  branch_id UUID NOT NULL,

  source_type TEXT NOT NULL CHECK (source_type IN ('pos_transaction', 'advance_booking')),
  source_id TEXT NOT NULL,

  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'PHP',
  payment_method TEXT NOT NULL DEFAULT 'qrph',

  nextpay_intent_id TEXT UNIQUE,
  nextpay_qr_string TEXT,
  nextpay_qr_image_url TEXT,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','awaiting_payment','succeeded','failed','expired','cancelled')),

  reference_code TEXT NOT NULL,
  nextpay_payload JSONB,

  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ
);

CREATE INDEX idx_payment_intents_source ON payment_intents(source_type, source_id);
CREATE INDEX idx_payment_intents_status ON payment_intents(status);
CREATE INDEX idx_payment_intents_branch_created ON payment_intents(branch_id, created_at DESC);

-- RLS: read scoped to user's branch; writes only via service role (Edge Functions)
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;

-- Read scope: user can read intents for their branch, OR all branches in their
-- business if their role is Owner. Writes are service-role only (Edge Functions).
-- The codebase stores a single branch_id directly on the `users` table and links
-- to Supabase Auth via the auth_id column (see authService.ts:_loadUserProfile).
DROP POLICY IF EXISTS "read own branch intents" ON payment_intents;
CREATE POLICY "read own branch intents" ON payment_intents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.business_id = payment_intents.business_id
        AND (u.role = 'Owner' OR u.branch_id = payment_intents.branch_id)
    )
  );

-- Realtime publication
DO $pubadd$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'payment_intents') THEN ALTER PUBLICATION supabase_realtime ADD TABLE payment_intents; END IF; END $pubadd$;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION set_payment_intents_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payment_intents_updated_at ON payment_intents;
CREATE TRIGGER payment_intents_updated_at
  BEFORE UPDATE ON payment_intents
  FOR EACH ROW EXECUTE FUNCTION set_payment_intents_updated_at();


-- ============================================================================
-- MIGRATION: 20260501120100_extend_transactions_bookings.sql
-- ============================================================================
-- AVADAETSPA/supabase/migrations/20260501120100_extend_transactions_bookings.sql
-- Extends existing tables to link to payment_intents for QRPh flows.
--
-- Reuses existing columns where possible:
--   - transactions.payment_method already exists; 'QRPh' is added as a new
--     allowed value at the application layer (no DB constraint to alter).
--   - advance_bookings.payment_status already exists with values like
--     'unpaid', 'deposit_paid', 'fully_paid'. The QRPh full-prepay flow sets
--     payment_status='fully_paid' on webhook success, reusing existing semantics.
--
-- Only the new FK column is added: payment_intent_id (links each row to its
-- gateway intent for audit, reconciliation, and refund lookups).

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS payment_intent_id UUID REFERENCES payment_intents(id);

ALTER TABLE advance_bookings
  ADD COLUMN IF NOT EXISTS payment_intent_id UUID REFERENCES payment_intents(id);


-- ============================================================================
-- MIGRATION: 20260501120200_payment_intents_cleanup.sql
-- ============================================================================
-- AVADAETSPA/supabase/migrations/20260501120200_payment_intents_cleanup.sql
--
-- Marks 'awaiting_payment' intents that have passed their expires_at as
-- 'expired', and cascades the cancellation to advance_bookings (full prepay).
-- POS transactions stay 'pending' so the cashier can fall back to cash.
--
-- Runs every 5 minutes via pg_cron. Requires the pg_cron extension to be
-- enabled on the Supabase project (Database → Extensions → search 'pg_cron').

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION expire_stale_payment_intents() RETURNS void AS $$
BEGIN
  WITH expired AS (
    UPDATE payment_intents
       SET status = 'expired'
     WHERE status = 'awaiting_payment'
       AND expires_at < NOW()
    RETURNING id, source_type, source_id
  )
  UPDATE advance_bookings ab
     SET status = 'cancelled',
         payment_status = 'unpaid'
    FROM expired e
   WHERE e.source_type = 'advance_booking'
     AND e.source_id = ab.id::text;
END;
$$ LANGUAGE plpgsql;

-- Schedule: every 5 minutes. Idempotent if the job already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'expire-payment-intents'
  ) THEN
    PERFORM cron.schedule(
      'expire-payment-intents',
      '*/5 * * * *',
      $cron$SELECT expire_stale_payment_intents();$cron$
    );
  END IF;
END $$;


-- ============================================================================
-- MIGRATION: 20260502120000_create_disbursements.sql
-- ============================================================================
-- AVADAETSPA/supabase/migrations/20260502120000_create_disbursements.sql
--
-- Phase 2: outbound disbursements via NextPay's POST /v2/disbursements.
-- One row per disbursement (which can carry multiple recipients in NextPay,
-- but we store one row per (source_type, source_id, recipient) so the
-- per-recipient cascade to payroll_requests / purchase_orders / expenses
-- is unambiguous on webhook receipt.

CREATE TABLE disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  branch_id UUID,                                     -- nullable: payroll is org-wide

  source_type TEXT NOT NULL CHECK (
    source_type IN ('payroll_request', 'purchase_order', 'expense')
  ),
  source_id TEXT NOT NULL,

  recipient_name TEXT NOT NULL,
  recipient_first_name TEXT,
  recipient_last_name TEXT,
  recipient_email TEXT,
  recipient_phone TEXT,
  recipient_bank_code INTEGER NOT NULL,               -- NextPay bank-code enum
  recipient_account_number TEXT NOT NULL,
  recipient_account_name TEXT NOT NULL,
  recipient_method TEXT NOT NULL DEFAULT 'instapay',  -- instapay | pesonet | …

  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'PHP',

  nextpay_disbursement_id TEXT UNIQUE,
  nextpay_reference_id TEXT,
  nextpay_payload JSONB,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','submitted','succeeded','failed','cancelled')),
  failure_reason TEXT,

  reference_code TEXT NOT NULL,
  notes TEXT,

  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ
);

CREATE INDEX idx_disbursements_source ON disbursements(source_type, source_id);
CREATE INDEX idx_disbursements_status ON disbursements(status);
CREATE INDEX idx_disbursements_branch_created ON disbursements(branch_id, created_at DESC);

ALTER TABLE disbursements ENABLE ROW LEVEL SECURITY;

-- Read scope mirrors payment_intents: Owner sees the whole business; everyone
-- else sees their own branch. NULL branch_id rows (payroll, which is
-- org-wide) are visible to everyone in the business so accountants can
-- reconcile across branches.
DROP POLICY IF EXISTS "read disbursements scoped" ON disbursements;
CREATE POLICY "read disbursements scoped" ON disbursements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.business_id = disbursements.business_id
        AND (
          u.role = 'Owner'
          OR u.branch_id IS NOT DISTINCT FROM disbursements.branch_id
          OR disbursements.branch_id IS NULL
        )
    )
  );

DO $pubadd$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'disbursements') THEN ALTER PUBLICATION supabase_realtime ADD TABLE disbursements; END IF; END $pubadd$;

CREATE OR REPLACE FUNCTION set_disbursements_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS disbursements_updated_at ON disbursements;
CREATE TRIGGER disbursements_updated_at
  BEFORE UPDATE ON disbursements
  FOR EACH ROW EXECUTE FUNCTION set_disbursements_updated_at();


-- ============================================================================
-- MIGRATION: 20260502120100_extend_payroll_po_expense.sql
-- ============================================================================
-- AVADAETSPA/supabase/migrations/20260502120100_extend_payroll_po_expense.sql
--
-- Phase 2: link the three reimbursable source rows to their disbursement
-- attempt for audit + reconciliation. The cascade on success (status=paid /
-- reimbursed, paid_at/reimbursed_at) happens in the nextpay-webhook
-- handler — these are just the FK columns it needs to write.

ALTER TABLE payroll_requests
  ADD COLUMN IF NOT EXISTS disbursement_id UUID REFERENCES disbursements(id);

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS disbursement_id UUID REFERENCES disbursements(id);

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS disbursement_id UUID REFERENCES disbursements(id);


-- ============================================================================
-- MIGRATION: 20260502120200_employee_supplier_payout_fields.sql
-- ============================================================================
-- AVADAETSPA/supabase/migrations/20260502120200_employee_supplier_payout_fields.sql
--
-- Phase 2: persist payout destination on the recipient row so the operator
-- doesn't re-enter bank details every payroll cycle / supplier payment.
-- For expense reimbursements the destination is captured at approval time
-- (one-shot, not stored on the user) — so this migration touches only
-- employees and suppliers.

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS payout_bank_code INTEGER,
  ADD COLUMN IF NOT EXISTS payout_account_number TEXT,
  ADD COLUMN IF NOT EXISTS payout_account_name TEXT,
  ADD COLUMN IF NOT EXISTS payout_method TEXT DEFAULT 'instapay';

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS payout_bank_code INTEGER,
  ADD COLUMN IF NOT EXISTS payout_account_number TEXT,
  ADD COLUMN IF NOT EXISTS payout_account_name TEXT,
  ADD COLUMN IF NOT EXISTS payout_method TEXT DEFAULT 'instapay';


-- ============================================================================
-- MIGRATION: 20260502130000_schedule_poll_disbursements.sql
-- ============================================================================
-- AVADAETSPA/supabase/migrations/20260502130000_schedule_poll_disbursements.sql
--
-- Schedules pg_cron to call the poll-disbursements Edge Function every
-- minute. NextPay's webhooks (Private Beta) do not yet ship the
-- disbursement.* events, so polling is how we learn that a submitted
-- disbursement settled.
--
-- This migration was applied to thyexktqknzqnjlnzdmv on 2026-05-02 in
-- three steps via Supabase MCP (apply_migration):
--   1. enable_pg_net_for_cron_http
--   2. store_poll_cron_secret_placeholder
--   3. schedule_poll_disbursements_every_minute
--
-- Operator follow-up (one-shot, after applying):
--
--   UPDATE vault.secrets
--      SET secret = '<the-actual-POLL_CRON_SECRET-value>'
--    WHERE name = 'poll_cron_secret';
--
-- (The same value should be set as the POLL_CRON_SECRET Supabase Edge
-- Function secret so the function checks the inbound header against the
-- same string.)

CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'poll_cron_secret') THEN
    PERFORM vault.create_secret(
      'PLACEHOLDER_REPLACE_ME',
      'poll_cron_secret',
      'Auth secret pg_cron passes as X-Cron-Secret to poll-disbursements'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'poll-disbursements-every-minute'
  ) THEN
    PERFORM cron.schedule(
      'poll-disbursements-every-minute',
      '* * * * *',
      $cron$
      SELECT net.http_post(
        url     := 'https://thyexktqknzqnjlnzdmv.supabase.co/functions/v1/poll-disbursements',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'poll_cron_secret')
        ),
        body    := '{}'::jsonb
      ) AS request_id;
      $cron$
    );
  END IF;
END $$;


-- ============================================================================
-- MIGRATION: 20260503100607_extend_disbursements_for_cash_advance_and_po_payment_status.sql
-- ============================================================================
-- Phase A: cash_advance as a valid disbursement source_type
ALTER TABLE disbursements
  DROP CONSTRAINT disbursements_source_type_check,
  ADD CONSTRAINT disbursements_source_type_check CHECK (
    source_type IN ('payroll_request', 'purchase_order', 'expense', 'cash_advance')
  );

ALTER TABLE cash_advance_requests
  ADD COLUMN IF NOT EXISTS disbursement_id UUID REFERENCES disbursements(id),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_by UUID;

-- Phase B: PO payment_status (independent of order status)
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','paid')),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_by UUID;

CREATE INDEX IF NOT EXISTS idx_po_payment_status
  ON purchase_orders(business_id, payment_status);


-- ============================================================================
-- MIGRATION: 20260503101500_disbursements_partial_unique_active_source.sql
-- ============================================================================
-- Partial unique index — closes the race window in create-disbursement's
-- application-level idempotency SELECT+INSERT. With this in place, the
-- second concurrent insert errors with a unique-violation that the function
-- surfaces as HTTP 400 (via the existing insertErr path).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_disbursements_active_source
  ON disbursements (source_type, source_id)
  WHERE status IN ('pending', 'submitted', 'succeeded');


-- ============================================================================
-- MIGRATION: 20260503123132_create_saved_reports.sql
-- ============================================================================
CREATE TABLE saved_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  branch_id UUID,
  branch_name TEXT,

  period TEXT NOT NULL,
  period_label TEXT NOT NULL,
  period_key TEXT NOT NULL,

  saved_by_user_id UUID,
  saved_by_name TEXT,

  data JSONB NOT NULL,
  manual JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saved_reports_business_created
  ON saved_reports(business_id, created_at DESC);
CREATE INDEX idx_saved_reports_branch
  ON saved_reports(branch_id);

ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read saved_reports same business" ON saved_reports;
CREATE POLICY "read saved_reports same business" ON saved_reports
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.business_id = saved_reports.business_id
    )
  );

DROP POLICY IF EXISTS "insert saved_reports same business" ON saved_reports;
CREATE POLICY "insert saved_reports same business" ON saved_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.business_id = saved_reports.business_id
    )
  );

DROP POLICY IF EXISTS "delete saved_reports creator or owner" ON saved_reports;
CREATE POLICY "delete saved_reports creator or owner" ON saved_reports
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.business_id = saved_reports.business_id
        AND (u.id = saved_reports.saved_by_user_id OR u.role = 'Owner')
    )
  );

DO $pubadd$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'saved_reports') THEN ALTER PUBLICATION supabase_realtime ADD TABLE saved_reports; END IF; END $pubadd$;


-- ============================================================================
-- MIGRATION: 20260503132840_create_saved_payrolls.sql
-- ============================================================================
CREATE TABLE saved_payrolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  branch_id UUID,
  branch_name TEXT,

  period_label TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_type TEXT,

  saved_by_user_id UUID,
  saved_by_name TEXT,

  rows JSONB NOT NULL,
  summary JSONB NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saved_payrolls_business_created
  ON saved_payrolls(business_id, created_at DESC);
CREATE INDEX idx_saved_payrolls_branch
  ON saved_payrolls(branch_id);
CREATE INDEX idx_saved_payrolls_period
  ON saved_payrolls(business_id, period_start, period_end);

ALTER TABLE saved_payrolls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read saved_payrolls same business" ON saved_payrolls;
CREATE POLICY "read saved_payrolls same business" ON saved_payrolls
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.business_id = saved_payrolls.business_id
    )
  );

DROP POLICY IF EXISTS "insert saved_payrolls same business" ON saved_payrolls;
CREATE POLICY "insert saved_payrolls same business" ON saved_payrolls
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.business_id = saved_payrolls.business_id
    )
  );

DROP POLICY IF EXISTS "delete saved_payrolls creator or owner" ON saved_payrolls;
CREATE POLICY "delete saved_payrolls creator or owner" ON saved_payrolls
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.business_id = saved_payrolls.business_id
        AND (u.id = saved_payrolls.saved_by_user_id OR u.role = 'Owner')
    )
  );

DO $pubadd$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'saved_payrolls') THEN ALTER PUBLICATION supabase_realtime ADD TABLE saved_payrolls; END IF; END $pubadd$;


-- ============================================================================
-- MIGRATION: 20260504000000_fix_void_status_and_transaction_id_types.sql
-- ============================================================================
-- Bug 1: app uses status='voided' but DB CHECK only allowed 'void'.
-- Add 'voided' as a valid status; keeps existing 'void' rows untouched.
ALTER TABLE transactions
  DROP CONSTRAINT transactions_status_check,
  ADD CONSTRAINT transactions_status_check CHECK (
    status IN ('completed','pending','cancelled','refunded','void','voided')
  );

-- Bug 2: home_services.transaction_id and product_consumption.transaction_id
-- were declared UUID, but the app stores receipt-number strings like
-- "RCP-20260505-93823458" there (matching the rooms + advance_bookings
-- convention which uses VARCHAR/TEXT). Convert both to TEXT.
ALTER TABLE home_services
  ALTER COLUMN transaction_id TYPE TEXT USING transaction_id::text;

ALTER TABLE product_consumption
  ALTER COLUMN transaction_id TYPE TEXT USING transaction_id::text;


-- ============================================================================
-- MIGRATION: 20260506000000_add_upgrade_history_to_transactions.sql
-- ============================================================================
-- Track service upgrades performed on a transaction after checkout (e.g. when a
-- room operator swaps the in-progress service for a more expensive one). Each
-- entry captures the from/to service names, the price delta, who did it, and
-- when, so Service History can render an "upgraded from X to Y" annotation.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS upgrade_history JSONB;


-- ============================================================================
-- MIGRATION: 20260506100000_cash_drawer_multi_cashier.sql
-- ============================================================================
-- =====================================================
-- Multi-cashier drawer model
-- =====================================================
-- Splits the existing single-session-per-cashier model into:
--   * cash_drawer_sessions = the physical drawer for one business day at a branch
--   * cash_drawer_shifts   = each cashier's portion of that drawer day
--
-- Adds cashier identity (cashier_id, shift_id) to transactions so reports can
-- break down sales by who rang them up — distinct from employee_id (the
-- therapist who delivered the service).
-- =====================================================

-- 1) Extend cash_drawer_sessions for the new drawer-day shape ----------------
ALTER TABLE cash_drawer_sessions
    ADD COLUMN IF NOT EXISTS user_name TEXT,
    ADD COLUMN IF NOT EXISTS user_role TEXT,
    ADD COLUMN IF NOT EXISTS opened_by UUID,
    ADD COLUMN IF NOT EXISTS opened_by_name TEXT,
    ADD COLUMN IF NOT EXISTS closed_by UUID,
    ADD COLUMN IF NOT EXISTS closed_by_name TEXT,
    ADD COLUMN IF NOT EXISTS open_date DATE,
    ADD COLUMN IF NOT EXISTS opening_float DECIMAL(12,2),
    ADD COLUMN IF NOT EXISTS expected_cash DECIMAL(12,2),
    ADD COLUMN IF NOT EXISTS actual_cash DECIMAL(12,2),
    ADD COLUMN IF NOT EXISTS variance DECIMAL(12,2);

CREATE INDEX IF NOT EXISTS idx_cash_drawer_sessions_branch_status
    ON cash_drawer_sessions(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_cash_drawer_sessions_open_date
    ON cash_drawer_sessions(open_date);

-- Backfill the new columns from existing data so legacy rows stay queryable.
UPDATE cash_drawer_sessions
SET
    open_date     = COALESCE(open_date, (open_time AT TIME ZONE 'UTC')::date),
    opening_float = COALESCE(opening_float, opening_balance),
    expected_cash = COALESCE(expected_cash, expected_balance),
    actual_cash   = COALESCE(actual_cash, closing_balance),
    variance      = COALESCE(variance, difference),
    opened_by     = COALESCE(opened_by, user_id)
WHERE open_date IS NULL OR opening_float IS NULL;

-- 2) cash_drawer_shifts table ------------------------------------------------
CREATE TABLE IF NOT EXISTS cash_drawer_shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    session_id UUID REFERENCES cash_drawer_sessions(id) ON DELETE CASCADE,
    branch_id UUID,
    user_id UUID,
    user_name TEXT,
    user_role TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    start_count DECIMAL(12,2) DEFAULT 0,
    end_count DECIMAL(12,2),
    cash_sales DECIMAL(12,2) DEFAULT 0,
    variance DECIMAL(12,2),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
    notes TEXT,
    sync_status TEXT DEFAULT 'synced',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_drawer_shifts_session
    ON cash_drawer_shifts(session_id);
CREATE INDEX IF NOT EXISTS idx_cash_drawer_shifts_user
    ON cash_drawer_shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_cash_drawer_shifts_branch_status
    ON cash_drawer_shifts(branch_id, status);

-- Only one active shift per session at a time (enforce on the server too).
CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_drawer_shifts_one_active
    ON cash_drawer_shifts(session_id)
    WHERE status = 'active';

ALTER TABLE cash_drawer_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Business isolation" ON cash_drawer_shifts;
CREATE POLICY "Business isolation"
    ON cash_drawer_shifts
    FOR ALL
    USING (business_id = get_user_business_id());

-- 3) Tag transactions with cashier identity ----------------------------------
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS cashier_id UUID,
    ADD COLUMN IF NOT EXISTS cashier_name TEXT,
    ADD COLUMN IF NOT EXISTS shift_id UUID,
    ADD COLUMN IF NOT EXISTS drawer_session_id UUID;

CREATE INDEX IF NOT EXISTS idx_transactions_cashier
    ON transactions(cashier_id);
CREATE INDEX IF NOT EXISTS idx_transactions_shift
    ON transactions(shift_id);
CREATE INDEX IF NOT EXISTS idx_transactions_drawer_session
    ON transactions(drawer_session_id);


-- ============================================================================
-- MIGRATION: 20260506140000_drop_redundant_permissive_rls_policies.sql
-- ============================================================================
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


-- ============================================================================
-- MIGRATION: 20260506140100_wrap_auth_uid_in_initplan_subselect.sql
-- ============================================================================
-- Replace bare auth.uid() / (auth.uid())::text with (select auth.uid()) inside RLS policy bodies
-- so Postgres caches the call as an InitPlan instead of re-evaluating per row.
-- Each policy is dropped and recreated with the original predicate intact.

-- 1. public.users / "Insert users" (INSERT, authenticated)
DROP POLICY IF EXISTS "Insert users" ON public.users;
DROP POLICY IF EXISTS "Insert users" ON public.users;
CREATE POLICY "Insert users" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (
    ((auth_id)::text = ((select auth.uid()))::text)
    OR (
      ((business_id)::text = (get_current_user_business_id())::text)
      AND (get_current_user_role() = ANY (ARRAY['Owner'::text, 'Manager'::text, 'Branch Owner'::text]))
    )
  );

-- 2. public.payment_intents / "read own branch intents" (SELECT, authenticated)
DROP POLICY IF EXISTS "read own branch intents" ON public.payment_intents;
DROP POLICY IF EXISTS "read own branch intents" ON public.payment_intents;
CREATE POLICY "read own branch intents" ON public.payment_intents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.auth_id = (select auth.uid())
        AND u.business_id = payment_intents.business_id
        AND ((u.role)::text = 'Owner'::text OR u.branch_id = payment_intents.branch_id)
    )
  );

-- 3. public.users / "owners_can_update_branch_owner_profiles" (UPDATE, public)
DROP POLICY IF EXISTS "owners_can_update_branch_owner_profiles" ON public.users;
DROP POLICY IF EXISTS "owners_can_update_branch_owner_profiles" ON public.users;
CREATE POLICY "owners_can_update_branch_owner_profiles" ON public.users
  FOR UPDATE TO public
  USING (
    business_id = get_user_business_id()
    AND EXISTS (
      SELECT 1
      FROM users users_1
      WHERE users_1.auth_id = (select auth.uid())
        AND (users_1.role)::text = ANY ((ARRAY['Owner'::character varying, 'Manager'::character varying])::text[])
    )
  )
  WITH CHECK (
    business_id = get_user_business_id()
    AND EXISTS (
      SELECT 1
      FROM users users_1
      WHERE users_1.auth_id = (select auth.uid())
        AND (users_1.role)::text = ANY ((ARRAY['Owner'::character varying, 'Manager'::character varying])::text[])
    )
  );

-- 4. public.disbursements / "read disbursements scoped" (SELECT, authenticated)
DROP POLICY IF EXISTS "read disbursements scoped" ON public.disbursements;
DROP POLICY IF EXISTS "read disbursements scoped" ON public.disbursements;
CREATE POLICY "read disbursements scoped" ON public.disbursements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.auth_id = (select auth.uid())
        AND u.business_id = disbursements.business_id
        AND (
          (u.role)::text = 'Owner'::text
          OR NOT (u.branch_id IS DISTINCT FROM disbursements.branch_id)
          OR disbursements.branch_id IS NULL
        )
    )
  );

-- 5. public.saved_reports / "read saved_reports same business" (SELECT, authenticated)
DROP POLICY IF EXISTS "read saved_reports same business" ON public.saved_reports;
DROP POLICY IF EXISTS "read saved_reports same business" ON public.saved_reports;
CREATE POLICY "read saved_reports same business" ON public.saved_reports
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.auth_id = (select auth.uid())
        AND u.business_id = saved_reports.business_id
    )
  );

-- 6. public.saved_reports / "insert saved_reports same business" (INSERT, authenticated)
DROP POLICY IF EXISTS "insert saved_reports same business" ON public.saved_reports;
DROP POLICY IF EXISTS "insert saved_reports same business" ON public.saved_reports;
CREATE POLICY "insert saved_reports same business" ON public.saved_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.auth_id = (select auth.uid())
        AND u.business_id = saved_reports.business_id
    )
  );

-- 7. public.saved_reports / "delete saved_reports creator or owner" (DELETE, authenticated)
DROP POLICY IF EXISTS "delete saved_reports creator or owner" ON public.saved_reports;
DROP POLICY IF EXISTS "delete saved_reports creator or owner" ON public.saved_reports;
CREATE POLICY "delete saved_reports creator or owner" ON public.saved_reports
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.auth_id = (select auth.uid())
        AND u.business_id = saved_reports.business_id
        AND (u.id = saved_reports.saved_by_user_id OR (u.role)::text = 'Owner'::text)
    )
  );

-- 8. public.saved_payrolls / "read saved_payrolls same business" (SELECT, authenticated)
DROP POLICY IF EXISTS "read saved_payrolls same business" ON public.saved_payrolls;
DROP POLICY IF EXISTS "read saved_payrolls same business" ON public.saved_payrolls;
CREATE POLICY "read saved_payrolls same business" ON public.saved_payrolls
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.auth_id = (select auth.uid())
        AND u.business_id = saved_payrolls.business_id
    )
  );

-- 9. public.saved_payrolls / "insert saved_payrolls same business" (INSERT, authenticated)
DROP POLICY IF EXISTS "insert saved_payrolls same business" ON public.saved_payrolls;
DROP POLICY IF EXISTS "insert saved_payrolls same business" ON public.saved_payrolls;
CREATE POLICY "insert saved_payrolls same business" ON public.saved_payrolls
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.auth_id = (select auth.uid())
        AND u.business_id = saved_payrolls.business_id
    )
  );

-- 10. public.saved_payrolls / "delete saved_payrolls creator or owner" (DELETE, authenticated)
DROP POLICY IF EXISTS "delete saved_payrolls creator or owner" ON public.saved_payrolls;
DROP POLICY IF EXISTS "delete saved_payrolls creator or owner" ON public.saved_payrolls;
CREATE POLICY "delete saved_payrolls creator or owner" ON public.saved_payrolls
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.auth_id = (select auth.uid())
        AND u.business_id = saved_payrolls.business_id
        AND (u.id = saved_payrolls.saved_by_user_id OR (u.role)::text = 'Owner'::text)
    )
  );


-- ============================================================================
-- MIGRATION: 20260506140200_add_covering_indexes_for_unindexed_fks.sql
-- ============================================================================
-- Add covering indexes for foreign keys that lacked one. Improves performance of joins,
-- cascading deletes, and FK constraint checks. All idempotent via IF NOT EXISTS.

CREATE INDEX IF NOT EXISTS idx_advance_bookings_payment_intent_id
  ON public.advance_bookings (payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_cash_advance_requests_disbursement_id
  ON public.cash_advance_requests (disbursement_id);

CREATE INDEX IF NOT EXISTS idx_cash_drawer_shifts_business_id
  ON public.cash_drawer_shifts (business_id);

CREATE INDEX IF NOT EXISTS idx_expenses_disbursement_id
  ON public.expenses (disbursement_id);

CREATE INDEX IF NOT EXISTS idx_payroll_requests_disbursement_id
  ON public.payroll_requests (disbursement_id);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_disbursement_id
  ON public.purchase_orders (disbursement_id);

CREATE INDEX IF NOT EXISTS idx_settings_branch_id
  ON public.settings (branch_id);

CREATE INDEX IF NOT EXISTS idx_transactions_payment_intent_id
  ON public.transactions (payment_intent_id);


-- ============================================================================
-- MIGRATION: 20260506150000_expand_realtime_publication_for_event_driven_sync.sql
-- ============================================================================
-- Add the 20 remaining syncable tables to supabase_realtime so the client can
-- replace its 5-minute REST polling fallback with realtime subscriptions.
-- REPLICA IDENTITY FULL is set so UPDATE/DELETE payloads include every column
-- (Supabase realtime needs this to deliver the full `old` record).

-- Per-table conditional add + REPLICA IDENTITY. Re-runs don't error on
-- already-published tables. Tables that aren't created by this setup file
-- (ot_requests, leave_requests, cash_advance_requests, incident_reports —
-- legacy ad-hoc tables from the original project) are silently skipped.
DO $pubadd$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'business_config','cash_drawer_sessions','cash_drawer_shifts',
    'gift_certificates','purchase_orders','attendance','shift_schedules',
    'payroll_requests','payroll_config','time_off_requests','ot_requests',
    'leave_requests','cash_advance_requests','incident_reports',
    'advance_bookings','active_services','suppliers','service_rotation',
    'home_services','loyalty_history'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    END IF;
  END LOOP;
END $pubadd$;


-- ============================================================================
-- MIGRATION: 20260506160000_add_deducted_columns_to_cash_advance_requests.sql
-- ============================================================================
-- Track when an approved cash advance has been deducted from a payroll run.
-- A NULL deducted_at means the advance is approved but pending deduction in
-- the next payroll. Once a payroll is saved that includes the advance, both
-- columns are populated so the advance is not deducted again.

ALTER TABLE public.cash_advance_requests
  ADD COLUMN IF NOT EXISTS deducted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS deducted_in_payroll_id UUID NULL REFERENCES public.saved_payrolls(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cash_advance_requests_employee_undeducted
  ON public.cash_advance_requests (employee_id)
  WHERE status = 'approved' AND deducted_at IS NULL;


-- ============================================================================
-- MIGRATION: 20260509120000_create_push_subscriptions.sql
-- ============================================================================
-- Web Push subscriptions: one row per (user, browser endpoint).
--
-- The notify-push Edge Function reads from this table with the service
-- role and fans Web Push messages out to every matching subscription.
-- The frontend writes here via the user's anon-key session so RLS scopes
-- the row to that user.
--
-- The endpoint URL is the natural unique key — re-running subscribe()
-- on the same browser hits ON CONFLICT (endpoint) and refreshes the
-- last_seen_at + user_id mapping (handy when a different employee logs
-- in on a shared terminal).

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  branch_id    uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  endpoint     text NOT NULL UNIQUE,
  p256dh       text NOT NULL,
  auth         text NOT NULL,
  device_label text,
  user_agent   text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS push_subscriptions_branch_id_idx
  ON public.push_subscriptions(branch_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- A user can see / write only their own subscriptions. The notify-push
-- Edge Function uses the service role and bypasses RLS, so it sees all
-- rows regardless of these policies.
CREATE POLICY "Users select own push_subscriptions"
  ON public.push_subscriptions
  FOR SELECT
  USING (user_id = (SELECT id FROM public.users WHERE auth_id = (SELECT auth.uid())));

CREATE POLICY "Users insert own push_subscriptions"
  ON public.push_subscriptions
  FOR INSERT
  WITH CHECK (user_id = (SELECT id FROM public.users WHERE auth_id = (SELECT auth.uid())));

CREATE POLICY "Users update own push_subscriptions"
  ON public.push_subscriptions
  FOR UPDATE
  USING (user_id = (SELECT id FROM public.users WHERE auth_id = (SELECT auth.uid())))
  WITH CHECK (user_id = (SELECT id FROM public.users WHERE auth_id = (SELECT auth.uid())));

CREATE POLICY "Users delete own push_subscriptions"
  ON public.push_subscriptions
  FOR DELETE
  USING (user_id = (SELECT id FROM public.users WHERE auth_id = (SELECT auth.uid())));


-- ============================================================================
-- MIGRATION: 20260511120000_multi_pax_bookings.sql
-- ============================================================================
-- AVADAETSPA/supabase/migrations/20260511120000_multi_pax_bookings.sql
-- ============================================================================
-- Multi-Pax Bookings — Phase 1 schema migration
-- ============================================================================
--
-- This migration adds the columns required to support multi-guest bookings
-- ("party of N") across the booking + transaction pipeline. A single booking
-- or transaction can now represent up to 30 guests, each with their own
-- service selection, served concurrently in (potentially) different rooms by
-- (potentially) different therapists, but billed as one party.
--
-- Columns added:
--
--   pax_count INTEGER NOT NULL DEFAULT 1 CHECK (pax_count BETWEEN 1 AND 30)
--     Added to: appointments, advance_bookings, transactions, online_bookings
--     Purpose : Number of guests in the party. Defaults to 1 so all existing
--               single-guest rows remain valid without backfill. Hard cap of
--               30 prevents accidental runaway values from the UI; the real
--               product cap will be enforced at the application layer.
--
--   guest_number INTEGER NOT NULL DEFAULT 1 CHECK (guest_number BETWEEN 1 AND 30)
--     Added to: active_services
--     Purpose : Identifies WHICH guest (1..pax_count) within a multi-pax
--               booking this active service row belongs to. With pax_count=1
--               legacy rows the value is simply 1, preserving current
--               semantics. Enables the floor view to show "Guest 2 of 4" on
--               room cards and to keep per-guest service state independent.
--
--   guest_summary JSONB
--     Added to: transactions, advance_bookings, online_bookings
--     Purpose : Denormalised, list-card-friendly summary of the party so the
--               bookings list / receipts / online booking emails can render
--               without re-fetching every per-guest row. Nullable because
--               legacy single-pax rows do not need it; populated for any
--               row where pax_count > 1. Shape (illustrative, app-defined):
--                 [{ "guest": 1, "name": "Ana", "services": ["Swedish 60"] },
--                  { "guest": 2, "name": "Bea", "services": ["Foot 30"] }]
--
-- Indexes added:
--
--   idx_transactions_pax_date
--     Partial index on transactions(business_id, date) WHERE pax_count > 1.
--     Targets the "Group bookings" report / filter, which is expected to
--     touch only a small fraction of rows. Partial index keeps the index
--     tiny and write-cheap for the dominant single-pax path.
--
-- Idempotency: every statement uses IF NOT EXISTS so re-running the
-- migration is a no-op. Safe to apply multiple times.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- pax_count on the four booking/transaction tables
-- ----------------------------------------------------------------------------

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS pax_count INTEGER NOT NULL DEFAULT 1
    CHECK (pax_count BETWEEN 1 AND 30);

ALTER TABLE advance_bookings
  ADD COLUMN IF NOT EXISTS pax_count INTEGER NOT NULL DEFAULT 1
    CHECK (pax_count BETWEEN 1 AND 30);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS pax_count INTEGER NOT NULL DEFAULT 1
    CHECK (pax_count BETWEEN 1 AND 30);

ALTER TABLE online_bookings
  ADD COLUMN IF NOT EXISTS pax_count INTEGER NOT NULL DEFAULT 1
    CHECK (pax_count BETWEEN 1 AND 30);

-- ----------------------------------------------------------------------------
-- guest_number on active_services (per-guest row identifier within a party)
-- ----------------------------------------------------------------------------

ALTER TABLE active_services
  ADD COLUMN IF NOT EXISTS guest_number INTEGER NOT NULL DEFAULT 1
    CHECK (guest_number BETWEEN 1 AND 30);

-- ----------------------------------------------------------------------------
-- guest_summary JSONB for list cards / receipts / emails
-- ----------------------------------------------------------------------------

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS guest_summary JSONB;

ALTER TABLE advance_bookings
  ADD COLUMN IF NOT EXISTS guest_summary JSONB;

ALTER TABLE online_bookings
  ADD COLUMN IF NOT EXISTS guest_summary JSONB;

-- ----------------------------------------------------------------------------
-- Partial index for multi-pax transaction reporting
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_transactions_pax_date
  ON transactions(business_id, date)
  WHERE pax_count > 1;

-- ============================================================================
-- DONE. After applying, mirror these columns into SUPABASE_TABLE_COLUMNS in
-- src/services/supabase/SupabaseSyncManager.js so the Dexie -> Supabase sync
-- pipeline forwards the new fields. (online_bookings is not in TABLE_COLUMNS;
-- BookingPage writes to it directly via REST and must be updated separately.)
-- ============================================================================


-- ============================================================================
-- MIGRATION: 20260513000000_under_time_transactions.sql
-- ============================================================================
-- ============================================================================
-- Under-time audit columns for transactions
-- ----------------------------------------------------------------------------
-- When a therapist stops an in-progress service before the scheduled duration
-- completes, the local Dexie layer flips the transaction status to 'under_time'
-- and stamps the actual duration, scheduled duration, who stopped it, why, and
-- when. Without these columns on Supabase, those fields stay local-only and
-- other devices show the row as a vanilla 'completed' receipt — no UNDER TIME
-- badge, no audit trail for management to review the incident.
--
-- Distinct from cancel/void:
--   - voided  = manual void from Service History (refund)
--   - cancelled = service never started (cascade from Rooms when therapist
--                 never pressed Start)
--   - under_time = service started but therapist stopped before time was up.
--                  Customer still pays, therapist still earns commission, but
--                  the incident is logged + therapist + managers are notified.
--
-- Safe to re-run: every statement uses IF NOT EXISTS.
-- ============================================================================

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS under_time_at      TIMESTAMPTZ;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS actual_duration    INTEGER;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS scheduled_duration INTEGER;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS stopped_by         TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS stopped_by_role    TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS stop_reason        TEXT;

-- Optional partial index. Only useful if you build management dashboards
-- that filter for under-time incidents per therapist. Skip on small datasets.
CREATE INDEX IF NOT EXISTS idx_transactions_status_under_time
  ON public.transactions(status) WHERE status = 'under_time';


-- ============================================================================
-- MIGRATION: 20260513120000_online_bookings_rider_assignment.sql
-- ============================================================================
-- ============================================================================
-- Rider assignment columns for online_bookings
-- ----------------------------------------------------------------------------
-- The AdvanceBookingsTab UI merges advance_bookings + online_bookings into the
-- same Regular Appointments list, and the "Assign Rider" dropdown writes
-- rider_id / rider_name / rider_assigned_at on the row. Those columns existed
-- on advance_bookings but were missing from online_bookings, so assigning a
-- rider to an online booking always failed with "Failed to assign rider" —
-- the PATCH hit the right table but the columns didn't exist.
--
-- Adding the same shape advance_bookings uses keeps the UI code uniform
-- (one set of field names, one update path) and lets the rider's
-- My Deliveries page join over a single rider_id column when it starts
-- reading from online_bookings.
--
-- Safe to re-run: every statement uses IF NOT EXISTS.
-- ============================================================================

ALTER TABLE public.online_bookings ADD COLUMN IF NOT EXISTS rider_id          UUID REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE public.online_bookings ADD COLUMN IF NOT EXISTS rider_name        TEXT;
ALTER TABLE public.online_bookings ADD COLUMN IF NOT EXISTS rider_assigned_at TIMESTAMPTZ;
ALTER TABLE public.online_bookings ADD COLUMN IF NOT EXISTS rider_assigned_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Partial index — only useful if the rider's My Deliveries page filters
-- online_bookings by rider_id at query time. Skip on small datasets.
CREATE INDEX IF NOT EXISTS idx_online_bookings_rider
  ON public.online_bookings(rider_id) WHERE rider_id IS NOT NULL;


-- ============================================================================
-- MIGRATION: 20260513140000_attendance_actor_audit.sql
-- ============================================================================
-- ============================================================================
-- Actor audit columns for attendance
-- ----------------------------------------------------------------------------
-- A clock-in / clock-out can be performed by the employee themselves
-- (MyPortal) OR by a manager/receptionist on their behalf (Attendance.jsx).
-- Up to now only the employee_id (whose attendance this is) was stored;
-- there was no way to tell from the record whether a manager remote-clocked
-- the employee in. This matters for audits — an employee who was clocked
-- in by a manager from a different location should be distinguishable from
-- a self-clock.
--
-- Adding both name (display) and id (FK) lets the Attendance Photos modal
-- render "by Randy Benitua (Owner)" inline without an extra join, while
-- still letting reports query by user.
--
-- Safe to re-run: every statement uses IF NOT EXISTS.
-- ============================================================================

ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS clocked_in_by       TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS clocked_in_by_id    UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS clocked_in_by_role  TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS clocked_out_by      TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS clocked_out_by_id   UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS clocked_out_by_role TEXT;


-- ============================================================================
-- FIRST-OWNER TEMPLATE
-- ----------------------------------------------------------------------------
-- After running everything above:
--   1. Supabase Dashboard -> Authentication -> Users -> Add user
--      Create an email + password. Copy the generated user UUID (auth_id).
--   2. Replace the two placeholders sa baba tapos run mo:
-- ============================================================================

-- INSERT INTO businesses (name, address, city, phone, email)
-- VALUES ('AVA Spa Central', 'Queborac Drive, Naga City', 'Naga', '0917XXXXXXX', 'owner@example.com')
-- RETURNING id;
-- -- copy the returned UUID into <business_uid> below

-- INSERT INTO users (auth_id, business_id, email, role, first_name, last_name)
-- VALUES (
--   '<auth_uid_from_dashboard>',   -- from step 1
--   '<business_uid_from_above>',   -- from the INSERT INTO businesses above
--   'owner@example.com',
--   'Owner',
--   'Your',
--   'Name'
-- );
