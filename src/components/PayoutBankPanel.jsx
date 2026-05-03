/**
 * PayoutBankPanel — reusable bank-info form for NextPay disbursement
 * recipients. Used in three places:
 *
 *   - Employees → edit modal (saves to employees.payout_*)
 *   - Suppliers → edit modal (saves to suppliers.payout_*)
 *   - Expense reimbursement modal (one-shot capture, not persisted)
 *
 * Renders a controlled form with bank dropdown (live from NextPay),
 * account #, account name, and method dropdown (filtered to the bank's
 * supported methods).
 *
 * Props:
 *   - value: { bankCode, accountNumber, accountName, method }
 *   - onChange: (next) => void
 *   - disabled: boolean
 *   - showLabel: boolean (defaults true; set false for tight inline use)
 */
import { useMemo } from 'react';
import { useNextpayBanks } from '../hooks/useNextpayBanks';

const EMPTY_VALUE = {
  bankCode: null,
  accountNumber: '',
  accountName: '',
  method: 'instapay',
};

export default function PayoutBankPanel({
  value,
  onChange,
  disabled = false,
  showLabel = true,
}) {
  const v = { ...EMPTY_VALUE, ...(value ?? {}) };
  const { banks, loading, error } = useNextpayBanks();

  const selectedBank = useMemo(
    () => banks?.find((b) => b.id === v.bankCode) ?? null,
    [banks, v.bankCode],
  );

  const allowedMethods = selectedBank?.methods ?? ['instapay', 'pesonet'];

  const setField = (field, val) => onChange?.({ ...v, [field]: val });

  const onBankChange = (bankCode) => {
    const next = { ...v, bankCode };
    // If the new bank doesn't support the current method, fall back to the
    // first allowed method for that bank.
    const newBank = banks?.find((b) => b.id === bankCode);
    if (newBank && !newBank.methods?.includes(v.method)) {
      next.method = newBank.methods?.[0] ?? 'instapay';
    }
    onChange?.(next);
  };

  // Optional client-side account-number validation per the bank's rule.
  const accountValidation = useMemo(() => {
    const rule = selectedBank?.account_number_validation;
    if (!rule || !v.accountNumber) return null;
    const len = v.accountNumber.length;
    const errs = [];
    if (rule.min != null && len < rule.min) errs.push(`min ${rule.min} digits`);
    if (rule.max != null && len > rule.max) errs.push(`max ${rule.max} digits`);
    if (Array.isArray(rule.fixed) && !rule.fixed.includes(len)) {
      errs.push(`must be ${rule.fixed.join(' or ')} digits`);
    }
    return errs.length ? errs.join(', ') : null;
  }, [selectedBank, v.accountNumber]);

  return (
    <div className="payout-bank-panel" style={{ display: 'grid', gap: '0.5rem', maxWidth: 480 }}>
      {showLabel && (
        <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.95rem' }}>Bank account for payouts</h4>
      )}

      <label>
        <div style={{ fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.2rem' }}>Bank</div>
        <select
          value={v.bankCode ?? ''}
          onChange={(e) => onBankChange(e.target.value ? Number(e.target.value) : null)}
          disabled={disabled || loading}
          className="form-input"
          style={{ width: '100%' }}
        >
          <option value="">{loading ? 'Loading…' : '— select —'}</option>
          {banks?.filter((b) => b.status === 'enabled').map((b) => (
            <option key={b.id} value={b.id}>
              {b.label_short || b.label}
            </option>
          ))}
        </select>
        {error && (
          <div style={{ fontSize: '0.75rem', color: '#c00', marginTop: '0.2rem' }}>
            Failed to load banks: {error.message}
          </div>
        )}
      </label>

      <label>
        <div style={{ fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.2rem' }}>Account number</div>
        <input
          type="text"
          inputMode="numeric"
          value={v.accountNumber}
          onChange={(e) => setField('accountNumber', e.target.value.replace(/\D/g, ''))}
          disabled={disabled}
          placeholder="Account number"
          className="form-input"
          style={{ width: '100%' }}
        />
        {accountValidation && (
          <div style={{ fontSize: '0.75rem', color: '#c00', marginTop: '0.2rem' }}>
            {accountValidation}
          </div>
        )}
      </label>

      <label>
        <div style={{ fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.2rem' }}>Account name</div>
        <input
          type="text"
          value={v.accountName}
          onChange={(e) => setField('accountName', e.target.value)}
          disabled={disabled}
          placeholder="Name as registered with the bank"
          className="form-input"
          style={{ width: '100%' }}
        />
      </label>

      <label>
        <div style={{ fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.2rem' }}>Method</div>
        <select
          value={v.method}
          onChange={(e) => setField('method', e.target.value)}
          disabled={disabled || !selectedBank}
          className="form-input"
          style={{ width: '100%' }}
        >
          {allowedMethods.map((m) => (
            <option key={m} value={m}>
              {m === 'instapay' ? 'InstaPay (under ₱50,000, instant)' :
               m === 'pesonet' ? 'PESONet (any amount, batch settled)' :
               m}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export { EMPTY_VALUE as EMPTY_PAYOUT_VALUE };
