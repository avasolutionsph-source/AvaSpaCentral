/**
 * Supabase Authentication Service
 *
 * Handles user authentication with Supabase Auth.
 * Falls back to mock authentication when Supabase is not configured.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';
import { db } from '../../db';

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

      // Transform to app format
      this._currentUser = {
        _id: userProfile.id,
        email: userProfile.email,
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
      return this._offlineSignIn(email, password);
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
   * Offline sign in using local Dexie database
   */
  async _offlineSignIn(email, password) {
    // Check Dexie users table first
    const users = await db.users.where('email').equals(email).toArray();
    let user = users[0];

    // Demo users fallback
    const demoUsers = {
      'owner@example.com': { password: 'DemoSpa123!', role: 'Owner', firstName: 'Demo', lastName: 'Owner' },
      'manager@example.com': { password: 'Manager123!', role: 'Manager', firstName: 'Demo', lastName: 'Manager' },
      'receptionist@example.com': { password: 'Reception123!', role: 'Receptionist', firstName: 'Demo', lastName: 'Receptionist' },
      'therapist@example.com': { password: 'Therapist123!', role: 'Therapist', firstName: 'Demo', lastName: 'Therapist' },
    };

    if (!user && demoUsers[email]) {
      const demo = demoUsers[email];
      if (password !== demo.password) {
        throw new Error('Invalid password');
      }
      user = {
        _id: `demo_${Date.now()}`,
        email,
        firstName: demo.firstName,
        lastName: demo.lastName,
        role: demo.role,
        status: 'active',
      };
    } else if (user) {
      // For local users, check password (note: not secure, just for demo)
      if (user.password && user.password !== password) {
        throw new Error('Invalid password');
      }
    } else {
      throw new Error('User not found');
    }

    this._currentUser = {
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      employeeId: user.employeeId,
      status: user.status,
    };

    localStorage.setItem('user', JSON.stringify(this._currentUser));
    localStorage.setItem('token', 'offline_token_' + Date.now());

    this._notifyListeners('SIGNED_IN', null);

    return {
      success: true,
      user: this._currentUser,
      session: null,
    };
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
