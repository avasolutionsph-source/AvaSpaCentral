/**
 * Supabase Authentication Service
 *
 * Handles user authentication with Supabase Auth.
 * Requires Supabase to be configured for production use.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';

class AuthService {
  constructor() {
    this._currentUser = null;
    this._session = null;
    this._listeners = [];
    this._initialized = false;
  }

  /**
   * Initialize auth service and listen for auth state changes
   */
  async initialize() {
    if (this._initialized) return;
    this._initialized = true;

    if (!isSupabaseConfigured()) {
      console.log('[AuthService] Supabase not configured, using offline mode');
      // Try to restore session from localStorage for offline mode
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        this._currentUser = JSON.parse(storedUser);
      }
      return;
    }

    // Get initial session
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      this._session = session;
      await this._loadUserProfile(session.user.id);
    }

    // Listen for auth state changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthService] Auth state changed:', event);
      this._session = session;

      if (session?.user) {
        await this._loadUserProfile(session.user.id);
      } else {
        this._currentUser = null;
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }

      this._notifyListeners(event, session);
    });
  }

  /**
   * Load user profile from Supabase users table
   */
  async _loadUserProfile(authId) {
    try {
      const { data: userProfile, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', authId)
        .single();

      if (error) {
        console.error('[AuthService] Error loading user profile:', error);
        return null;
      }

      // Auto-generate businessId for Owner users if missing
      // This ensures multi-tenant data isolation works correctly
      if (userProfile.role === 'Owner' && !userProfile.business_id) {
        const newBusinessId = crypto.randomUUID();
        console.log('[AuthService] Auto-generating businessId for Owner:', newBusinessId);

        const { error: updateError } = await supabase
          .from('users')
          .update({ business_id: newBusinessId })
          .eq('id', userProfile.id);

        if (updateError) {
          console.error('[AuthService] Failed to update businessId:', updateError);
        } else {
          userProfile.business_id = newBusinessId;
        }
      }

      // Transform to app format
      this._currentUser = {
        _id: userProfile.id,
        email: userProfile.email,
        username: userProfile.username,
        firstName: userProfile.first_name,
        lastName: userProfile.last_name,
        role: userProfile.role,
        employeeId: userProfile.employee_id,
        businessId: userProfile.business_id,
        status: userProfile.status,
      };

      // Store for offline access
      localStorage.setItem('user', JSON.stringify(this._currentUser));
      localStorage.setItem('token', this._session?.access_token || '');

      return this._currentUser;
    } catch (error) {
      console.error('[AuthService] Error in _loadUserProfile:', error);
      return null;
    }
  }

  /**
   * Subscribe to auth state changes
   */
  subscribe(callback) {
    this._listeners.push(callback);
    return () => {
      this._listeners = this._listeners.filter(l => l !== callback);
    };
  }

  _notifyListeners(event, session) {
    this._listeners.forEach(cb => {
      try {
        cb(event, session, this._currentUser);
      } catch (error) {
        console.error('[AuthService] Listener error:', error);
      }
    });
  }

  /**
   * Get current session
   */
  get session() {
    return this._session;
  }

  /**
   * Get current user profile
   */
  get currentUser() {
    return this._currentUser;
  }

  /**
   * Check if user is authenticated
   */
  get isAuthenticated() {
    return this._currentUser !== null;
  }

  /**
   * Sign in with email and password
   */
  async signIn(email, password) {
    if (!isSupabaseConfigured()) {
      throw new Error('Authentication service not configured. Please contact support.');
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error(error.message);
      }

      // Load user profile
      const userProfile = await this._loadUserProfile(data.user.id);

      if (!userProfile) {
        throw new Error('User profile not found. Please contact support.');
      }

      // Update last login
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('auth_id', data.user.id);

      return {
        success: true,
        user: userProfile,
        session: data.session,
      };
    } catch (error) {
      console.error('[AuthService] Sign in error:', error);
      throw error;
    }
  }

  /**
   * Sign in with username or email and password
   * Accepts either username or email, looks up the email if username provided
   */
  async signInWithUsername(usernameOrEmail, password) {
    if (!isSupabaseConfigured()) {
      throw new Error('Authentication service not configured. Please contact support.');
    }

    try {
      let email = usernameOrEmail;

      // Check if input looks like an email (contains @)
      const isEmail = usernameOrEmail.includes('@');
      console.log('[AuthService] Login attempt:', { usernameOrEmail, isEmail });

      if (!isEmail) {
        // It's a username - look up the email
        console.log('[AuthService] Looking up username:', usernameOrEmail.toLowerCase());
        const { data: userProfile, error: lookupError } = await supabase
          .from('users')
          .select('email, status')
          .eq('username', usernameOrEmail.toLowerCase())
          .maybeSingle();

        console.log('[AuthService] Username lookup result:', { userProfile, lookupError });

        if (lookupError || !userProfile) {
          console.error('[AuthService] Username not found or lookup error');
          throw new Error('Invalid username or password');
        }

        // Check if user is active
        if (userProfile.status !== 'active') {
          console.error('[AuthService] Account is inactive:', userProfile.status);
          throw new Error('Account is inactive. Please contact administrator.');
        }

        email = userProfile.email;
        console.log('[AuthService] Found email for username:', email);
      }

      // Sign in with the email
      console.log('[AuthService] Attempting Supabase auth with email:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('[AuthService] Supabase auth result:', { success: !!data?.user, error: error?.message });

      if (error) {
        console.error('[AuthService] Supabase auth error:', error.message, error.status);
        throw new Error('Invalid username or password');
      }

      // Load full user profile
      const fullProfile = await this._loadUserProfile(data.user.id);

      if (!fullProfile) {
        throw new Error('User profile not found. Please contact support.');
      }

      // Update last login
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('auth_id', data.user.id);

      return {
        success: true,
        user: fullProfile,
        session: data.session,
      };
    } catch (error) {
      console.error('[AuthService] Sign in error:', error);
      throw error;
    }
  }

  /**
   * Check if a username is available
   */
  async isUsernameAvailable(username) {
    if (!isSupabaseConfigured()) {
      throw new Error('Username check requires Supabase connection');
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('username', username.toLowerCase())
        .maybeSingle(); // Use maybeSingle instead of single to avoid error when not found

      // If no data found, username is available
      if (!data) {
        return true;
      }

      // Username exists
      return false;
    } catch (error) {
      console.error('[AuthService] Error checking username:', error);
      // On error, assume username might be taken (safer)
      return false;
    }
  }

  /**
   * Create a staff account (for use by Owner in HR Hub)
   * Creates both the Supabase Auth user and the user profile
   */
  async createStaffAccount({ username, password, email, firstName, lastName, role, employeeId, businessId }) {
    if (!isSupabaseConfigured()) {
      throw new Error('Account creation requires internet connection');
    }

    try {
      // Validate username format
      if (!username || !/^[a-zA-Z0-9_]+$/.test(username)) {
        throw new Error('Username must contain only letters, numbers, and underscores');
      }

      if (username.length < 3 || username.length > 30) {
        throw new Error('Username must be between 3 and 30 characters');
      }

      // Check username availability
      const isAvailable = await this.isUsernameAvailable(username);
      if (!isAvailable) {
        throw new Error('Username is already taken');
      }

      // Create Supabase Auth user with the employee's email
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username.toLowerCase(),
            first_name: firstName,
            last_name: lastName,
          },
          // Skip email confirmation for staff accounts (Owner is creating them)
          emailRedirectTo: undefined,
        },
      });

      if (authError) {
        throw new Error(authError.message);
      }

      if (!authData.user) {
        throw new Error('Failed to create auth account');
      }

      // Create user profile in users table
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .insert({
          auth_id: authData.user.id,
          email: email.toLowerCase(),
          username: username.toLowerCase(),
          first_name: firstName,
          last_name: lastName,
          role: role || 'Therapist',
          business_id: businessId,
          employee_id: employeeId,
          status: 'active',
        })
        .select()
        .single();

      if (profileError) {
        // If profile creation fails, we should ideally delete the auth user
        // but Supabase doesn't allow that without admin access
        console.error('[AuthService] Failed to create profile:', profileError);
        throw new Error('Failed to create user profile: ' + profileError.message);
      }

      return {
        success: true,
        user: {
          _id: profileData.id,
          email: profileData.email,
          username: profileData.username,
          firstName: profileData.first_name,
          lastName: profileData.last_name,
          role: profileData.role,
          employeeId: profileData.employee_id,
          businessId: profileData.business_id,
          status: profileData.status,
        },
        message: 'Staff account created successfully',
      };
    } catch (error) {
      console.error('[AuthService] Create staff account error:', error);
      throw error;
    }
  }

  /**
   * Sign up a new user
   */
  async signUp(email, password, metadata = {}) {
    if (!isSupabaseConfigured()) {
      throw new Error('Sign up requires Supabase connection');
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      return {
        success: true,
        user: data.user,
        message: 'Please check your email to confirm your account.',
      };
    } catch (error) {
      console.error('[AuthService] Sign up error:', error);
      throw error;
    }
  }

  /**
   * Create a user profile in the users table after sign up
   */
  async createUserProfile(authId, profileData) {
    if (!isSupabaseConfigured()) {
      throw new Error('Creating user profile requires Supabase connection');
    }

    const { data, error } = await supabase
      .from('users')
      .insert({
        auth_id: authId,
        email: profileData.email,
        username: profileData.username?.toLowerCase(),
        first_name: profileData.firstName,
        last_name: profileData.lastName,
        role: profileData.role || 'Receptionist',
        business_id: profileData.businessId,
        employee_id: profileData.employeeId,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Sign out
   */
  async signOut() {
    if (isSupabaseConfigured()) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('[AuthService] Sign out error:', error);
      }
    }

    this._currentUser = null;
    this._session = null;
    localStorage.removeItem('user');
    localStorage.removeItem('token');

    this._notifyListeners('SIGNED_OUT', null);

    return { success: true };
  }

  /**
   * Send password reset email
   */
  async resetPassword(email) {
    if (!isSupabaseConfigured()) {
      throw new Error('Password reset requires Supabase connection');
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
      message: 'Password reset email sent. Please check your inbox.',
    };
  }

  /**
   * Update password (after reset)
   */
  async updatePassword(newPassword) {
    if (!isSupabaseConfigured()) {
      throw new Error('Password update requires Supabase connection');
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      throw new Error(error.message);
    }

    return { success: true };
  }

  /**
   * Get current session
   */
  async getSession() {
    if (!isSupabaseConfigured()) {
      return null;
    }

    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      throw new Error(error.message);
    }
    return session;
  }

  /**
   * Refresh session token
   */
  async refreshSession() {
    if (!isSupabaseConfigured()) {
      return null;
    }

    const { data: { session }, error } = await supabase.auth.refreshSession();
    if (error) {
      throw new Error(error.message);
    }
    return session;
  }

  /**
   * Check if Supabase is available
   */
  isOnline() {
    return isSupabaseConfigured();
  }
}

// Export singleton instance
const authService = new AuthService();
export default authService;
