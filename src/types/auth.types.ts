/**
 * Authentication Types
 */

// User roles
export type UserRole = 'Owner' | 'Manager' | 'Branch Owner' | 'Receptionist' | 'Therapist';

// User status
export type UserStatus = 'active' | 'inactive';

// User profile (app format)
export interface UserProfile {
  _id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  employeeId?: string;
  businessId: string;
  branchId?: string;
  status: UserStatus;
}

// Supabase auth session
export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
  user: {
    id: string;
    email?: string;
    aud?: string;
    role?: string;
  };
}

// Auth state change events
export type AuthEvent =
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'TOKEN_REFRESHED'
  | 'PASSWORD_RECOVERY'
  | 'USER_UPDATED'
  | 'INITIAL_SESSION';

// Auth listener callback
export type AuthListener = (
  event: AuthEvent,
  session: AuthSession | null,
  user: UserProfile | null
) => void;

// Sign in response
export interface SignInResponse {
  success: boolean;
  user: UserProfile;
  session: AuthSession;
}

// Sign up response
export interface SignUpResponse {
  success: boolean;
  user: unknown;
  message: string;
}

// Create staff account params
export interface CreateStaffParams {
  username: string;
  password: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  employeeId?: string;
  businessId: string;
  branchId?: string;
}

// Create staff response
export interface CreateStaffResponse {
  success: boolean;
  user: UserProfile;
  message: string;
}

// Password reset response
export interface PasswordResetResponse {
  success: boolean;
  message: string;
}
