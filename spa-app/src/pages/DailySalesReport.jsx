import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { SettingsRepository, SavedReportRepository } from '../services/storage/repositories';
import CashAdvanceRequestRepository from '../services/storage/repositories/CashAdvanceRequestRepository';
import { supabase } from '../services/supabase/supabaseClient';
import {
  format,
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  subDays,
  getISOWeek,
} from 'date-fns';

const PERIODS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7', label: 'Last 7 Days' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'year', label: 'This Year' },
  { id: 'all', label: 'All Time' },
];

const SAVED_KEY = 'savedDailyReports';

const peso = (n) => `₱${(Number(n) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n) => (Number(n) || 0).toLocaleString('en-PH');

// Color-code a KPI value against thresholds: returns 'good' | 'warn' | 'bad'
const kpiClass = (value, { goodAbove, warnAbove } = {}) => {
  if (goodAbove != null && value >= goodAbove) return 'good';
  if (warnAbove != null && value >= warnAbove) return 'warn';
  return 'bad';
};

const blankManual = () => ({
  shift: 'Whole Day',
  preparedBy: '',
  approvedBy: '',
  verifiedBy: '',
  ownerReview: '',
  lateTherapist: '',
  complaints: '',
  refundReason: '',
  systemIssues: '',
});

const DailySalesReport = () => {
  const { user, getEffectiveBranchId, selectedBranch, showToast } = useApp();

  const [view, setView] = useState('current'); // 'current' | 'saved'
  const [period, setPeriod] = useState('today');
  const [loading, setLoading] = useState(true);

  // Raw data (for live view)
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [cashSessions, setCashSessions] = useState([]);
  const [cashAdvances, setCashAdvances] = useState([]);

  // Manual fields for live view, keyed by period
  const [manual, setManual] = useState(blankManual());

  // Saved reports
  const [savedReports, setSavedReports] = useState([]);
  const [viewingReport, setViewingReport] = useState(null); // snapshot shown read-only
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Compute period bounds and a stable key for manual-field storage
  const { startDate, endDate, periodKey, periodLabel } = useMemo(() => {
    const now = new Date();
    switch (period) {
      case 'today':
        return {
          startDate: startOfDay(now),
          endDate: endOfDay(now),
          periodKey: `today:${format(now, 'yyyy-MM-dd')}`,
          periodLabel: format(now, 'MMMM d, yyyy'),
        };
      case 'yesterday': {
        const y = subDays(now, 1);
        return {
          startDate: startOfDay(y),
          endDate: endOfDay(y),
          periodKey: `day:${format(y, 'yyyy-MM-dd')}`,
          periodLabel: format(y, 'MMMM d, yyyy'),
        };
      }
      case 'last7': {
        const s = startOfDay(subDays(now, 6));
        const e = endOfDay(now);
        return {
          startDate: s,
          endDate: e,
          periodKey: `last7:${format(now, 'yyyy-MM-dd')}`,
          periodLabel: `${format(s, 'MMM d')} – ${format(e, 'MMM d, yyyy')}`,
        };
      }
      case 'week': {
        const s = startOfWeek(now, { weekStartsOn: 1 });
        const e = endOfWeek(now, { weekStartsOn: 1 });
        return {
          startDate: s,
          endDate: e,
          periodKey: `week:${now.getFullYear()}-W${getISOWeek(now)}`,
          periodLabel: `${format(s, 'MMM d')} – ${format(e, 'MMM d, yyyy')}`,
        };
      }
      case 'month':
        return {
          startDate: startOfMonth(now),
          endDate: endOfMonth(now),
          periodKey: `month:${format(now, 'yyyy-MM')}`,
          periodLabel: format(now, 'MMMM yyyy'),
        };
      case 'year':
        return {
          startDate: startOfYear(now),
          endDate: endOfYear(now),
          periodKey: `year:${format(now, 'yyyy')}`,
          periodLabel: format(now, 'yyyy'),
        };
      case 'all':
      default:
        return {
          startDate: new Date(0),
          endDate: new Date(8640000000000000),
          periodKey: 'all',
          periodLabel: 'All Time',
        };
    }
  }, [period]);

  const branchId = getEffectiveBranchId();

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [txs, exps, emps, sessions, advances, , cloudSaved] = await Promise.all([
        mockApi.transactions.getTransactions(),
        mockApi.expenses.getExpenses(),
        mockApi.employees.getEmployees(),
        mockApi.cashDrawer.getSessions(),
        CashAdvanceRequestRepository.getAll(),
        SettingsRepository.get(SAVED_KEY),
        SavedReportRepository.list(user?.businessId),
      ]);
      // Strict per-branch filter: when a branch is selected, only include rows
      // whose branchId matches exactly. Legacy unbranched rows stay hidden here
      // and only surface under "All Branches" (branchId === null).
      const branchFilter = (item) => !branchId || item?.branchId === branchId;
      // Saved reports come from Supabase with snake_case fields, so the
      // branch key is `branch_id`. The same effective-branch rule applies:
      // when a specific branch is selected, only that branch's saved
      // reports are visible. "All Branches" mode (branchId === null) is
      // owner-only and keeps the full list. Without this, a Manager in
      // Branch A could see snapshots saved by a Manager in Branch B.
      const savedReportBranchFilter = (r) => !branchId || r?.branch_id === branchId;
      setTransactions((txs || []).filter(branchFilter));
      setExpenses((exps || []).filter(branchFilter));
      setEmployees(emps || []);
      setCashSessions((sessions || []).filter(branchFilter));
      setCashAdvances((advances || []).filter(branchFilter));
      setSavedReports(Array.isArray(cloudSaved) ? cloudSaved.filter(savedReportBranchFilter) : []);
    } catch {
      // Silent — each section renders zeros when data is missing
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Realtime: refetch when any session in this business creates or deletes a report
  useEffect(() => {
    if (!supabase || !user?.businessId) return undefined;
    const channel = supabase
      .channel('saved-reports-list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'saved_reports',
          filter: `business_id=eq.${user.businessId}`,
        },
        () => {
          // Re-apply the same branch filter on realtime refetch so a save
          // made in another branch doesn't leak in here. branchId is the
          // closure value from the parent useCallback's effective branch
          // — when the user switches branches the effect's deps tear it
          // down and re-subscribe with the new value.
          SavedReportRepository.list(user.businessId)
            .then((rows) => {
              const filtered = Array.isArray(rows)
                ? rows.filter((r) => !branchId || r?.branch_id === branchId)
                : [];
              setSavedReports(filtered);
            })
            .catch((err) => console.error('[DailySalesReport] realtime refetch failed', err));
        },
      )
      .subscribe();
    return () => {
      try { channel.unsubscribe(); } catch { /* best effort */ }
    };
  }, [user?.businessId, branchId]);

  // One-time migration: if there are local saved reports left over from the
  // pre-cloud era, push them to Supabase then delete the local key.
  // Best-effort — silent on failure (will retry on next mount).
  useEffect(() => {
    if (!user?.businessId) return;
    let cancelled = false;
    (async () => {
      try {
        const local = await SettingsRepository.get(SAVED_KEY);
        if (cancelled || !Array.isArray(local) || local.length === 0) return;

        const mapped = local.map((r) => ({
          business_id: user.businessId,
          branch_id: r.branchId || null,
          branch_name: r.branchName || null,
          period: r.period,
          period_label: r.periodLabel,
          period_key: r.periodKey,
          saved_by_user_id: user?.id || null,
          saved_by_name: r.savedBy || null,
          data: r.data,
          manual: r.manual,
        }));

        const inserted = await SavedReportRepository.bulkCreate(mapped);
        if (cancelled) return;
        if (Array.isArray(inserted) && inserted.length === mapped.length) {
          await SettingsRepository.delete(SAVED_KEY);
          setSavedReports((prev) => [...inserted, ...prev]);
          showToast?.(`Migrated ${inserted.length} local report(s) to cloud`, 'success');
        } else {
          console.warn('[DailySalesReport] partial migration; keeping local data');
        }
      } catch (e) {
        console.error('[DailySalesReport] local→cloud migration failed', e);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.businessId]);

  // Load manual fields whenever the period key changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await SettingsRepository.get(`dailySalesReport:${periodKey}`);
        if (cancelled) return;
        setManual(saved && typeof saved === 'object' ? { ...blankManual(), ...saved } : blankManual());
      } catch {
        if (!cancelled) setManual(blankManual());
      }
    })();
    return () => { cancelled = true; };
  }, [periodKey]);

  // Debounced persist of manual fields
  useEffect(() => {
    const t = setTimeout(() => {
      SettingsRepository.set(`dailySalesReport:${periodKey}`, manual).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [manual, periodKey]);

  // Filter raw data to the selected period
  const inRange = useCallback((dateStr) => {
    if (!dateStr) return false;
    const t = new Date(dateStr).getTime();
    return t >= startDate.getTime() && t <= endDate.getTime();
  }, [startDate, endDate]);

  const liveData = useMemo(() => {
    // Billable = paid + counted toward sales. 'under_time' means therapist
    // stopped before scheduled duration but customer still paid, so it
    // belongs in net sales / payment buckets alongside 'completed'.
    // 'voided' is a manual refund, 'cancelled' is a service that never
    // happened — both excluded from billable.
    const completed = transactions.filter(t => (t.status === 'completed' || t.status === 'under_time') && inRange(t.date));
    const voided = transactions.filter(t => t.status === 'voided' && inRange(t.date));
    const periodExpenses = expenses.filter(e => inRange(e.date || e.createdAt));
    const periodAdvances = cashAdvances.filter(a => a.status === 'approved' && inRange(a.approvedAt || a.createdAt));
    const periodSessions = cashSessions.filter(s => inRange(s.openTime));

    const grossSales = completed.reduce((s, t) => s + (t.subtotal || 0), 0);
    const discounts = completed.reduce((s, t) => s + (t.discount || 0), 0);
    const refunds = voided.reduce((s, t) => s + (t.totalAmount || 0), 0);
    const tax = completed.reduce((s, t) => s + (t.tax || 0), 0);
    const netSales = completed.reduce((s, t) => s + (t.totalAmount || 0), 0);

    const paymentBuckets = {};
    for (const t of completed) {
      const m = t.paymentMethod || 'Other';
      paymentBuckets[m] = (paymentBuckets[m] || 0) + (t.totalAmount || 0);
    }

    const serviceMap = new Map();
    for (const t of completed) {
      for (const item of (t.items || [])) {
        if (item.type !== 'service') continue;
        const existing = serviceMap.get(item.name) || { qty: 0, amount: 0 };
        existing.qty += item.quantity || 1;
        existing.amount += item.subtotal || (item.price || 0) * (item.quantity || 1);
        serviceMap.set(item.name, existing);
      }
    }
    const serviceRows = [...serviceMap.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.amount - a.amount);
    const serviceTotals = serviceRows.reduce((acc, r) => ({ qty: acc.qty + r.qty, amount: acc.amount + r.amount }), { qty: 0, amount: 0 });

    const empMap = new Map();
    const empNameOf = (id) => {
      const e = employees.find(emp => emp._id === id || emp.id === id);
      return e ? `${e.firstName} ${e.lastName}` : 'Unknown';
    };
    for (const t of completed) {
      const id = t.employee?.id || t.employeeId;
      if (!id) continue;
      const existing = empMap.get(id) || { name: t.employee?.name || empNameOf(id), clients: new Set(), services: new Map(), sales: 0 };
      existing.clients.add(t._id || t.id || t.receiptNumber);
      for (const item of (t.items || [])) {
        if (item.type !== 'service') continue;
        existing.services.set(item.name, (existing.services.get(item.name) || 0) + (item.quantity || 1));
      }
      existing.sales += t.totalAmount || 0;
      empMap.set(id, existing);
    }
    const therapistRows = [...empMap.values()]
      .map(v => ({
        name: v.name,
        clients: v.clients.size,
        services: [...v.services.entries()].map(([n, q]) => q > 1 ? `${n} ×${q}` : n).join(', '),
        sales: v.sales,
      }))
      .sort((a, b) => b.sales - a.sales);

    // Per-cashier breakdown — who rang up the sale, distinct from therapist.
    // Falls back to legacy txns without cashierId so we don't lose history.
    const cashierMap = new Map();
    for (const t of completed) {
      const id = t.cashierId || 'unattributed';
      const name = t.cashierName || t.cashier || (id === 'unattributed' ? 'Unattributed' : id);
      const existing = cashierMap.get(id) || { id, name, txns: 0, sales: 0, cash: 0, nonCash: 0 };
      existing.txns += 1;
      existing.sales += t.totalAmount || 0;
      if (t.paymentMethod === 'Cash') existing.cash += t.totalAmount || 0;
      else existing.nonCash += t.totalAmount || 0;
      cashierMap.set(id, existing);
    }
    const cashierRows = [...cashierMap.values()].sort((a, b) => b.sales - a.sales);

    const expenseMap = new Map();
    for (const e of periodExpenses) {
      const cat = e.category || 'Other';
      const existing = expenseMap.get(cat) || { amount: 0, notes: [] };
      existing.amount += e.amount || 0;
      if (e.description) existing.notes.push(e.description);
      expenseMap.set(cat, existing);
    }
    const expenseRows = [...expenseMap.entries()]
      .map(([category, v]) => ({ category, amount: v.amount, notes: v.notes.slice(0, 2).join('; ') }))
      .sort((a, b) => b.amount - a.amount);
    const totalExpenses = expenseRows.reduce((s, r) => s + r.amount, 0);

    const advanceRows = periodAdvances.map(a => ({
      employee: a.employeeName || empNameOf(a.employeeId),
      amount: a.amount || 0,
      reason: a.reason || '',
    }));
    const totalAdvances = advanceRows.reduce((s, r) => s + r.amount, 0);

    const firstSession = [...periodSessions].sort((a, b) => new Date(a.openTime) - new Date(b.openTime))[0];
    const lastClosed = [...periodSessions].filter(s => s.status === 'closed')
      .sort((a, b) => new Date(b.closeTime) - new Date(a.closeTime))[0];
    // The cash drawer repository stores the float on `openingFloat`, not
    // `openingBalance`. Reading `openingBalance` alone always returned 0,
    // so the "Beginning Cash" KV and the expected-cash math both showed
    // zero even when the cashier entered a real float. Prefer
    // openingFloat; fall back to openingBalance for legacy / Supabase rows
    // that happened to populate the other key.
    const beginningCash = Number(firstSession?.openingFloat ?? firstSession?.openingBalance ?? 0);
    const cashSales = completed.filter(t => t.paymentMethod === 'Cash').reduce((s, t) => s + (t.totalAmount || 0), 0);
    const endingCashActual = lastClosed?.actualCash;
    const endingCashExpected = beginningCash + cashSales - totalExpenses - totalAdvances;

    const totalClients = completed.length;
    // Guests served — sum of paxCount per transaction (defaults to 1 for legacy
    // single-pax rows). Distinct from totalClients (= receipt count): a 3-pax
    // booking is 1 receipt but 3 guests served. Avg ticket stays per-receipt
    // so it remains comparable to historical numbers.
    const guestsServed = completed.reduce((s, t) => s + (t.paxCount || 1), 0);
    const avgTicket = totalClients > 0 ? netSales / totalClients : 0;
    const activeTherapists = employees.filter(e => e.status === 'active').length;
    const therapistsWithSales = empMap.size;
    const utilization = activeTherapists > 0 ? (therapistsWithSales / activeTherapists) * 100 : 0;
    const hourBuckets = {};
    for (const t of completed) {
      const h = new Date(t.date).getHours();
      hourBuckets[h] = (hourBuckets[h] || 0) + 1;
    }
    const peakHour = Object.entries(hourBuckets).sort((a, b) => b[1] - a[1])[0];
    const peakHoursLabel = peakHour
      ? `${String(peakHour[0]).padStart(2, '0')}:00 – ${String((+peakHour[0] + 1) % 24).padStart(2, '0')}:00 (${peakHour[1]} txn)`
      : '—';
    const walkIns = completed.filter(t => t.bookingSource === 'walk-in' || !t.bookingSource).length;
    const booked = completed.filter(t => t.bookingSource && t.bookingSource !== 'walk-in').length;

    return {
      grossSales, discounts, refunds, tax, netSales,
      paymentBuckets,
      serviceRows, serviceTotals,
      therapistRows,
      cashierRows,
      expenseRows, totalExpenses,
      advanceRows, totalAdvances,
      beginningCash, cashSales, endingCashActual, endingCashExpected,
      totalClients, guestsServed, avgTicket, utilization, peakHoursLabel,
      walkIns, booked,
    };
  }, [transactions, expenses, cashAdvances, cashSessions, employees, inRange]);

  const handlePrint = () => window.print();

  const handleSaveReport = async () => {
    if (!user?.businessId) {
      showToast?.('Cannot save: not logged in', 'error');
      return;
    }
    const payload = {
      business_id: user.businessId,
      branch_id: branchId || null,
      branch_name: selectedBranch?.name || user?.branchName || null,
      period,
      period_label: periodLabel,
      period_key: periodKey,
      saved_by_user_id: user?.id || null,
      saved_by_name: user
        ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || user.email
        : null,
      data: liveData,
      manual,
    };
    try {
      const inserted = await SavedReportRepository.create(payload);
      setSavedReports(prev => [inserted, ...prev]);
      showToast?.('Report saved', 'success');
    } catch (e) {
      console.error('[DailySalesReport] handleSaveReport failed', e);
      showToast?.('Failed to save report', 'error');
    }
  };

  const handleDeleteReport = async (id) => {
    try {
      await SavedReportRepository.delete(id);
      setSavedReports(prev => prev.filter(r => r.id !== id));
      setConfirmDeleteId(null);
      if (viewingReport?.id === id) setViewingReport(null);
      showToast?.('Saved report deleted', 'success');
    } catch (e) {
      console.error('[DailySalesReport] handleDeleteReport failed', e);
      const msg = e?.message?.includes('403')
        ? "You can't delete this report (creator or Owner only)"
        : 'Failed to delete report';
      showToast?.(msg, 'error');
    }
  };

  // Decide what to render in the sheet area
  const sheetSnapshot = viewingReport
    ? { data: viewingReport.data, manual: viewingReport.manual, periodLabel: viewingReport.period_label || viewingReport.periodLabel, readOnly: true }
    : { data: liveData, manual, periodLabel, readOnly: false };

  return (
    <div className="daily-sales-report">
      {/* Sub-tabs: Current Report / Saved Reports */}
      <div className="dsr-subtabs">
        <button
          className={`dsr-subtab ${view === 'current' ? 'active' : ''}`}
          onClick={() => { setView('current'); setViewingReport(null); }}
        >
          Current Report
        </button>
        <button
          className={`dsr-subtab ${view === 'saved' ? 'active' : ''}`}
          onClick={() => setView('saved')}
        >
          Saved Reports
          {savedReports.length > 0 && <span className="dsr-subtab-count">{savedReports.length}</span>}
        </button>
      </div>

      {view === 'current' && !viewingReport && (
        <>
          <div className="dsr-toolbar">
            <div className="dsr-period-group">
              {PERIODS.map(p => (
                <button
                  key={p.id}
                  className={`dsr-period-btn ${period === p.id ? 'active' : ''}`}
                  onClick={() => setPeriod(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="dsr-meta">
              <span className="dsr-range">{periodLabel}</span>
              <button className="btn btn-secondary" onClick={loadAll} disabled={loading}>Refresh</button>
              <button className="btn btn-secondary" onClick={handleSaveReport} disabled={loading}>💾 Save Report</button>
              <button className="btn btn-primary" onClick={handlePrint}>Print / Export PDF</button>
            </div>
          </div>
          <ReportSheet
            {...sheetSnapshot}
            onManualChange={(patch) => setManual(m => ({ ...m, ...patch }))}
            showShift={period === 'today'}
            branchName={selectedBranch?.name || user?.branchName || '—'}
          />
        </>
      )}

      {view === 'saved' && !viewingReport && (
        <SavedReportsList
          items={savedReports}
          onView={setViewingReport}
          onDelete={(id) => setConfirmDeleteId(id)}
          currentUser={user}
        />
      )}

      {viewingReport && (
        <>
          <div className="dsr-toolbar">
            <div>
              <button className="btn btn-secondary" onClick={() => setViewingReport(null)}>← Back to list</button>
            </div>
            <div className="dsr-meta">
              <span className="dsr-range">
                Saved {(() => {
                  const t = viewingReport.created_at || viewingReport.saved_at || viewingReport.savedAt;
                  const d = t ? new Date(t) : null;
                  return d && !isNaN(d.getTime()) ? format(d, 'PPpp') : '—';
                })()}
                {(viewingReport.saved_by_name || viewingReport.savedBy) ? ` · ${viewingReport.saved_by_name || viewingReport.savedBy}` : ''}
              </span>
              <button
                className="btn btn-secondary"
                onClick={() => setConfirmDeleteId(viewingReport.id)}
                style={{ color: '#b91c1c' }}
              >
                Delete
              </button>
              <button className="btn btn-primary" onClick={handlePrint}>Print / Export PDF</button>
            </div>
          </div>
          <ReportSheet
            {...sheetSnapshot}
            branchName={viewingReport.branch_name || viewingReport.branchName || '—'}
            showShift={viewingReport.period === 'today'}
          />
        </>
      )}

      {confirmDeleteId && (
        <div className="dsr-modal-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="dsr-modal" onClick={e => e.stopPropagation()}>
            <h3>Delete saved report?</h3>
            <p>This can't be undone.</p>
            <div className="dsr-modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ background: '#b91c1c' }} onClick={() => handleDeleteReport(confirmDeleteId)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Saved Reports List ---------------------------------------------------

const SavedReportsList = ({ items, onView, onDelete, currentUser }) => {
  if (!items.length) {
    return (
      <div className="dsr-empty-state">
        <div className="dsr-empty-icon">📁</div>
        <h3>No saved reports yet</h3>
        <p>From the Current Report tab, click "Save Report" to keep a snapshot here.</p>
      </div>
    );
  }

  return (
    <div className="dsr-saved-list">
      <table className="dsr-table dsr-saved-table">
        <thead>
          <tr>
            <th>Period</th>
            <th>Range</th>
            <th>Branch</th>
            <th>Saved</th>
            <th>Saved By</th>
            <th className="right">Net Sales</th>
            <th className="right">Transactions</th>
            <th className="right">Guests</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map(r => (
            <tr key={r.id}>
              <td><span className="dsr-period-chip">{PERIODS.find(p => p.id === r.period)?.label || r.period}</span></td>
              <td>{r.period_label || r.periodLabel}</td>
              <td className="dsr-small">{r.branch_name || r.branchName || '—'}</td>
              <td className="dsr-small">{(() => {
                const t = r.created_at || r.saved_at || r.savedAt;
                const d = t ? new Date(t) : null;
                return d && !isNaN(d.getTime()) ? format(d, 'MMM d, yyyy h:mm a') : '—';
              })()}</td>
              <td className="dsr-small">{r.saved_by_name || r.savedBy || '—'}</td>
              <td className="right">{peso(r.data?.netSales)}</td>
              <td className="right">{num(r.data?.totalClients)}</td>
              <td className="right">{num(r.data?.guestsServed ?? r.data?.totalClients)}</td>
              <td className="right">
                <button className="dsr-link-btn" onClick={() => onView(r)}>View</button>
                {(r.saved_by_user_id === currentUser?.id || currentUser?.role === 'Owner') && (
                  <button className="dsr-link-btn danger" onClick={() => onDelete(r.id)}>Delete</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// --- Report Sheet (used for both live + snapshot view) --------------------

const ReportSheet = ({ data, manual, periodLabel, branchName, showShift, readOnly, onManualChange }) => {
  const set = (patch) => !readOnly && onManualChange?.(patch);

  return (
    <div className={`dsr-sheet ${readOnly ? 'dsr-readonly' : ''}`}>
      <header className="dsr-header">
        <h1>Daily Sales Report</h1>
        <p className="dsr-subtitle">{periodLabel}</p>
      </header>

      <section className="dsr-section">
        <h2>1. Basic Info</h2>
        <div className="dsr-grid-2">
          <Field label="Date">{periodLabel}</Field>
          <Field label="Branch">{branchName}</Field>
          {showShift && (
            <Field label="Coverage">
              <select value={manual.shift || 'Whole Day'} onChange={e => set({ shift: e.target.value })} disabled={readOnly}>
                <option>AM</option>
                <option>PM</option>
                <option>Whole Day</option>
              </select>
            </Field>
          )}
          <Field label="Prepared by">
            <input value={manual.preparedBy || ''} onChange={e => set({ preparedBy: e.target.value })} placeholder="Name" disabled={readOnly} />
          </Field>
          <Field label="Approved by">
            <input value={manual.approvedBy || ''} onChange={e => set({ approvedBy: e.target.value })} placeholder="Name" disabled={readOnly} />
          </Field>
        </div>
      </section>

      <section className="dsr-section">
        <h2>2. Sales Summary</h2>
        <div className="dsr-kv-rows">
          <KV label="Total Gross Sales" value={peso(data.grossSales)} />
          <KV label="Less: Discounts" value={`- ${peso(data.discounts)}`} tone={data.discounts > 0 ? 'warn' : ''} />
          <KV label="Less: Refunds" value={`- ${peso(data.refunds)}`} tone={data.refunds > 0 ? 'bad' : ''} />
          <KV label="VAT / Tax" value={peso(data.tax)} />
          <KV label="Net Sales" value={peso(data.netSales)} strong tone="good" />
        </div>
      </section>

      <section className="dsr-section">
        <h2>3. Payment Breakdown</h2>
        <table className="dsr-table">
          <thead>
            <tr><th>Method</th><th className="right">Amount</th></tr>
          </thead>
          <tbody>
            {Object.keys(data.paymentBuckets || {}).length === 0 && (
              <tr><td colSpan={2} className="dsr-empty">No collections in this period.</td></tr>
            )}
            {Object.entries(data.paymentBuckets || {}).map(([m, amt]) => (
              <tr key={m}><td>{m}</td><td className="right">{peso(amt)}</td></tr>
            ))}
            <tr className="dsr-total">
              <td>Total Collections</td>
              <td className="right">{peso(Object.values(data.paymentBuckets || {}).reduce((s, v) => s + v, 0))}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="dsr-section">
        <h2>4. Service Sales Breakdown</h2>
        <table className="dsr-table">
          <thead>
            <tr><th>Service</th><th className="right">Qty</th><th className="right">Amount</th></tr>
          </thead>
          <tbody>
            {(data.serviceRows || []).length === 0 && (
              <tr><td colSpan={3} className="dsr-empty">No service sales.</td></tr>
            )}
            {(data.serviceRows || []).map(row => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td className="right">{num(row.qty)}</td>
                <td className="right">{peso(row.amount)}</td>
              </tr>
            ))}
            <tr className="dsr-total">
              <td>Total</td>
              <td className="right">{num(data.serviceTotals?.qty || 0)}</td>
              <td className="right">{peso(data.serviceTotals?.amount || 0)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="dsr-section">
        <h2>5. Therapist Performance</h2>
        <table className="dsr-table">
          <thead>
            <tr>
              <th>Therapist</th>
              <th className="right">Clients</th>
              <th>Services Done</th>
              <th className="right">Sales Generated</th>
            </tr>
          </thead>
          <tbody>
            {(data.therapistRows || []).length === 0 && (
              <tr><td colSpan={4} className="dsr-empty">No therapist activity.</td></tr>
            )}
            {(data.therapistRows || []).map(row => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td className="right">{num(row.clients)}</td>
                <td className="dsr-small">{row.services || '—'}</td>
                <td className="right">{peso(row.sales)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="dsr-section">
        <h2>5b. Cashier Performance</h2>
        <table className="dsr-table">
          <thead>
            <tr>
              <th>Cashier</th>
              <th className="right">Transactions</th>
              <th className="right">Cash Sales</th>
              <th className="right">Non-Cash Sales</th>
              <th className="right">Total Sales</th>
            </tr>
          </thead>
          <tbody>
            {(data.cashierRows || []).length === 0 && (
              <tr><td colSpan={5} className="dsr-empty">No cashier activity recorded.</td></tr>
            )}
            {(data.cashierRows || []).map(row => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td className="right">{num(row.txns)}</td>
                <td className="right">{peso(row.cash)}</td>
                <td className="right">{peso(row.nonCash)}</td>
                <td className="right">{peso(row.sales)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="dsr-section">
        <h2>6. Operating Expenses</h2>
        <table className="dsr-table">
          <thead>
            <tr><th>Type</th><th className="right">Amount</th><th>Notes</th></tr>
          </thead>
          <tbody>
            {(data.expenseRows || []).length === 0 && (
              <tr><td colSpan={3} className="dsr-empty">No expenses recorded.</td></tr>
            )}
            {(data.expenseRows || []).map(row => (
              <tr key={row.category}>
                <td>{row.category}</td>
                <td className="right">{peso(row.amount)}</td>
                <td className="dsr-small">{row.notes}</td>
              </tr>
            ))}
            <tr className="dsr-total">
              <td>Total Expenses</td>
              <td className="right">{peso(data.totalExpenses)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </section>

      <section className="dsr-section">
        <h2>7. Cash Advance / Vale</h2>
        <table className="dsr-table">
          <thead>
            <tr><th>Employee</th><th className="right">Amount</th><th>Reason</th></tr>
          </thead>
          <tbody>
            {(data.advanceRows || []).length === 0 && (
              <tr><td colSpan={3} className="dsr-empty">No cash advances.</td></tr>
            )}
            {(data.advanceRows || []).map((row, i) => (
              <tr key={i}>
                <td>{row.employee}</td>
                <td className="right">{peso(row.amount)}</td>
                <td className="dsr-small">{row.reason}</td>
              </tr>
            ))}
            {(data.advanceRows || []).length > 0 && (
              <tr className="dsr-total">
                <td>Total</td>
                <td className="right">{peso(data.totalAdvances)}</td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="dsr-section">
        <h2>8. Cash Flow Summary</h2>
        <div className="dsr-kv-rows">
          <KV label="Beginning Cash" value={peso(data.beginningCash)} />
          <KV label="Total Cash Sales" value={`+ ${peso(data.cashSales)}`} tone="good" />
          <KV label="Expenses" value={`- ${peso(data.totalExpenses)}`} />
          <KV label="Cash Advance" value={`- ${peso(data.totalAdvances)}`} />
          <KV label="Expected Ending Cash" value={peso(data.endingCashExpected)} strong />
          {data.endingCashActual != null && (
            <KV
              label="Actual Ending Cash"
              value={peso(data.endingCashActual)}
              strong
              tone={Math.abs(data.endingCashActual - data.endingCashExpected) < 1 ? 'good' : 'bad'}
            />
          )}
          {data.endingCashActual != null && (
            <KV
              label="Variance"
              value={peso(data.endingCashActual - data.endingCashExpected)}
              tone={Math.abs(data.endingCashActual - data.endingCashExpected) < 1 ? 'good' : 'bad'}
            />
          )}
        </div>
      </section>

      <section className="dsr-section">
        <h2>9. KPI Dashboard</h2>
        <div className="dsr-kpi-grid">
          <Kpi label="Transactions" value={num(data.totalClients)} tone={kpiClass(data.totalClients, { goodAbove: 10, warnAbove: 3 })} />
          <Kpi label="Guests Served" value={num(data.guestsServed ?? data.totalClients)} tone={kpiClass(data.guestsServed ?? data.totalClients, { goodAbove: 15, warnAbove: 5 })} />
          <Kpi label="Average Ticket" value={peso(data.avgTicket)} tone={kpiClass(data.avgTicket, { goodAbove: 600, warnAbove: 300 })} />
          <Kpi label="Therapist Utilization" value={`${(data.utilization || 0).toFixed(0)}%`} tone={kpiClass(data.utilization, { goodAbove: 70, warnAbove: 40 })} />
          <Kpi label="Peak Hours" value={data.peakHoursLabel} tone="good" />
          <Kpi label="Walk-in vs Booking" value={`${data.walkIns || 0} walk-in / ${data.booked || 0} booked`} tone="good" />
          <Kpi label="Net Sales" value={peso(data.netSales)} tone={kpiClass(data.netSales, { goodAbove: 10000, warnAbove: 3000 })} />
        </div>
      </section>

      <section className="dsr-section">
        <h2>10. Notes / Incidents</h2>
        <div className="dsr-grid-2">
          <Field label="Late Therapist">
            <textarea rows={2} value={manual.lateTherapist || ''} onChange={e => set({ lateTherapist: e.target.value })} placeholder="Names / reasons" disabled={readOnly} />
          </Field>
          <Field label="Customer Complaints">
            <textarea rows={2} value={manual.complaints || ''} onChange={e => set({ complaints: e.target.value })} placeholder="What happened / how resolved" disabled={readOnly} />
          </Field>
          <Field label="Refund Reason">
            <textarea rows={2} value={manual.refundReason || ''} onChange={e => set({ refundReason: e.target.value })} placeholder="Why a refund was issued" disabled={readOnly} />
          </Field>
          <Field label="System Issues">
            <textarea rows={2} value={manual.systemIssues || ''} onChange={e => set({ systemIssues: e.target.value })} placeholder="POS / sync / device issues" disabled={readOnly} />
          </Field>
        </div>
      </section>

      <section className="dsr-section dsr-signoff">
        <h2>11. Sign Off</h2>
        <div className="dsr-grid-3">
          <Signature label="Prepared by" value={manual.preparedBy || ''} onChange={v => set({ preparedBy: v })} disabled={readOnly} />
          <Signature label="Verified by" value={manual.verifiedBy || ''} onChange={v => set({ verifiedBy: v })} disabled={readOnly} />
          <Signature label="Owner Review" value={manual.ownerReview || ''} onChange={v => set({ ownerReview: v })} disabled={readOnly} />
        </div>
      </section>
    </div>
  );
};

// --- Small presentational helpers ----------------------------------------

const Field = ({ label, children }) => (
  <div className="dsr-field">
    <label className="dsr-field-label">{label}</label>
    <div className="dsr-field-value">{children}</div>
  </div>
);

const KV = ({ label, value, strong, tone }) => (
  <div className={`dsr-kv ${strong ? 'strong' : ''} ${tone ? `tone-${tone}` : ''}`}>
    <span className="dsr-kv-label">{label}</span>
    <span className="dsr-kv-value">{value}</span>
  </div>
);

const Kpi = ({ label, value, tone }) => (
  <div className={`dsr-kpi tone-${tone || 'good'}`}>
    <div className="dsr-kpi-label">{label}</div>
    <div className="dsr-kpi-value">{value}</div>
  </div>
);

const Signature = ({ label, value, onChange, disabled }) => (
  <div className="dsr-sig">
    <input value={value} onChange={e => onChange(e.target.value)} placeholder="Name" disabled={disabled} />
    <div className="dsr-sig-line" />
    <div className="dsr-sig-label">{label}</div>
  </div>
);

export default DailySalesReport;
