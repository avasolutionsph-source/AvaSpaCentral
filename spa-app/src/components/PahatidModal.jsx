import React, { useEffect, useState } from 'react';
import mockApi from '../mockApi';
import { useApp } from '../context/AppContext';

const REASONS = [
  'Going home',
  'Personal errand',
  'Office / branch',
  'Pick up supplies',
  'Other',
];

export default function PahatidModal({ open, onClose, onCreated }) {
  const { user, showToast, getEffectiveBranchId } = useApp();
  const [destination, setDestination] = useState('');
  const [reason, setReason] = useState(REASONS[0]);
  const [reasonOther, setReasonOther] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setDestination('');
      setReason(REASONS[0]);
      setReasonOther('');
      setPickupAddress('');
      setSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const branchId = getEffectiveBranchId?.() || user?.branchId || null;
  const canSubmit = destination.trim().length > 0 && !submitting && !!branchId;

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const requesterName = (user?.name
        || `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
        || user?.username
        || user?.email
        || 'User').trim();
      const finalReason = reason === 'Other' ? (reasonOther.trim() || 'Other') : reason;
      await mockApi.transportRequests.createTransportRequest({
        branchId,
        requestedByUserId: user?._id || user?.id || null,
        requestedByName: requesterName,
        requestedByRole: user?.role || 'User',
        pickupAddress: pickupAddress.trim() || null,
        destinationAddress: destination.trim(),
        reason: finalReason,
        status: 'pending',
      });
      showToast('Pahatid requested — rider notified', 'success');
      onCreated?.();
      onClose?.();
    } catch (err) {
      console.error('[Pahatid] create failed', err);
      showToast(err?.message || 'Failed to request pahatid', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Request pahatid"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(15, 23, 42, 0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 12,
      }}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480,
          background: '#fff', borderRadius: 12, overflow: 'hidden',
          boxShadow: '0 25px 50px rgba(0,0,0,0.35)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#f8fafc',
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a' }}>🚖 Request Pahatid</div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Notify a rider to drop you off at a destination</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ background: 'transparent', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#0f172a' }}>
            ✕
          </button>
        </div>

        <div style={{ padding: 16, display: 'grid', gap: 12 }}>
          {!branchId && (
            <div style={{
              padding: '8px 10px', borderRadius: 6,
              background: '#fef2f2', border: '1px solid #fecaca',
              color: '#991b1b', fontSize: '0.85rem',
            }}>
              Your account isn't linked to a branch — cannot request pahatid.
            </div>
          )}

          <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem', color: '#0f172a' }}>
            <span style={{ fontWeight: 600 }}>Destination address *</span>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              required
              autoFocus
              placeholder="e.g. 123 Main St., City"
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem', color: '#0f172a' }}>
            <span style={{ fontWeight: 600 }}>Pick me up at <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></span>
            <input
              type="text"
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
              placeholder="Leave blank if at the spa / branch"
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem', color: '#0f172a' }}>
            <span style={{ fontWeight: 600 }}>Reason</span>
            <select value={reason} onChange={(e) => setReason(e.target.value)} style={inputStyle}>
              {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>

          {reason === 'Other' && (
            <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem', color: '#0f172a' }}>
              <span style={{ fontWeight: 600 }}>Specify reason</span>
              <input
                type="text"
                value={reasonOther}
                onChange={(e) => setReasonOther(e.target.value)}
                placeholder="Briefly explain"
                style={inputStyle}
              />
            </label>
          )}
        </div>

        <div style={{
          padding: '10px 14px', borderTop: '1px solid #e5e7eb', background: '#f8fafc',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="btn btn-primary"
            style={{ fontWeight: 700 }}
          >
            {submitting ? 'Requesting…' : 'Notify rider'}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputStyle = {
  padding: '8px 10px',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  fontSize: '0.9rem',
  outline: 'none',
};
