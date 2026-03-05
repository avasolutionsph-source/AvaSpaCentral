import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getBrandingSettings, applyColorTheme } from '../services/brandingService';

const BranchSelect = () => {
  const navigate = useNavigate();
  const { user, selectedBranch, selectBranch, logout, isBranchOwner, getUserBranchId, getFirstPage, isOwner, isManager } = useApp();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [branding, setBranding] = useState({ logoUrl: null, coverPhotoUrl: null, primaryColor: null });

  // Helper: staff → POS/dashboard, public → booking page
  const getRedirectPath = (branch) => {
    if (user) return getFirstPage();
    return `/book/${branch.business_id}/${branch.slug}`;
  };

  // No auto-redirect - always show branch selection so user can choose

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

        // Filter by business_id when user is logged in
        let branchQuery = `${supabaseUrl}/rest/v1/branches?is_active=eq.true&order=display_order.asc,name.asc`;
        if (user?.businessId) {
          branchQuery += `&business_id=eq.${user.businessId}`;
        }

        const response = await fetch(branchQuery, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${accessToken}`
          }
        });

        if (!response.ok) throw new Error('Failed to load branches');

        let data = await response.json();

        // For public access (not logged in), filter out orphan branches
        // Only show branches whose business has at least one active user
        if (!user && data && data.length > 0) {
          try {
            const businessIds = [...new Set(data.map(b => b.business_id))];
            const usersRes = await fetch(
              `${supabaseUrl}/rest/v1/users?status=eq.active&business_id=in.(${businessIds.join(',')})&select=business_id`,
              { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
            );
            if (usersRes.ok) {
              const usersData = await usersRes.json();
              const activeBusinessIds = new Set(usersData.map(u => u.business_id));
              data = data.filter(b => activeBusinessIds.has(b.business_id));
            }
          } catch (e) {
            // If orphan check fails, show all branches
            console.warn('[BranchSelect] Orphan filter failed:', e);
          }
        }

        // Auto-create default branch for Owner/Manager if no branches exist
        if ((!data || data.length === 0) && user && (isOwner() || isManager()) && user.businessId) {
          try {
            // Get business name for the branch
            const bizRes = await fetch(
              `${supabaseUrl}/rest/v1/businesses?id=eq.${user.businessId}&select=name`,
              { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${accessToken}` } }
            );
            const bizData = bizRes.ok ? await bizRes.json() : [];
            const businessName = bizData?.[0]?.name || 'Main Branch';
            const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'main';

            const branchPayload = {
              business_id: user.businessId,
              name: businessName,
              slug: slug,
              is_active: true,
              display_order: 1
            };

            const createRes = await fetch(
              `${supabaseUrl}/rest/v1/branches`,
              {
                method: 'POST',
                headers: {
                  'apikey': supabaseKey,
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                  'Prefer': 'return=representation'
                },
                body: JSON.stringify(branchPayload)
              }
            );

            if (createRes.ok) {
              data = await createRes.json();
              console.log('[BranchSelect] Auto-created default branch:', data);
            }
          } catch (e) {
            console.error('[BranchSelect] Failed to auto-create branch:', e);
          }
        }

        setBranches(data || []);

        // If logged in as Branch Owner, auto-select their assigned branch
        if (user && isBranchOwner() && getUserBranchId()) {
          const assignedBranch = (data || []).find(b => b.id === getUserBranchId());
          if (assignedBranch) {
            selectBranch(assignedBranch);
            return; // useEffect will handle redirect
          }
        }

        // Always show branch selection - let user choose even if only one branch
      } catch (err) {
        console.error('Error loading branches:', err);
        setError('Failed to load branches. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadBranches();
  }, [user]);

  // Load branding separately (non-blocking)
  useEffect(() => {
    if (branches.length > 0 && branches[0].business_id) {
      getBrandingSettings(branches[0].business_id)
        .then(data => {
          setBranding(data);
          if (data.primaryColor) applyColorTheme(data.primaryColor);
        })
        .catch(() => {});
    }
  }, [branches]);

  const handleSelectBranch = (branch) => {
    selectBranch(branch);
    // Staff → POS/dashboard, Public → booking page
    navigate(getRedirectPath(branch), { replace: true });
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

  if (branches.length === 0) {
    return (
      <div className="branch-select-page">
        <div className="branch-select-container">
          <div className="branch-select-header">
            <h1>Daet Massage & Spa</h1>
            <p className="branch-select-subtitle">No branches available</p>
          </div>
          <div className="branch-select-error">
            <p>No active branches found. Please try again later.</p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="branch-select-page">
      {/* Cover photo hero */}
      {branding.coverPhotoUrl && (
        <div
          className="branch-select-hero"
          style={{ backgroundImage: `url(${branding.coverPhotoUrl})` }}
        >
          <div className="branch-select-hero-overlay">
            {branding.logoUrl && (
              <img src={branding.logoUrl} alt="Logo" className="branch-select-hero-logo" />
            )}
          </div>
        </div>
      )}

      <div className="branch-select-container">
        <div className="branch-select-header">
          {!branding.coverPhotoUrl && branding.logoUrl && (
            <img src={branding.logoUrl} alt="Logo" className="branch-select-header-logo" />
          )}
          {!branding.logoUrl && <h1>Daet Massage &amp; Spa</h1>}
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
