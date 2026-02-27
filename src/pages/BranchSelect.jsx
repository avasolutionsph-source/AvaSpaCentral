import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const BranchSelect = () => {
  const navigate = useNavigate();
  const { user, selectedBranch, selectBranch, logout, isBranchOwner, getUserBranchId } = useApp();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // If user is already logged in and branch is selected, go to app
  useEffect(() => {
    if (user && selectedBranch) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, selectedBranch, navigate]);

  // Load branches from Supabase
  useEffect(() => {
    const loadBranches = async () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        setError('System not configured. Please contact administrator.');
        setLoading(false);
        return;
      }

      try {
        // Try with user's access token first (if logged in), then fall back to anon key
        let accessToken = supabaseKey;

        if (user) {
          try {
            const { supabase } = await import('../services/supabase/supabaseClient');
            if (supabase) {
              const { data: sessionData } = await supabase.auth.getSession();
              if (sessionData?.session?.access_token) {
                accessToken = sessionData.session.access_token;
              }
            }
          } catch (e) {
            // Fall back to anon key
          }
        }

        const response = await fetch(
          `${supabaseUrl}/rest/v1/branches?is_active=eq.true&order=display_order.asc,name.asc`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );

        if (!response.ok) throw new Error('Failed to load branches');

        const data = await response.json();
        setBranches(data || []);

        // If logged in as Branch Owner, auto-select their assigned branch
        if (user && isBranchOwner() && getUserBranchId()) {
          const assignedBranch = (data || []).find(b => b.id === getUserBranchId());
          if (assignedBranch) {
            selectBranch(assignedBranch);
            navigate('/dashboard', { replace: true });
            return;
          }
        }

        // If only one branch, auto-select it
        if (data && data.length === 1) {
          selectBranch(data[0]);
          if (user) {
            navigate('/dashboard', { replace: true });
          } else {
            navigate('/login', { replace: true });
          }
          return;
        }
      } catch (err) {
        console.error('Error loading branches:', err);
        setError('Failed to load branches. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadBranches();
  }, [user]);

  const handleSelectBranch = (branch) => {
    selectBranch(branch);
    if (user) {
      navigate('/dashboard', { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    setLoggingOut(false);
  };

  if (loading) {
    return (
      <div className="branch-select-page">
        <div className="branch-select-container">
          <div className="branch-select-loading">
            <div className="spinner"></div>
            <p>Loading branches...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="branch-select-page">
        <div className="branch-select-container">
          <div className="branch-select-header">
            <h1>Daet Massage & Spa</h1>
            <p className="branch-select-subtitle">Something went wrong</p>
          </div>
          <div className="branch-select-error">
            <p>{error}</p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If no branches returned (RLS blocking anon), prompt user to login first
  if (branches.length === 0 && !user) {
    return (
      <div className="branch-select-page">
        <div className="branch-select-container">
          <div className="branch-select-header">
            <h1>Daet Massage & Spa</h1>
            <p className="branch-select-subtitle">Please sign in to select a branch</p>
          </div>
          <div className="branch-select-login-prompt">
            <p>Sign in first to view available branches.</p>
            <button
              className="btn btn-primary btn-block"
              onClick={() => {
                // Temporarily set a placeholder branch to allow login flow
                // After login, user will be redirected back here to pick a real branch
                navigate('/login-first');
              }}
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (branches.length === 0 && user) {
    return (
      <div className="branch-select-page">
        <div className="branch-select-container">
          <div className="branch-select-header">
            <h1>Daet Massage & Spa</h1>
            <p className="branch-select-subtitle">No branches available</p>
          </div>
          <div className="branch-select-error">
            <p>No active branches found. Please contact your administrator.</p>
            <button className="btn btn-secondary" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? 'Logging out...' : 'Sign Out'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="branch-select-page">
      <div className="branch-select-container">
        <div className="branch-select-header">
          <h1>Daet Massage & Spa</h1>
          <p className="branch-select-subtitle">Choose a branch</p>
        </div>

        {user && (
          <div className="branch-select-user">
            Welcome, <strong>{user.firstName} {user.lastName}</strong>
            <span className="branch-select-role">{user.role}</span>
          </div>
        )}

        <div className="branch-select-grid">
          {branches.map((branch) => (
            <button
              key={branch.id}
              className="branch-card"
              onClick={() => handleSelectBranch(branch)}
            >
              <div className="branch-card-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <div className="branch-card-info">
                <h3>{branch.name}</h3>
                {branch.address && <p className="branch-card-address">{branch.address}</p>}
                {branch.city && <p className="branch-card-city">{branch.city}</p>}
              </div>
              <span className="branch-card-arrow">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </span>
            </button>
          ))}
        </div>

        {user && (
          <div className="branch-select-footer">
            <button className="btn-link" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? 'Logging out...' : 'Sign out'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BranchSelect;
