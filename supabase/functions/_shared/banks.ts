/**
 * NextPay bank-code enum.
 *
 * NextPay's POST /v2/disbursements expects `destination.bank` as a NUMBER
 * (e.g. `bank: 6`), not a string. The full mapping lives on the docs sidebar
 * page "List of Supported Banks". This file is the operator-supplied
 * mapping — until the docs page is pasted, the array is empty and the
 * recipient bank dropdown will show no options.
 *
 * To fill: open https://nextpayph.stoplight.io/docs/nextpay-api-v2/ and copy
 * the bank table from the "List of Supported Banks" page into the
 * NEXTPAY_BANKS array below. Each entry needs at minimum a numeric `code`,
 * a human `name`, and the methods that bank supports (instapay, pesonet,
 * gcash, maya, etc.).
 */

export type DisbursementMethod = 'instapay' | 'pesonet' | 'gcash' | 'maya';

export interface BankOption {
  code: number;
  name: string;
  shortName: string;
  supportedMethods: DisbursementMethod[];
}

export const NEXTPAY_BANKS: BankOption[] = [
  // Examples (commented out — real values come from NextPay docs):
  // { code: 1, name: 'Bank of the Philippine Islands', shortName: 'BPI', supportedMethods: ['instapay', 'pesonet'] },
  // { code: 6, name: 'BDO Unibank',                    shortName: 'BDO', supportedMethods: ['instapay', 'pesonet'] },
];

export function bankByCode(code: number): BankOption | undefined {
  return NEXTPAY_BANKS.find((b) => b.code === code);
}

export function bankNameForCode(code: number): string {
  return bankByCode(code)?.name ?? `Bank #${code}`;
}
