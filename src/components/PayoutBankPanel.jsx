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
import { useEffect, useMemo, useRef, useState } from 'react';
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

  // --- Bank combobox (typeahead) ---
  const [bankSearch, setBankSearch] = useState('');
  const [bankOpen, setBankOpen] = useState(false);
  const bankWrapperRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    if (!bankOpen) return undefined;
    const handler = (e) => {
      if (bankWrapperRef.current && !bankWrapperRef.current.contains(e.target)) {
        setBankOpen(false);
        setBankSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [bankOpen]);

  const filteredBanks = useMemo(() => {
    const enabled = banks?.filter((b) => b.status === 'enabled') ?? [];
    const q = bankSearch.trim().toLowerCase();
    if (!q) return enabled;
    return enabled.filter((b) => (
      (b.label_short || '').toLowerCase().includes(q)
      || (b.label || '').toLowerCase().includes(q)
      || String(b.id).includes(q)
    ));
  }, [banks, bankSearch]);

  const bankInputDisplay = bankOpen
    ? bankSearch
    : (selectedBank ? (selectedBank.label_short || selectedBank.label) : '');

  const pickBank = (bankCode) => {
    onBankChange(bankCode);
    setBankOpen(false);
    setBankSearch('');
  };

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
        <div ref={bankWrapperRef} style={{ position: 'relative' }}>
          <input
            type="text"
            value={bankInputDisplay}
            onChange={(e) => { setBankSearch(e.target.value); setBankOpen(true); }}
            onFocus={() => { setBankOpen(true); setBankSearch(''); }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setBankOpen(false);
                setBankSearch('');
                e.currentTarget.blur();
              } else if (e.key === 'ArrowDown' && !bankOpen) {
                setBankOpen(true);
              }
            }}
            placeholder={loading ? 'Loading banks…' : '— select bank — (type to search)'}
            disabled={disabled || loading}
            className="form-input"
            style={{ width: '100%' }}
            role="combobox"
            aria-expanded={bankOpen}
            aria-autocomplete="list"
            aria-controls="payout-bank-listbox"
          />
          {bankOpen && (
            <div
              id="payout-bank-listbox"
              role="listbox"
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                maxHeight: 260,
                overflowY: 'auto',
                background: 'white',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                zIndex: 100,
                marginTop: 2,
              }}
            >
              {filteredBanks.length === 0 ? (
                <div style={{ padding: '0.6rem 0.75rem', color: '#666', fontSize: '0.85rem' }}>
                  {bankSearch.trim() ? `No banks match "${bankSearch}"` : 'No banks available'}
                </div>
              ) : (
                filteredBanks.map((b) => {
                  const isSelected = b.id === v.bankCode;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickBank(b.id)}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        textAlign: 'left',
                        background: isSelected ? '#ecfdf5' : 'white',
                        border: 'none',
                        borderBottom: '1px solid #f3f4f6',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                      }}
                    >
                      {b.label_short || b.label}
                      {b.label_short && b.label && b.label_short !== b.label && (
                        <span style={{ marginLeft: 8, color: '#666', fontSize: '0.78rem' }}>
                          {b.label}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
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
