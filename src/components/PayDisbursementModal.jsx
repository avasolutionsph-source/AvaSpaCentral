/**
 * PayDisbursementModal — preset cousin of NewDisbursementModal.
 *
 * Caller already knows the sourceType, sourceId, amount, recipient, and
 * referenceCode. Modal just confirms and dispatches. If the recipient has
 * no bank info on file, embeds PayoutBankPanel inline; offers an optional
 * "save back to profile" checkbox so the operator only enters the bank
 * info once.
 */
import React, { useState } from 'react';
import { createDisbursement } from '../services/payments';
import { supabase } from '../services/supabase/supabaseClient';
import PayoutBankPanel, { EMPTY_PAYOUT_VALUE } from './PayoutBankPanel';

function formatPHP(amount) {
  return Number(amount ?? 0).toLocaleString('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  });
}

function hasBankInfo(payout) {
  return Boolean(payout?.bankCode && payout?.accountNumber && payout?.accountName);
}

export default function PayDisbursementModal({
  sourceType,
  sourceId,
  businessId,
  branchId,
  amount,
  recipient,
  recipientEntity,
  referenceCode,
  onClose,
  onSubmitted,
}) {
  const initialPayout = hasBankInfo(recipient?.payout)
    ? recipient.payout
    : { ...EMPTY_PAYOUT_VALUE };

  const [payout, setPayout] = useState(initialPayout);
  const [saveBackToProfile, setSaveBackToProfile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const needsBankEntry = !hasBankInfo(recipient?.payout);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!hasBankInfo(payout)) {
      setError('Bank info is required');
      return;
    }
    const numericAmount = Number(amount);
    if (!amount || isNaN(numericAmount) || numericAmount < 50) {
      setError('Amount is required and must be at least ₱50');
      return;
    }
    if (!recipient?.email?.trim()) {
      setError('Recipient email is required (NextPay sandbox enforces it)');
      return;
    }
    if (!recipient?.phone?.trim()) {
      setError('Recipient phone is required (NextPay sandbox enforces it)');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createDisbursement({
        sourceType,
        sourceId,
        businessId,
        branchId,
        referenceCode,
        recipients: [{
          amount: numericAmount,
          name: recipient.name,
          firstName: recipient.firstName || undefined,
          lastName: recipient.lastName || undefined,
          email: recipient.email,
          phoneNumber: recipient.phone,
          bankCode: payout.bankCode,
          accountNumber: payout.accountNumber,
          accountName: payout.accountName,
          method: payout.method || 'instapay',
        }],
      });

      // Optional: write bank info back to source profile so next time it's pre-filled.
      // We log save-back errors but DO NOT surface them as a modal error — the
      // disbursement itself succeeded and onSubmitted should still fire. The
      // operator will simply re-enter the bank info next time.
      if (saveBackToProfile && needsBankEntry && recipientEntity?.table && recipientEntity?.id && supabase) {
        const { error: saveErr } = await supabase
          .from(recipientEntity.table)
          .update({
            payout_bank_code: payout.bankCode,
            payout_account_number: payout.accountNumber,
            payout_account_name: payout.accountName,
            payout_method: payout.method || 'instapay',
          })
          .eq('id', recipientEntity.id);
        if (saveErr) {
          console.warn('[PayDisbursementModal] save bank info to profile failed:', saveErr.message);
        }
      }

      onSubmitted?.(result?.disbursements?.[0]);
      onClose?.();
    } catch (err) {
      console.error('[PayDisbursementModal] failed:', err);
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
        aria-labelledby="pay-disb-title"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 560 }}
      >
        <div className="modal-header">
          <h2 id="pay-disb-title">Pay via NextPay</h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <form className="modal-body" onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: 6 }}>
            <div><strong>Recipient:</strong> {recipient?.name}</div>
            <div><strong>Amount:</strong> {formatPHP(amount)}</div>
            <div><strong>Reference:</strong> <code>{referenceCode}</code></div>
            {recipient?.email && <div style={{ fontSize: '0.85rem', color: '#666' }}>{recipient.email} · {recipient.phone}</div>}
          </div>

          {needsBankEntry ? (
            <>
              <div style={{ padding: '0.5rem 0.75rem', background: '#fef9c3', borderRadius: 6, fontSize: '0.85rem' }}>
                No payout account on file for this recipient. Enter below; you can save it to the profile for next time.
              </div>
              <PayoutBankPanel value={payout} onChange={setPayout} disabled={submitting} showLabel={false} />
              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={saveBackToProfile}
                  onChange={(e) => setSaveBackToProfile(e.target.checked)}
                />
                Save payout account to {recipient?.name}'s profile for next time
              </label>
            </>
          ) : (
            <div style={{ fontSize: '0.85rem', color: '#475569' }}>
              🏦 Bank: <code>#{payout.bankCode}</code> · Acct <code>{payout.accountNumber}</code> · {payout.accountName}
            </div>
          )}

          {error && (
            <div role="alert" style={{ padding: '0.5rem 0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: 6, fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <div className="modal-footer" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send disbursement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
