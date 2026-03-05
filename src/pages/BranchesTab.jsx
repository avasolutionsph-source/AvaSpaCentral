import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';

const BranchesTab = () => {
  const { user, showToast } = useApp();
  const [branches, setBranches] = useState([]);
  const [branchStaff, setBranchStaff] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    address: '',
    city: '',
    phone: '',
    is_active: true,
    display_order: 1,
    home_service_fee: 0,
    hotel_service_fee: 0
  });

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const getHeaders = useCallback(async () => {
    let accessToken = supabaseKey;
    try {
      const { supabase } = await import('../services/supabase/supabaseClient');
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.access_token) accessToken = data.session.access_token;
      }
    } catch {}
    return {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  }, [supabaseKey]);

  const loadBranches = useCallback(async () => {
    if (!supabaseUrl || !supabaseKey || !user?.businessId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const headers = await getHeaders();
      const res = await fetch(
        `${supabaseUrl}/rest/v1/branches?business_id=eq.${user.businessId}&order=display_order.asc,name.asc`,
        { headers }
      );
      if (res.ok) {
        setBranches(await res.json());
      }
    } catch (err) {
      console.error('Failed to load branches:', err);
    } finally {
      setLoading(false);
    }
  }, [supabaseUrl, supabaseKey, user?.businessId, getHeaders]);

  const loadStaff = useCallback(async () => {
    if (!supabaseUrl || !supabaseKey || !user?.businessId) return;
    try {
      const headers = await getHeaders();
      const res = await fetch(
        `${supabaseUrl}/rest/v1/users?business_id=eq.${user.businessId}&status=eq.active&select=id,username,email,first_name,last_name,role,branch_id`,
        { headers }
      );
      if (res.ok) {
        const staff = await res.json();
        const grouped = {};
        staff.forEach(s => {
          const key = s.branch_id || 'unassigned';
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(s);
        });
        setBranchStaff(grouped);
      }
    } catch (err) {
      console.error('Failed to load staff:', err);
    }
  }, [supabaseUrl, supabaseKey, user?.businessId, getHeaders]);

  useEffect(() => { loadBranches(); }, [loadBranches]);
  useEffect(() => { if (branches.length > 0) loadStaff(); }, [branches, loadStaff]);

  const generateSlug = (name) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'branch';
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    setFormData(prev => {
      const updated = { ...prev, [name]: newValue };
      if (name === 'name' && modalMode === 'create') {
        updated.slug = generateSlug(value);
      }
      return updated;
    });
  };

  const openCreate = () => {
    setModalMode('create');
    setSelectedBranch(null);
    setFormData({
      name: '',
      slug: '',
      address: '',
      city: '',
      phone: '',
      is_active: true,
      display_order: branches.length + 1,
      home_service_fee: 100,
      hotel_service_fee: 200
    });
    setShowModal(true);
  };

  const openEdit = (branch) => {
    setModalMode('edit');
    setSelectedBranch(branch);
    setFormData({
      name: branch.name || '',
      slug: branch.slug || '',
      address: branch.address || '',
      city: branch.city || '',
      phone: branch.phone || '',
      is_active: branch.is_active !== false,
      display_order: branch.display_order || 1,
      home_service_fee: branch.home_service_fee || 0,
      hotel_service_fee: branch.hotel_service_fee || 0
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('Branch name is required', 'error');
      return;
    }

    setSaving(true);
    try {
      const headers = await getHeaders();
      const payload = {
        business_id: user.businessId,
        name: formData.name.trim(),
        slug: formData.slug.trim() || generateSlug(formData.name),
        address: formData.address.trim() || null,
        city: formData.city.trim() || null,
        phone: formData.phone.trim() || null,
        is_active: formData.is_active,
        display_order: parseInt(formData.display_order) || 1,
        home_service_fee: parseFloat(formData.home_service_fee) || 0,
        hotel_service_fee: parseFloat(formData.hotel_service_fee) || 0
      };

      let res;
      if (modalMode === 'create') {
        res = await fetch(`${supabaseUrl}/rest/v1/branches`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${supabaseUrl}/rest/v1/branches?id=eq.${selectedBranch.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to save branch');
      }

      showToast(modalMode === 'create' ? 'Branch created!' : 'Branch updated!', 'success');
      setShowModal(false);
      loadBranches();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (branch) => {
    try {
      const headers = await getHeaders();
      const res = await fetch(`${supabaseUrl}/rest/v1/branches?id=eq.${branch.id}`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) throw new Error('Failed to delete');
      showToast('Branch deleted', 'success');
      setDeleteConfirm(null);
      loadBranches();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const toggleActive = async (branch) => {
    try {
      const headers = await getHeaders();
      const res = await fetch(`${supabaseUrl}/rest/v1/branches?id=eq.${branch.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ is_active: !branch.is_active })
      });
      if (!res.ok) throw new Error('Failed to update');
      showToast(branch.is_active ? 'Branch deactivated' : 'Branch activated', 'success');
      loadBranches();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const formatCurrency = (amount) => {
    return `\u20B1${parseFloat(amount || 0).toLocaleString()}`;
  };

  if (loading) {
    return (
      <div className="settings-content">
        <div className="settings-section">
          <p style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>Loading branches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-content">
      <div className="settings-section">
        <div className="settings-section-header">
          <div className="settings-section-icon">🏪</div>
          <div className="settings-section-title">
            <h2>Branch Management</h2>
            <p>Manage your business branches and service location fees</p>
          </div>
        </div>
        <div className="settings-section-body">

          {/* Info Banner */}
          <div className="branch-info-banner">
            <div className="branch-info-banner-icon">i</div>
            <div>
              <strong>Multi-Branch Booking</strong>
              <p>Add branches to let customers select their preferred location when booking. Each branch can have different home/hotel service fees.</p>
            </div>
          </div>

          {/* Branch List */}
          {branches.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
              <p>No branches yet. Click "+ Add Branch" to create your first location.</p>
            </div>
          ) : (
            <div className="branches-list">
              {branches.map((branch) => (
                <div key={branch.id} className="branch-item">
                  <div className="branch-item-info">
                    <div className="branch-item-header">
                      <h3 className="branch-item-name">{branch.name}</h3>
                      <span className={`branch-status-badge ${branch.is_active ? 'active' : 'inactive'}`}>
                        {branch.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </div>
                    <p className="branch-item-slug">/book/{branch.business_id}/{branch.slug}</p>
                    {branch.address && <p className="branch-item-detail">{branch.address}</p>}
                    {branch.city && <p className="branch-item-detail">{branch.city}</p>}
                  </div>

                  <div className="branch-item-fees">
                    <div className="branch-fee-row">
                      <span className="branch-fee-label">Home Service:</span>
                      <span className="branch-fee-value">{formatCurrency(branch.home_service_fee)}</span>
                    </div>
                    <div className="branch-fee-row">
                      <span className="branch-fee-label">Hotel Service:</span>
                      <span className="branch-fee-value">{formatCurrency(branch.hotel_service_fee)}</span>
                    </div>
                  </div>

                  <div className="branch-item-actions">
                    <button
                      className={`btn btn-sm ${branch.is_active ? 'btn-warning' : 'btn-success'}`}
                      onClick={() => toggleActive(branch)}
                    >
                      {branch.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button className="btn btn-sm btn-secondary" onClick={() => openEdit(branch)}>Edit</button>
                    <button className="btn btn-sm btn-error" onClick={() => setDeleteConfirm(branch)}>Delete</button>
                  </div>

                  {/* POS Access Info */}
                  <div className="branch-pos-access">
                    <h4 style={{ fontSize: '0.85rem', color: '#555', margin: '0 0 0.5rem', borderTop: '1px solid #eee', paddingTop: '0.75rem' }}>POS Access</h4>
                    <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.5rem' }}>
                      Login URL: <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: '3px', fontSize: '0.75rem' }}>{window.location.origin}/login</code>
                    </div>
                    {(() => {
                      const staff = branchStaff[branch.id] || [];
                      const unassigned = branchStaff['unassigned'] || [];
                      const allStaff = [...staff, ...unassigned];
                      if (allStaff.length === 0) {
                        return <p style={{ fontSize: '0.8rem', color: '#999', fontStyle: 'italic' }}>No staff assigned. Add staff in Staff Management.</p>;
                      }
                      return (
                        <div style={{ fontSize: '0.8rem' }}>
                          {allStaff.map(s => (
                            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
                              <span><strong>{s.first_name} {s.last_name}</strong> <span style={{ color: '#888' }}>({s.role})</span></span>
                              <span style={{ color: '#555' }}>{s.username || s.email}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Branch Button */}
          <div style={{ marginTop: '1.5rem' }}>
            <button className="btn btn-primary" onClick={openCreate}>+ Add Branch</button>
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === 'create' ? 'Add Branch' : 'Edit Branch'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Branch Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="form-control"
                    placeholder="e.g. Main Branch, Downtown Location"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>URL Slug</label>
                  <input
                    type="text"
                    name="slug"
                    value={formData.slug}
                    onChange={handleChange}
                    className="form-control"
                    placeholder="auto-generated-from-name"
                  />
                  <small style={{ color: '#888' }}>Booking URL: /book/.../{formData.slug || 'slug'}</small>
                </div>
                <div className="form-group">
                  <label>Address</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="form-control"
                    placeholder="Street address"
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>City</label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      className="form-control"
                      placeholder="City"
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input
                      type="text"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="form-control"
                      placeholder="Contact number"
                    />
                  </div>
                </div>

                {/* Service Location Fees */}
                <h4 style={{ margin: '1.25rem 0 0.75rem', fontSize: '0.95rem', color: '#333' }}>Service Location Fees</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Home Service Fee</label>
                    <input
                      type="number"
                      name="home_service_fee"
                      value={formData.home_service_fee}
                      onChange={handleChange}
                      onWheel={(e) => e.target.blur()}
                      className="form-control"
                      min="0"
                      step="10"
                    />
                  </div>
                  <div className="form-group">
                    <label>Hotel Service Fee</label>
                    <input
                      type="number"
                      name="hotel_service_fee"
                      value={formData.hotel_service_fee}
                      onChange={handleChange}
                      onWheel={(e) => e.target.blur()}
                      className="form-control"
                      min="0"
                      step="10"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Display Order</label>
                    <input
                      type="number"
                      name="display_order"
                      value={formData.display_order}
                      onChange={handleChange}
                      onWheel={(e) => e.target.blur()}
                      className="form-control"
                      min="1"
                    />
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={formData.is_active}
                      onChange={handleChange}
                      id="branch-active"
                    />
                    <label htmlFor="branch-active" style={{ margin: 0, fontWeight: 'normal' }}>Active</label>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : modalMode === 'create' ? 'Create Branch' : 'Update Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Delete Branch</h2>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}>×</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?</p>
              <p style={{ color: '#ef4444', fontSize: '0.875rem' }}>This action cannot be undone. All data associated with this branch will be permanently removed.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-error" onClick={() => handleDelete(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchesTab;
