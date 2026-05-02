/**
 * Disbursements page — admin view of all NextPay outbound payouts.
 *
 * Two modes:
 *   1. List view (default) — table of recent disbursements with live
 *      status badges (subscribes to Realtime + 10s polling fallback).
 *   2. New disbursement modal — "+ New Disbursement" button opens a
 *      form to mint a one-recipient disbursement: pick source-type,
 *      source-id, amount, recipient bank info, then Send.
 *
 * For batch disbursements (e.g. payroll cycle with N recipients), the
 * eventual per-workflow buttons in Payroll/Suppliers/Expenses pages
 * will call createDisbursement directly with all recipients in one
 * batch. This page handles the one-off / manual case + provides the
 * always-on audit log.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { DisbursementRepository, SettingsRepository } from '../services/storage/repositories';
import { createDisbursement } from '../services/payments';
import PayoutBankPanel, { EMPTY_PAYOUT_VALUE } from '../components/PayoutBankPanel';
import DisbursementStatusBadge from '../components/DisbursementStatusBadge';
import { supabase } from '../services/supabase/supabaseClient';

const SOURCE_TYPE_LABELS = {
  payroll_request: 'Payroll request',
  purchase_order: 'Purchase order',
  expense: 'Expense reimbursement',
};

function formatPHP(amount) {
  return Number(amount ?? 0).toLocaleString('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  });
}

function formatRelativeDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  return d.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
}

const Disbursements = () => {
  const { showToast, user, getEffectiveBranchId } = useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [enabledWorkflows, setEnabledWorkflows] = useState({
    payroll: false,
    supplierAp: false,
    expense: false,
  });

  const branchId = getEffectiveBranchId?.();

  // Initial fetch + Realtime subscription
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const data = await DisbursementRepository.getRecent({ branchId, limit: 100 });
        if (mounted) setRows(data);
      } catch (err) {
        console.error('[Disbursements] failed to load:', err);
        if (mounted) showToast?.('Failed to load disbursements', 'error');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    if (!supabase) return undefined;
    const channel = supabase
      .channel('disbursements-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'disbursements' },
        () => { if (mounted) load(); },
      )
      .subscribe();

    return () => {
      mounted = false;
      try { channel.unsubscribe(); } catch { /* best effort */ }
    };
  }, [branchId, showToast]);

  // Read which workflows are enabled
  useEffect(() => {
    let mounted = true;
    SettingsRepository.get('nextpaySettings').then((s) => {
      if (!mounted || !s) return;
      setEnabledWorkflows({
        payroll: Boolean(s.enableDisbursementsPayroll),
        supplierAp: Boolean(s.enableDisbursementsSupplierAp),
        expense: Boolean(s.enableDisbursementsExpense),
      });
    }).catch(() => { /* defaults stay false */ });
    return () => { mounted = false; };
  }, []);

  const noWorkflowEnabled = !enabledWorkflows.payroll
    && !enabledWorkflows.supplierAp
    && !enabledWorkflows.expense;

  return (
    <div className="page-container" style={{ padding: 'var(--spacing-lg, 1.5rem)' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1>Disbursements</h1>
          <p style={{ color: '#666', margin: '0.25rem 0 0' }}>
            Outbound NextPay payouts — payroll, supplier AP, and expense reimbursements.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowModal(true)}
          disabled={noWorkflowEnabled}
          title={noWorkflowEnabled ? 'Enable a workflow in Settings → Payments first' : undefined}
        >
          + New Disbursement
        </button>
      </div>

      {noWorkflowEnabled && (
        <div style={{
          padding: '0.75rem 1rem',
          background: '#fef9c3',
          border: '1px solid #fde047',
          borderRadius: 8,
          marginBottom: '1rem',
          fontSize: '0.9rem',
        }}>
          ⚠️ No disbursement workflow is enabled yet. Open <strong>Settings → Payments → Disbursements</strong>
          and tick at least one of payroll / supplier AP / expense to allow new disbursements.
        </div>
      )}

      {loading ? (
        <div className="page-loading"><div className="spinner"></div><p>Loading…</p></div>
      ) : rows.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666', background: '#f8fafc', borderRadius: 8 }}>
          No disbursements yet. Click <strong>+ New Disbursement</strong> to send your first one.
        </div>
      ) : (
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
              <th style={{ padding: '0.6rem' }}>When</th>
              <th style={{ padding: '0.6rem' }}>Source</th>
              <th style={{ padding: '0.6rem' }}>Recipient</th>
              <th style={{ padding: '0.6rem' }}>Bank</th>
              <th style={{ padding: '0.6rem', textAlign: 'right' }}>Amount</th>
              <th style={{ padding: '0.6rem' }}>Status</th>
              <th style={{ padding: '0.6rem' }}>NextPay ref</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                <td style={{ padding: '0.6rem' }} title={new Date(r.created_at).toLocaleString()}>
                  {formatRelativeDate(r.created_at)}
                </td>
                <td style={{ padding: '0.6rem' }}>{SOURCE_TYPE_LABELS[r.source_type] ?? r.source_type}</td>
                <td style={{ padding: '0.6rem' }}>{r.recipient_name}</td>
                <td style={{ padding: '0.6rem', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                  #{r.recipient_bank_code} · {r.recipient_account_number}
                </td>
                <td style={{ padding: '0.6rem', textAlign: 'right' }}>{formatPHP(r.amount)}</td>
                <td style={{ padding: '0.6rem' }}>
                  <DisbursementStatusBadge status={r.status} failureReason={r.failure_reason} />
                </td>
                <td style={{ padding: '0.6rem', fontFamily: 'monospace', fontSize: '0.8rem', color: '#475569' }}>
                  {r.nextpay_reference_id ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
        <NewDisbursementModal
          businessId={user?.businessId}
          branchId={branchId}
          enabledWorkflows={enabledWorkflows}
          onClose={() => setShowModal(false)}
          onSubmitted={() => {
            setShowModal(false);
            showToast?.('Disbursement submitted to NextPay', 'success');
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
};

function NewDisbursementModal({
  businessId,
  branchId,
  enabledWorkflows,
  onClose,
  onSubmitted,
  showToast,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    sourceType: enabledWorkflows.payroll ? 'payroll_request'
      : enabledWorkflows.supplierAp ? 'purchase_order'
      : 'expense',
    sourceId: '',
    amount: '',
    referenceCode: '',
    notes: '',
    recipientName: '',
    recipientFirstName: '',
    recipientLastName: '',
    recipientEmail: '',
    recipientPhone: '',
    payout: { ...EMPTY_PAYOUT_VALUE },
  });
  const [error, setError] = useState(null);

  const allowedSourceTypes = useMemo(() => {
    const out = [];
    if (enabledWorkflows.payroll) out.push({ value: 'payroll_request', label: 'Payroll request' });
    if (enabledWorkflows.supplierAp) out.push({ value: 'purchase_order', label: 'Purchase order' });
    if (enabledWorkflows.expense) out.push({ value: 'expense', label: 'Expense reimbursement' });
    return out;
  }, [enabledWorkflows]);

  const setField = (field, val) => setForm((f) => ({ ...f, [field]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const amount = Number(form.amount);
    if (!amount || amount <= 0) { setError('Amount must be > 0'); return; }
    if (!form.sourceId.trim()) { setError('Source ID is required'); return; }
    if (!form.referenceCode.trim()) { setError('Reference code is required'); return; }
    if (!form.recipientName.trim()) { setError('Recipient name is required'); return; }
    if (!form.payout.bankCode) { setError('Pick a bank'); return; }
    if (!form.payout.accountNumber.trim()) { setError('Account number is required'); return; }
    if (!form.payout.accountName.trim()) { setError('Account name is required'); return; }

    setSubmitting(true);
    try {
      await createDisbursement({
        sourceType: form.sourceType,
        sourceId: form.sourceId.trim(),
        businessId,
        branchId,
        referenceCode: form.referenceCode.trim(),
        notes: form.notes.trim() || undefined,
        recipients: [{
          amount,
          name: form.recipientName.trim(),
          firstName: form.recipientFirstName.trim() || undefined,
          lastName: form.recipientLastName.trim() || undefined,
          email: form.recipientEmail.trim() || undefined,
          phoneNumber: form.recipientPhone.trim() || undefined,
          bankCode: form.payout.bankCode,
          accountNumber: form.payout.accountNumber.trim(),
          accountName: form.payout.accountName.trim(),
          method: form.payout.method,
        }],
      });
      onSubmitted();
    } catch (err) {
      console.error('[NewDisbursementModal] failed:', err);
      setError(err?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal modal-large"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-disb-title"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 720 }}
      >
        <div className="modal-header">
          <h2 id="new-disb-title">New Disbursement</h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <form className="modal-body" onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: '1fr 1fr' }}>
            <label>
              <div style={{ fontWeight: 500, fontSize: '0.85rem', marginBottom: '0.2rem' }}>Source</div>
              <select
                value={form.sourceType}
                onChange={(e) => setField('sourceType', e.target.value)}
                className="form-input"
                style={{ width: '100%' }}
              >
                {allowedSourceTypes.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
            <label>
              <div style={{ fontWeight: 500, fontSize: '0.85rem', marginBottom: '0.2rem' }}>Source ID</div>
              <input
                type="text"
                value={form.sourceId}
                onChange={(e) => setField('sourceId', e.target.value)}
                placeholder="e.g. payroll request UUID"
                className="form-input"
                style={{ width: '100%' }}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: '1fr 1fr' }}>
            <label>
              <div style={{ fontWeight: 500, fontSize: '0.85rem', marginBottom: '0.2rem' }}>Amount (PHP)</div>
              <input
                type="number"
                min={1}
                step="0.01"
                value={form.amount}
                onChange={(e) => setField('amount', e.target.value)}
                className="form-input"
                style={{ width: '100%' }}
              />
            </label>
            <label>
              <div style={{ fontWeight: 500, fontSize: '0.85rem', marginBottom: '0.2rem' }}>Reference code</div>
              <input
                type="text"
                value={form.referenceCode}
                onChange={(e) => setField('referenceCode', e.target.value)}
                placeholder="e.g. PAY-2026-04-30"
                className="form-input"
                style={{ width: '100%' }}
              />
            </label>
          </div>

          <label>
            <div style={{ fontWeight: 500, fontSize: '0.85rem', marginBottom: '0.2rem' }}>Notes (optional)</div>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              placeholder="Internal note"
              className="form-input"
              style={{ width: '100%' }}
            />
          </label>

          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '0.25rem 0' }} />

          <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: '1fr 1fr 1fr' }}>
            <label>
              <div style={{ fontWeight: 500, fontSize: '0.85rem', marginBottom: '0.2rem' }}>Recipient name *</div>
              <input
                type="text"
                value={form.recipientName}
                onChange={(e) => setField('recipientName', e.target.value)}
                className="form-input"
                style={{ width: '100%' }}
              />
            </label>
            <label>
              <div style={{ fontWeight: 500, fontSize: '0.85rem', marginBottom: '0.2rem' }}>First name</div>
              <input
                type="text"
                value={form.recipientFirstName}
                onChange={(e) => setField('recipientFirstName', e.target.value)}
                className="form-input"
                style={{ width: '100%' }}
              />
            </label>
            <label>
              <div style={{ fontWeight: 500, fontSize: '0.85rem', marginBottom: '0.2rem' }}>Last name</div>
              <input
                type="text"
                value={form.recipientLastName}
                onChange={(e) => setField('recipientLastName', e.target.value)}
                className="form-input"
                style={{ width: '100%' }}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: '1fr 1fr' }}>
            <label>
              <div style={{ fontWeight: 500, fontSize: '0.85rem', marginBottom: '0.2rem' }}>Email (optional)</div>
              <input
                type="email"
                value={form.recipientEmail}
                onChange={(e) => setField('recipientEmail', e.target.value)}
                className="form-input"
                style={{ width: '100%' }}
              />
            </label>
            <label>
              <div style={{ fontWeight: 500, fontSize: '0.85rem', marginBottom: '0.2rem' }}>Phone (optional)</div>
              <input
                type="tel"
                value={form.recipientPhone}
                onChange={(e) => setField('recipientPhone', e.target.value)}
                placeholder="+639..."
                className="form-input"
                style={{ width: '100%' }}
              />
            </label>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '0.25rem 0' }} />

          <PayoutBankPanel
            value={form.payout}
            onChange={(v) => setField('payout', v)}
            disabled={submitting}
          />

          {error && (
            <div style={{ padding: '0.5rem 0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: 6, fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <div className="modal-footer" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Send disbursement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Disbursements;
