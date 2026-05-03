/**
 * useDisbursementRecipients — fetch the list of potential recipients for the
 * New Disbursement modal, scoped by source_type:
 *
 *   payroll_request → active employees
 *   purchase_order  → active suppliers
 *   expense         → users (TBD; expense reimbursements pick the requester)
 *
 * Returns each entry as a normalized shape so the modal doesn't need to
 * branch on source type:
 *
 *   {
 *     id,
 *     name,           // display label "Last, First" or "Supplier name"
 *     firstName,
 *     lastName,
 *     email,
 *     phone,
 *     bankCode,
 *     accountNumber,
 *     accountName,
 *     method,
 *   }
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabase/supabaseClient';

const TABLE_BY_SOURCE = {
  payroll_request: 'employees',
  purchase_order: 'suppliers',
  cash_advance: 'employees',
};

const COLUMNS = `
  id,
  first_name,
  last_name,
  name,
  email,
  phone,
  payout_bank_code,
  payout_account_number,
  payout_account_name,
  payout_method
`;

function normalizeRow(row, sourceType) {
  const first = row.first_name ?? '';
  const last = row.last_name ?? '';
  const isEmployee = sourceType === 'payroll_request' || sourceType === 'cash_advance';
  const name = row.name
    ?? (isEmployee
      ? `${first} ${last}`.trim()
      : '');
  return {
    id: row.id,
    name: name || `(no name on file)`,
    firstName: first || undefined,
    lastName: last || undefined,
    email: row.email ?? '',
    phone: row.phone ?? '',
    bankCode: row.payout_bank_code ?? null,
    accountNumber: row.payout_account_number ?? '',
    accountName: row.payout_account_name ?? '',
    method: row.payout_method ?? 'instapay',
  };
}

export function useDisbursementRecipients(sourceType, { branchId } = {}) {
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const table = TABLE_BY_SOURCE[sourceType];

  useEffect(() => {
    if (!table || !supabase) {
      setRecipients([]);
      setLoading(false);
      return undefined;
    }

    let mounted = true;
    setLoading(true);

    const isEmployeeSource = sourceType === 'payroll_request' || sourceType === 'cash_advance';
    const cols = isEmployeeSource
      // employees: no `name` column, build from first+last
      ? `id, first_name, last_name, email, phone, payout_bank_code, payout_account_number, payout_account_name, payout_method, branch_id, status`
      // suppliers: have `name`
      : `id, name, email, phone, payout_bank_code, payout_account_number, payout_account_name, payout_method, branch_id, status`;

    let query = supabase
      .from(table)
      .select(cols)
      .eq('status', 'active')
      .order(isEmployeeSource ? 'first_name' : 'name', { ascending: true })
      .limit(500);

    if (branchId && isEmployeeSource) {
      // Branch filter for employees only — suppliers are usually business-wide
      query = query.eq('branch_id', branchId);
    }

    query.then(({ data, error: err }) => {
      if (!mounted) return;
      if (err) {
        setError(err);
        setRecipients([]);
      } else {
        setRecipients((data ?? []).map((r) => normalizeRow(r, sourceType)));
        setError(null);
      }
      setLoading(false);
    });

    return () => { mounted = false; };
  }, [table, sourceType, branchId]);

  // Sort: with bank info on file first, then alphabetical by display name
  const sorted = useMemo(() => {
    return recipients.slice().sort((a, b) => {
      const aHasBank = a.bankCode != null;
      const bHasBank = b.bankCode != null;
      if (aHasBank !== bHasBank) return aHasBank ? -1 : 1;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [recipients]);

  return { recipients: sorted, loading, error };
}
