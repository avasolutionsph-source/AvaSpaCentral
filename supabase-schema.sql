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
    settings JSONB DEFAULT '{}',
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
CREATE POLICY "Users can view their business" ON businesses
    FOR SELECT USING (id = get_user_business_id());

CREATE POLICY "Owners can update their business" ON businesses
    FOR UPDATE USING (
        id = get_user_business_id() AND
        EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'Owner')
    );

-- Users table
CREATE POLICY "Users can view own business users" ON users
    FOR SELECT USING (business_id = get_user_business_id());

CREATE POLICY "Owners can manage users" ON users
    FOR ALL USING (
        business_id = get_user_business_id() AND
        EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'Owner')
    );

-- Generic policy for all other tables
CREATE POLICY "Business isolation" ON products FOR ALL USING (business_id = get_user_business_id());
CREATE POLICY "Business isolation" ON employees FOR ALL USING (business_id = get_user_business_id());
CREATE POLICY "Business isolation" ON customers FOR ALL USING (business_id = get_user_business_id());
CREATE POLICY "Business isolation" ON suppliers FOR ALL USING (business_id = get_user_business_id());
CREATE POLICY "Business isolation" ON rooms FOR ALL USING (business_id = get_user_business_id());
CREATE POLICY "Business isolation" ON transactions FOR ALL USING (business_id = get_user_business_id());
CREATE POLICY "Business isolation" ON appointments FOR ALL USING (business_id = get_user_business_id());
CREATE POLICY "Business isolation" ON purchase_orders FOR ALL USING (business_id = get_user_business_id());
CREATE POLICY "Business isolation" ON inventory_movements FOR ALL USING (business_id = get_user_business_id());
CREATE POLICY "Business isolation" ON stock_history FOR ALL USING (business_id = get_user_business_id());
CREATE POLICY "Business isolation" ON product_consumption FOR ALL USING (business_id = get_user_business_id());
CREATE POLICY "Business isolation" ON expenses FOR ALL USING (business_id = get_user_business_id());
CREATE POLICY "Business isolation" ON cash_drawer_sessions FOR ALL USING (business_id = get_user_business_id());
CREATE POLICY "Business isolation" ON gift_certificates FOR ALL USING (business_id = get_user_business_id());
CREATE POLICY "Business isolation" ON attendance FOR ALL USING (business_id = get_user_business_id());
CREATE POLICY "Business isolation" ON shift_schedules FOR ALL USING (business_id = get_user_business_id());
CREATE POLICY "Business isolation" ON payroll_requests FOR ALL USING (business_id = get_user_business_id());
CREATE POLICY "Business isolation" ON time_off_requests FOR ALL USING (business_id = get_user_business_id());
CREATE POLICY "Business isolation" ON activity_logs FOR ALL USING (business_id = get_user_business_id());
CREATE POLICY "Business isolation" ON settings FOR ALL USING (business_id = get_user_business_id());
CREATE POLICY "Business isolation" ON payroll_config FOR ALL USING (business_id = get_user_business_id());
CREATE POLICY "Business isolation" ON payroll_config_logs FOR ALL USING (business_id = get_user_business_id());
CREATE POLICY "Business isolation" ON business_config FOR ALL USING (business_id = get_user_business_id());
CREATE POLICY "Business isolation" ON service_rotation FOR ALL USING (business_id = get_user_business_id());
CREATE POLICY "Business isolation" ON loyalty_history FOR ALL USING (business_id = get_user_business_id());
CREATE POLICY "Business isolation" ON advance_bookings FOR ALL USING (business_id = get_user_business_id());
CREATE POLICY "Business isolation" ON active_services FOR ALL USING (business_id = get_user_business_id());
CREATE POLICY "Business isolation" ON home_services FOR ALL USING (business_id = get_user_business_id());
CREATE POLICY "Business isolation" ON sync_queue FOR ALL USING (business_id = get_user_business_id());
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
