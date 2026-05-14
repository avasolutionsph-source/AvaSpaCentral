/**
 * NextPay bank types — the actual list is fetched live from NextPay's
 * GET /v2/banks endpoint (proxied through the list-banks Edge Function),
 * not hardcoded here. NextPay maintains the canonical list and includes
 * per-bank validation rules + supported methods.
 *
 * This file holds only the type definitions shared between the
 * list-banks Edge Function and any TypeScript code that consumes its
 * response.
 */

export type DisbursementMethod = 'instapay' | 'pesonet' | 'gcash' | 'maya' | string;

export type BankStatus = 'enabled' | 'disabled' | 'inactive';

export interface BankAccountNumberValidation {
  // NextPay's docs hint at a regex/length rule per bank. Shape is loosely
  // typed because the docs only show "object" — real shape lands when we
  // probe the live endpoint.
  [key: string]: unknown;
}

export interface NextPayBank {
  id: number;                                       // the integer used as `bank: N` in disbursement requests
  object: 'bank';
  name: string;                                     // machine name, e.g. 'bank_of_the_philippine_islands'
  label: string;                                    // display name, e.g. 'Bank Of The Philippine Islands'
  label_short: string;                              // short, e.g. 'BPI'
  country: string;                                  // ISO 2-letter, e.g. 'PH'
  status: BankStatus;
  account_number_validation: BankAccountNumberValidation | null;
  methods: DisbursementMethod[];
}

export interface ListBanksResponse {
  total_count: number;
  data: NextPayBank[];
}
