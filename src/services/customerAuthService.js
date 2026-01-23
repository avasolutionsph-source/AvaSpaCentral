/**
 * Customer Authentication Service
 *
 * Handles customer registration, login, and profile management
 * for the public booking portal. Customers are scoped to a specific business.
 */

import { supabase } from './supabase/supabaseClient';

const CUSTOMER_AUTH_KEY = 'customer-portal-auth';

/**
 * Get Supabase URL and anon key from environment
 */
const getSupabaseConfig = () => ({
  url: import.meta.env.VITE_SUPABASE_URL,
  key: import.meta.env.VITE_SUPABASE_ANON_KEY
});

/**
 * Register a new customer account
 * @param {string} businessId - The business UUID
 * @param {object} data - Customer data { email, password, name, phone }
 * @returns {object} - { success, data, error }
 */
export const registerCustomer = async (businessId, { email, password, name, phone }) => {
  try {
    const { url, key } = getSupabaseConfig();

    // 1. Create Supabase Auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          phone,
          user_type: 'customer',
          business_id: businessId
        }
      }
    });

    if (authError) {
      // Check for duplicate email
      if (authError.message.includes('already registered')) {
        return { success: false, error: 'An account with this email already exists.' };
      }
      throw authError;
    }

    // 2. Create customer_account record
    const accountData = {
      business_id: businessId,
      auth_id: authData.user?.id,
      email: email.toLowerCase(),
      name,
      phone: phone || null,
      loyalty_points: 50, // Welcome bonus!
      tier: 'NEW'
    };

    const response = await fetch(`${url}/rest/v1/customer_accounts`, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${authData.session?.access_token || key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(accountData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      // If account creation fails, we should ideally delete the auth user
      // but for simplicity we'll just return the error
      if (errorData.message?.includes('duplicate')) {
        return { success: false, error: 'An account with this email already exists for this business.' };
      }
      throw new Error(errorData.message || 'Failed to create account');
    }

    const customerAccount = await response.json();

    // Store session info
    localStorage.setItem(CUSTOMER_AUTH_KEY, JSON.stringify({
      businessId,
      accountId: customerAccount[0]?.id,
      email,
      name,
      session: authData.session
    }));

    return {
      success: true,
      data: {
        user: authData.user,
        account: customerAccount[0],
        session: authData.session
      }
    };
  } catch (error) {
    console.error('[CustomerAuth] Registration error:', error);
    return { success: false, error: error.message || 'Registration failed. Please try again.' };
  }
};

/**
 * Login a customer
 * @param {string} businessId - The business UUID
 * @param {string} email - Customer email
 * @param {string} password - Customer password
 * @returns {object} - { success, data, error }
 */
export const loginCustomer = async (businessId, email, password) => {
  try {
    const { url, key } = getSupabaseConfig();

    // 1. Sign in with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      if (authError.message.includes('Invalid login')) {
        return { success: false, error: 'Invalid email or password.' };
      }
      throw authError;
    }

    // 2. Fetch customer account for this business
    const accountUrl = `${url}/rest/v1/customer_accounts?business_id=eq.${businessId}&auth_id=eq.${authData.user.id}&select=*`;

    const response = await fetch(accountUrl, {
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${authData.session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch account');
    }

    const accounts = await response.json();

    if (!accounts || accounts.length === 0) {
      // User exists in auth but no account for this business
      // Sign them out and return error
      await supabase.auth.signOut();
      return {
        success: false,
        error: 'No account found for this business. Please register first.'
      };
    }

    const account = accounts[0];

    // 3. Update last_login
    await fetch(`${url}/rest/v1/customer_accounts?id=eq.${account.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${authData.session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ last_login: new Date().toISOString() })
    });

    // Store session info
    localStorage.setItem(CUSTOMER_AUTH_KEY, JSON.stringify({
      businessId,
      accountId: account.id,
      email: account.email,
      name: account.name,
      session: authData.session
    }));

    return {
      success: true,
      data: {
        user: authData.user,
        account,
        session: authData.session
      }
    };
  } catch (error) {
    console.error('[CustomerAuth] Login error:', error);
    return { success: false, error: error.message || 'Login failed. Please try again.' };
  }
};

/**
 * Logout customer
 */
export const logoutCustomer = async () => {
  try {
    await supabase.auth.signOut();
    localStorage.removeItem(CUSTOMER_AUTH_KEY);
    return { success: true };
  } catch (error) {
    console.error('[CustomerAuth] Logout error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get current customer session for a specific business
 * @param {string} businessId - The business UUID
 * @returns {object|null} - Customer session data or null
 */
export const getCustomerSession = async (businessId) => {
  try {
    // Check localStorage first
    const stored = localStorage.getItem(CUSTOMER_AUTH_KEY);
    if (!stored) return null;

    const sessionData = JSON.parse(stored);

    // Verify this is for the correct business
    if (sessionData.businessId !== businessId) {
      return null;
    }

    // Verify session is still valid
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      localStorage.removeItem(CUSTOMER_AUTH_KEY);
      return null;
    }

    return {
      ...sessionData,
      session
    };
  } catch (error) {
    console.error('[CustomerAuth] Get session error:', error);
    return null;
  }
};

/**
 * Get customer profile with full details
 * @param {string} businessId - The business UUID
 * @returns {object} - { success, data, error }
 */
export const getCustomerProfile = async (businessId) => {
  try {
    const { url, key } = getSupabaseConfig();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const accountUrl = `${url}/rest/v1/customer_accounts?business_id=eq.${businessId}&auth_id=eq.${session.user.id}&select=*`;

    const response = await fetch(accountUrl, {
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch profile');
    }

    const accounts = await response.json();

    if (!accounts || accounts.length === 0) {
      return { success: false, error: 'Account not found' };
    }

    return { success: true, data: accounts[0] };
  } catch (error) {
    console.error('[CustomerAuth] Get profile error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update customer profile
 * @param {string} accountId - The customer account UUID
 * @param {object} data - Fields to update
 * @returns {object} - { success, data, error }
 */
export const updateCustomerProfile = async (accountId, data) => {
  try {
    const { url, key } = getSupabaseConfig();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    // Only allow updating certain fields
    const allowedFields = ['name', 'phone', 'birthday', 'gender', 'preferences'];
    const updateData = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    const response = await fetch(`${url}/rest/v1/customer_accounts?id=eq.${accountId}`, {
      method: 'PATCH',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      throw new Error('Failed to update profile');
    }

    const updated = await response.json();

    // Update localStorage
    const stored = localStorage.getItem(CUSTOMER_AUTH_KEY);
    if (stored) {
      const sessionData = JSON.parse(stored);
      sessionData.name = updateData.name || sessionData.name;
      localStorage.setItem(CUSTOMER_AUTH_KEY, JSON.stringify(sessionData));
    }

    return { success: true, data: updated[0] };
  } catch (error) {
    console.error('[CustomerAuth] Update profile error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get customer booking history
 * @param {string} businessId - The business UUID
 * @param {string} accountId - The customer account UUID
 * @returns {object} - { success, data, error }
 */
export const getBookingHistory = async (businessId, accountId) => {
  try {
    const { url, key } = getSupabaseConfig();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const bookingsUrl = `${url}/rest/v1/online_bookings?business_id=eq.${businessId}&customer_account_id=eq.${accountId}&deleted=eq.false&order=created_at.desc`;

    const response = await fetch(bookingsUrl, {
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch bookings');
    }

    const bookings = await response.json();
    return { success: true, data: bookings };
  } catch (error) {
    console.error('[CustomerAuth] Get bookings error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Cancel a booking
 * @param {string} bookingId - The booking UUID
 * @returns {object} - { success, error }
 */
export const cancelBooking = async (bookingId) => {
  try {
    const { url, key } = getSupabaseConfig();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const response = await fetch(`${url}/rest/v1/online_bookings?id=eq.${bookingId}`, {
      method: 'PATCH',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
    });

    if (!response.ok) {
      throw new Error('Failed to cancel booking');
    }

    return { success: true };
  } catch (error) {
    console.error('[CustomerAuth] Cancel booking error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check if email is already registered for a business
 * @param {string} businessId - The business UUID
 * @param {string} email - Email to check
 * @returns {boolean}
 */
export const isEmailRegistered = async (businessId, email) => {
  try {
    const { url, key } = getSupabaseConfig();

    const checkUrl = `${url}/rest/v1/customer_accounts?business_id=eq.${businessId}&email=eq.${email.toLowerCase()}&select=id`;

    const response = await fetch(checkUrl, {
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) return false;

    const accounts = await response.json();
    return accounts && accounts.length > 0;
  } catch (error) {
    console.error('[CustomerAuth] Check email error:', error);
    return false;
  }
};

export default {
  registerCustomer,
  loginCustomer,
  logoutCustomer,
  getCustomerSession,
  getCustomerProfile,
  updateCustomerProfile,
  getBookingHistory,
  cancelBooking,
  isEmailRegistered
};
