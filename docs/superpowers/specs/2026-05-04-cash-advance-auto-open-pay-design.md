# HR Cash Advance — Auto-open Pay Modal on Approval

**Date:** 2026-05-04
**Status:** Spec — pending user review
**Trigger:** Today an operator must (1) approve a cash advance, then (2) find the row again to click 💸 Pay. Auto-opening the Pay modal after approval saves the second click while preserving the confirmation step (no silent disbursement).

---

## Summary

Add a Settings toggle that, when enabled together with the existing Payroll Disbursements toggle, automatically opens the existing `<PayDisbursementModal>` pre-filled with the approved cash advance — operator still presses Send to confirm.

## Why

Approving + paying a cash advance is one logical action: "approve and disburse." Today's two-click flow is friction. Auto-opening the modal removes the second click without removing the confirmation step (so the operator still gets a chance to verify bank info, amount, and recipient).

Silent auto-fire was considered and rejected — too risky if employee bank info is wrong or amount is unexpected.

---

## User-confirmed decisions

| # | Question | Answer |
|---|---|---|
| 1 | Auto-pay mode | Auto-open Pay modal (operator still confirms via Send) |

---

## Architecture

```
Approve Cash Advance:
  HRRequests → confirmAction() → CashAdvanceRequestRepository.approve()
                                            ↓
                               Check nextpaySettings:
                                 - enableAutoOpenPayOnCashAdvanceApproval === true
                                 - enableDisbursementsPayroll === true
                                 - request.requestType === 'cashAdvance'
                                            ↓ if all true
                              setPayModalRequest(approvedRequest)
                                            ↓
                          PayDisbursementModal opens automatically
                                            ↓
                                   (operator clicks Send)
                                            ↓
                              createDisbursement (existing flow)
```

**Reuses 100% of existing infrastructure:**
- Existing `PayDisbursementModal` (no changes)
- Existing `payModalRequest` state in HRRequests.jsx
- Existing `nextpaySettings` blob in SettingsRepository (just adds one boolean field)
- Existing Settings → Payments tab UI (just adds one toggle row)

---

## Schema

**No DB migration.** New boolean field stored in the existing `nextpaySettings` JSON blob in local Dexie via `SettingsRepository`:

```
nextpaySettings.enableAutoOpenPayOnCashAdvanceApproval: boolean (default false)
```

The other `nextpaySettings` keys (`enableDisbursementsPayroll`, `enableDisbursementsSupplierAp`, `enableDisbursementsExpense`, `environment`) are unchanged.

---

## Components

### Modified: `src/pages/Settings.jsx`

In the Disbursements (NextPay) section (around line 2503-2582 — after the existing 3 `<DisbursementToggleRow>` components), add a new toggle:

```jsx
<DisbursementToggleRow
  label="Auto-open Pay modal after cash advance approval"
  description="When this AND 'Payroll payouts' are both enabled, approving a cash advance automatically opens the Pay via NextPay modal pre-filled with that employee. Operator still has to click Send to confirm — no silent payment."
  checked={nextpaySettings.enableAutoOpenPayOnCashAdvanceApproval}
  onChange={async (v) => {
    const next = { ...nextpaySettings, enableAutoOpenPayOnCashAdvanceApproval: v };
    setNextpaySettings(next);
    try {
      await SettingsRepository.set('nextpaySettings', next);
      showToast(v ? 'Cash advance auto-open enabled' : 'Cash advance auto-open disabled', 'success');
    } catch (err) {
      showToast('Save failed: ' + (err?.message || err), 'error');
    }
  }}
  envIsProduction={nextpaySettings.environment === 'production'}
  workflowName="cash advance auto-pay"
/>
```

### Modified: `src/pages/HRRequests.jsx`

Two changes:

**1. Read the new toggle alongside `payrollDisbursementsEnabled`:**

```jsx
const [autoOpenPayOnApproval, setAutoOpenPayOnApproval] = useState(false);
// ...within the existing Settings-loading useEffect, also set:
if (mounted && s) {
  setPayrollDisbursementsEnabled(Boolean(s.enableDisbursementsPayroll));
  setAutoOpenPayOnApproval(Boolean(s.enableAutoOpenPayOnCashAdvanceApproval));
}
```

**2. After `CashAdvanceRequestRepository.approve()` succeeds, conditionally open the Pay modal:**

In `confirmAction()`, find the `case 'cashAdvance':` branch. After the existing `await CashAdvanceRequestRepository.approve(...)` call, add:

```jsx
// Auto-open Pay modal if both toggles are on. The modal will validate bank
// info and let the operator confirm — no silent disbursement.
if (
  actionType === 'approve'
  && autoOpenPayOnApproval
  && payrollDisbursementsEnabled
) {
  // The locally-cached request still has the old status — refresh it from the
  // approve return value, OR use the existing record with status='approved'
  // overlaid since we know approve() succeeded.
  setPayModalRequest({ ...selectedRequest, status: 'approved' });
}
```

(The `selectedRequest` reference is already in scope inside `confirmAction` — it's set when the operator clicked Approve in the first place.)

---

## Edge cases & error handling

| Scenario | Behavior |
|---|---|
| Employee has no bank info | Modal opens with inline `PayoutBankPanel` (existing PayDisbursementModal behavior). Operator fills in or cancels. |
| Operator closes the auto-opened modal without Send | Cash advance stays `approved` but unpaid. Operator can manually click Pay later. Same as today's flow. |
| Auto-open toggle on but Payroll Disbursements toggle off | Auto-open is gated on BOTH being true — modal does NOT open. Avoids confusing UX where Pay buttons are hidden everywhere else. |
| Approve fires but modal doesn't open due to network/state issue | Cash advance still becomes `approved` (the `await approve()` succeeded). Operator can manually Pay later. Approve and auto-open are decoupled. |
| Approve action is for OT/Leave/Incident (not cashAdvance) | Auto-open does not fire — guard checks `request.requestType === 'cashAdvance'`. |

---

## Testing

### Manual smoke tests (no new unit tests — auto-open just gates an existing well-tested call site)

1. **Both toggles off** — approve a cash advance → modal does NOT open (legacy behavior)
2. **Payroll Disbursements ON, auto-open OFF** — approve → modal does NOT open; manual Pay button works
3. **Both toggles ON** — approve a cash advance → modal opens automatically pre-filled with employee bank info → click Send → disbursement fires
4. **Both toggles ON, employee has no bank info** — modal opens with inline `PayoutBankPanel`; operator can fill in + check "save to profile"
5. **Both toggles ON, operator clicks Cancel on the auto-opened modal** — cash advance stays `approved`; row's manual Pay button still appears
6. **Both toggles ON, approve an OT/Leave/Incident** — auto-open does NOT fire (guard on requestType)

---

## Observability

- No new logs needed
- Toast on toggle save reuses existing pattern

---

## Rollback

- Toggle defaults to `false`, so existing users see no change until they explicitly enable it
- Reverting the React commit removes the auto-open + the toggle row; the stored boolean stays in localStorage but is harmless

---

## Out of scope (explicit)

- Silent (no-modal) auto-fire — explicitly rejected for safety
- Per-request opt-in checkbox — user picked global Settings toggle
- Auto-pay for OT requests, Leave requests, Incident reports
- Auto-pay for Payroll, Purchase Orders (different workflows; separate specs if desired)
- Auto-approve (this spec only changes what happens AFTER approve, not approve itself)
