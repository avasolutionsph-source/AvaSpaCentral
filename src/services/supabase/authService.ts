/**
 * Supabase Authentication Service
 *
 * Handles user authentication with Supabase Auth.
 * Requires Supabase to be configured for production use.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';
import type {
  UserProfile,
  AuthSession,
  AuthEvent,
  AuthListener,
  SignInResponse,
  SignUpResponse,
  CreateStaffParams,
  CreateStaffResponse,
  PasswordResetResponse,
  UserRole,
} from '../../types';

class AuthService {
  private _currentUser: UserProfile | null = null;
  private _session: AuthSession | null = null;
  private _listeners: AuthListener[] = [];
  private _initialized = false;

  /**
   * Initialize auth service and listen for auth state changes
   */
  async initialize(): Promise<void> {
    if (this._initialized) return;
    this._initialized = true;

    if (!isSupabaseConfigured() || !supabase) {
      console.log('[AuthService] Supabase not configured, using offline mode');
      // Try to restore session from localStorage for offline mode
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        this._currentUser = JSON.parse(storedUser) as UserProfile;
      }
      return;
    }

    // Get initial session
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      this._session = session as unknown as AuthSession;
      await this._loadUserProfile(session.user.id);
    }

    // Listen for auth state changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthService] Auth state changed:', event);
      this._session = session as unknown as AuthSession;

      if (session?.user) {
        await this._loadUserProfile(session.user.id);
      } else {
        this._currentUser = null;
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }

      this._notifyListeners(event as AuthEvent, session as unknown as AuthSession);
    });
  }

  /**
   * Load user profile from Supabase users table
   */
  private async _loadUserProfile(authId: string): Promise<UserProfile | null> {
    if (!supabase) return null;

    try {
      const { data: userProfile, error } = await supabase
        .from('users')
        .select('id, email, username, first_name, last_name, role, employee_id, business_id, branch_id, status')
        .eq('auth_id', authId)
        .maybeSingle();

      if (error) {
        console.error('[AuthService] Error loading user profile:', error);
        return null;
      }

      // No staff profile found (e.g. customer account) - not an error
      if (!userProfile) {
        return null;
      }

      // Auto-generate businessId for Owner users if missing
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
        role: userProfile.role as UserRole,
        employeeId: userProfile.employee_id,
        businessId: userProfile.business_id,
        branchId: userProfile.branch_id,
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
  subscribe(callback: AuthListener): () => void {
    this._listeners.push(callback);
    return () => {
      this._listeners = this._listeners.filter((l) => l !== callback);
    };
  }

  private _notifyListeners(event: AuthEvent, session: AuthSession | null): void {
    this._listeners.forEach((cb) => {
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
  get session(): AuthSession | null {
    return this._session;
  }

  /**
   * Get current user profile
   */
  get currentUser(): UserProfile | null {
    return this._currentUser;
  }

  /**
   * Check if user is authenticated
   */
  get isAuthenticated(): boolean {
    return this._currentUser !== null;
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<SignInResponse> {
    if (!isSupabaseConfigured() || !supabase) {
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

      // Load profile and update last_login in parallel
      const [userProfile] = await Promise.all([
        this._loadUserProfile(data.user.id),
        supabase
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('auth_id', data.user.id)
      ]);

      if (!userProfile) {
        throw new Error('User profile not found. Please contact support.');
      }

      return {
        success: true,
        user: userProfile,
        session: data.session as unknown as AuthSession,
      };
    } catch (error) {
      console.error('[AuthService] Sign in error:', error);
      throw error;
    }
  }

  /**
   * Sign in with username or email and password
   */
  async signInWithUsername(usernameOrEmail: string, password: string): Promise<SignInResponse> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Authentication service not configured. Please contact support.');
    }

    try {
      let email = usernameOrEmail;

      // Check if input looks like an email
      const isEmail = usernameOrEmail.includes('@');
      console.log('[AuthService] Login attempt:', { usernameOrEmail, isEmail });

      if (!isEmail) {
        // It's a username - look up the email
        console.log('[AuthService] Looking up username:', usernameOrEmail.toLowerCase());
        const { data: userProfile, error: lookupError } = await supabase
          .from('users')
          .select('email, status')
          .ilike('username', usernameOrEmail)
          .maybeSingle();

        console.log('[AuthService] Username lookup result:', { userProfile, lookupError });

        if (lookupError || !userProfile) {
          console.error('[AuthService] Username not found or lookup error');
          throw new Error('Invalid username or password');
        }

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

      console.log('[AuthService] Supabase auth result:', {
        success: !!data?.user,
        error: error?.message,
      });

      if (error) {
        console.error('[AuthService] Supabase auth error:', error.message, error.status);
        throw new Error('Invalid username or password');
      }

      // Load profile and update last_login in parallel
      const [fullProfile] = await Promise.all([
        this._loadUserProfile(data.user.id),
        supabase
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('auth_id', data.user.id)
      ]);

      if (!fullProfile) {
        throw new Error('User profile not found. Please contact support.');
      }

      return {
        success: true,
        user: fullProfile,
        session: data.session as unknown as AuthSession,
      };
    } catch (error) {
      console.error('[AuthService] Sign in error:', error);
      throw error;
    }
  }

  /**
   * Check if a username is available
   */
  async isUsernameAvailable(username: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Username check requires Supabase connection');
    }

    try {
      const { data } = await supabase
        .from('users')
        .select('id')
        .eq('username', username.toLowerCase())
        .maybeSingle();

      return !data;
    } catch (error) {
      console.error('[AuthService] Error checking username:', error);
      return false;
    }
  }

  /**
   * Create a staff account
   */
  async createStaffAccount(params: CreateStaffParams): Promise<CreateStaffResponse> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Account creation requires internet connection');
    }

    const { username, password, email, firstName, lastName, role, employeeId, businessId, branchId } =
      params;

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

      // Create Supabase Auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username.toLowerCase(),
            first_name: firstName,
            last_name: lastName,
          },
          emailRedirectTo: undefined,
        },
      });

      let authUserId: string;

      if (authError) {
        // If user already registered in Auth, try to recover by finding their auth ID
        // This handles cases where auth was created but profile insert failed
        if (authError.message.includes('already registered')) {
          // Check if a profile already exists for this email
          const { data: existingProfile } = await supabase
            .from('users')
            .select('id')
            .eq('email', email.toLowerCase())
            .single();

          if (existingProfile) {
            throw new Error('User already registered with a complete account');
          }

          // No profile exists — get auth user ID via admin or sign-in attempt
          // Try signing in to get the user ID so we can create the missing profile
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (signInError || !signInData.user) {
            throw new Error('This email is already registered. If you forgot the password, please contact the admin.');
          }

          authUserId = signInData.user.id;

          // Sign out immediately — we only needed the ID
          await supabase.auth.signOut();
        } else {
          throw new Error(authError.message);
        }
      } else if (!authData.user) {
        throw new Error('Failed to create auth account');
      } else {
        authUserId = authData.user.id;
      }

      // Create user profile in users table
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .insert({
          auth_id: authUserId,
          email: email.toLowerCase(),
          username: username.toLowerCase(),
          first_name: firstName,
          last_name: lastName,
          role: role || 'Therapist',
          business_id: businessId,
          branch_id: branchId || null,
          employee_id: employeeId,
          status: 'active',
        })
        .select()
        .single();

      if (profileError) {
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
          role: profileData.role as UserRole,
          employeeId: profileData.employee_id,
          businessId: profileData.business_id,
          branchId: profileData.branch_id,
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
  async signUp(
    email: string,
    password: string,
    metadata: Record<string, unknown> = {}
  ): Promise<SignUpResponse> {
    if (!isSupabaseConfigured() || !supabase) {
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
  async createUserProfile(
    authId: string,
    profileData: {
      email: string;
      username?: string;
      firstName?: string;
      lastName?: string;
      role?: UserRole;
      businessId?: string;
      employeeId?: string;
    }
  ): Promise<unknown> {
    if (!isSupabaseConfigured() || !supabase) {
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
  async signOut(): Promise<{ success: boolean }> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) {
          console.error('[AuthService] Sign out error:', error);
        }
      } catch (err) {
        console.error('[AuthService] Sign out exception:', err);
      }
    }

    this._currentUser = null;
    this._session = null;
    localStorage.removeItem('user');
    localStorage.removeItem('token');

    // Clear Supabase internal auth tokens as fallback
    // Supabase stores session in keys matching sb-*-auth-token
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        localStorage.removeItem(key);
      }
    });

    this._notifyListeners('SIGNED_OUT', null);

    return { success: true };
  }

  /**
   * Send password reset email
   */
  async resetPassword(email: string): Promise<PasswordResetResponse> {
    if (!isSupabaseConfigured() || !supabase) {
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
  async updatePassword(newPassword: string): Promise<{ success: boolean }> {
    if (!isSupabaseConfigured() || !supabase) {
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
  async getSession(): Promise<AuthSession | null> {
    if (!isSupabaseConfigured() || !supabase) {
      return null;
    }

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error) {
      throw new Error(error.message);
    }
    return session as unknown as AuthSession;
  }

  /**
   * Refresh session token
   */
  async refreshSession(): Promise<AuthSession | null> {
    if (!isSupabaseConfigured() || !supabase) {
      return null;
    }

    const {
      data: { session },
      error,
    } = await supabase.auth.refreshSession();
    if (error) {
      throw new Error(error.message);
    }
    return session as unknown as AuthSession;
  }

  /**
   * Check if Supabase is available
   */
  isOnline(): boolean {
    return isSupabaseConfigured();
  }
}

// Export singleton instance
const authService = new AuthService();
export default authService;
