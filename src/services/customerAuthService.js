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
 * Detect Supabase "email already in auth" errors across response shapes.
 */
const isEmailTakenError = (err) => {
  const msg = (err?.message || '').toLowerCase();
  const code = (err?.code || '').toLowerCase();
  return (
    code === 'user_already_exists' ||
    code === 'email_exists' ||
    msg.includes('already registered') ||
    msg.includes('already exists') ||
    msg.includes('user already')
  );
};

/**
 * Insert the customer_accounts row tied to a Supabase auth user.
 * Returns the created account row, or throws on failure.
 */
const createCustomerAccountRow = async ({ businessId, authUserId, email, name, phone, accessToken }) => {
  const { url, key } = getSupabaseConfig();
  const accountData = {
    business_id: businessId,
    auth_id: authUserId,
    email: email.toLowerCase(),
    name,
    phone: phone || null,
    loyalty_points: 50, // Welcome bonus!
    tier: 'NEW',
  };

  const response = await fetch(`${url}/rest/v1/customer_accounts`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${accessToken || key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(accountData),
  });

  if (!response.ok) {
    let errorBody = {};
    try { errorBody = await response.json(); } catch {}
    const msg = errorBody.message || `HTTP ${response.status}`;
    if (msg.toLowerCase().includes('duplicate')) {
      const dupErr = new Error('An account with this email already exists for this business.');
      dupErr.code = 'duplicate';
      throw dupErr;
    }
    throw new Error(msg);
  }

  const rows = await response.json();
  return rows[0];
};

/**
 * Register a new customer account
 * @param {string} businessId - The business UUID
 * @param {object} data - Customer data { email, password, name, phone }
 * @returns {object} - { success, data, error }
 */
export const registerCustomer = async (businessId, { email, password, name, phone }) => {
  try {
    // 1. Try to create the Supabase Auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          phone,
          user_type: 'customer',
          business_id: businessId,
        },
      },
    });

    let authUserId = authData?.user?.id;
    let session = authData?.session;

    // 2. If the auth user already exists, attempt a recovery path:
    //    sign in with the provided password and check whether this
    //    business is missing a customer_accounts row. This rescues users
    //    who got orphaned by a previous failed registration AND lets
    //    existing accounts at other businesses register at this one.
    if (authError) {
      if (!isEmailTakenError(authError)) throw authError;

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        // Email is in use but the password they entered is wrong —
        // they must use Sign In with their existing credentials.
        return {
          success: false,
          error: 'This email is already registered. Please sign in with your existing password, or use a different email.',
        };
      }

      authUserId = signInData.user?.id;
      session = signInData.session;

      // Already have a customer_accounts row for this business?
      const { url, key } = getSupabaseConfig();
      const checkRes = await fetch(
        `${url}/rest/v1/customer_accounts?business_id=eq.${businessId}&auth_id=eq.${authUserId}&select=id`,
        {
          headers: {
            'apikey': key,
            'Authorization': `Bearer ${session?.access_token || key}`,
          },
        }
      );
      if (checkRes.ok) {
        const existing = await checkRes.json();
        if (Array.isArray(existing) && existing.length > 0) {
          await supabase.auth.signOut();
          return {
            success: false,
            error: 'An account with this email already exists for this business. Please sign in instead.',
          };
        }
      }
      // No row for this business — fall through to create one (recovery).
    }

    if (!authUserId) {
      throw new Error('Account creation succeeded but no user id was returned.');
    }

    // 3. Create the customer_accounts row.
    let customerAccount;
    try {
      customerAccount = await createCustomerAccountRow({
        businessId,
        authUserId,
        email,
        name,
        phone,
        accessToken: session?.access_token,
      });
    } catch (insertErr) {
      // Surface duplicate as a clean "already exists" message
      if (insertErr.code === 'duplicate') {
        return { success: false, error: insertErr.message };
      }
      throw insertErr;
    }

    // 4. Persist client-side session info
    localStorage.setItem(CUSTOMER_AUTH_KEY, JSON.stringify({
      businessId,
      accountId: customerAccount?.id,
      email,
      name,
      session,
    }));

    return {
      success: true,
      data: {
        user: { id: authUserId, email },
        account: customerAccount,
        session,
      },
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve a business identifier (UUID or booking slug) to its UUID.
 * Returns null when the slug can't be resolved.
 */
const resolveBusinessUUID = async (businessIdOrSlug) => {
  if (!businessIdOrSlug) return null;
  if (UUID_RE.test(businessIdOrSlug)) return businessIdOrSlug;

  const { url, key } = getSupabaseConfig();
  try {
    const res = await fetch(
      `${url}/rest/v1/businesses?booking_slug=eq.${encodeURIComponent(businessIdOrSlug)}&select=id`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows[0]?.id || null;
  } catch {
    return null;
  }
};

/**
 * Get current customer session for a specific business
 * @param {string} businessId - The business UUID or booking slug
 * @returns {object|null} - Customer session data or null
 */
export const getCustomerSession = async (businessId) => {
  try {
    // Check localStorage first
    const stored = localStorage.getItem(CUSTOMER_AUTH_KEY);
    if (!stored) return null;

    const sessionData = JSON.parse(stored);

    // The route param can be either a UUID or a booking slug, but the
    // session always stores the UUID. Resolve the slug if needed before
    // comparing — otherwise a slug-based URL will never match the stored
    // UUID and the user gets bounced back to /login in a loop.
    const targetUUID = await resolveBusinessUUID(businessId);
    if (!targetUUID || sessionData.businessId !== targetUUID) {
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
