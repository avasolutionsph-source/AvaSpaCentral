import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { SettingsRepository } from '../services/storage/repositories';
import CashAdvanceRequestRepository from '../services/storage/repositories/CashAdvanceRequestRepository';
import {
  format,
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  getISOWeek,
} from 'date-fns';

const PERIODS = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'year', label: 'This Year' },
  { id: 'all', label: 'All Time' },
];

const peso = (n) => `₱${(Number(n) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n) => (Number(n) || 0).toLocaleString('en-PH');

// Color-code a KPI value against thresholds: returns 'good' | 'warn' | 'bad'
const kpiClass = (value, { goodAbove, warnAbove } = {}) => {
  if (goodAbove != null && value >= goodAbove) return 'good';
  if (warnAbove != null && value >= warnAbove) return 'warn';
  return 'bad';
};

const DailySalesReport = () => {
  const { user, getUserBranchId, selectedBranch } = useApp();

  const [period, setPeriod] = useState('today');
  const [loading, setLoading] = useState(true);

  // Raw data
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [cashSessions, setCashSessions] = useState([]);
  const [cashAdvances, setCashAdvances] = useState([]);

  // Manual fields persisted per period key
  const blankManual = {
    shift: 'Whole Day',
    preparedBy: '',
    approvedBy: '',
    verifiedBy: '',
    ownerReview: '',
    lateTherapist: '',
    complaints: '',
    refundReason: '',
    systemIssues: '',
  };
  const [manual, setManual] = useState(blankManual);

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

  const branchId = getUserBranchId();

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [txs, exps, emps, sessions, advances] = await Promise.all([
        mockApi.transactions.getTransactions(),
        mockApi.expenses.getExpenses(),
        mockApi.employees.getEmployees(),
        mockApi.cashDrawer.getSessions(),
        CashAdvanceRequestRepository.getAll(),
      ]);
      const branchFilter = (item) => !branchId || !item?.branchId || item.branchId === branchId;
      setTransactions((txs || []).filter(branchFilter));
      setExpenses((exps || []).filter(branchFilter));
      setEmployees(emps || []);
      setCashSessions((sessions || []).filter(branchFilter));
      setCashAdvances((advances || []).filter(branchFilter));
    } catch {
      // Silent — each section renders zeros when data is missing
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Load manual fields whenever the period key changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await SettingsRepository.get(`dailySalesReport:${periodKey}`);
        if (cancelled) return;
        setManual(saved && typeof saved === 'object' ? { ...blankManual, ...saved } : blankManual);
      } catch {
        if (!cancelled) setManual(blankManual);
      }
    })();
    return () => { cancelled = true; };
  }, [periodKey]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const data = useMemo(() => {
    const completed = transactions.filter(t => t.status === 'completed' && inRange(t.date));
    const voided = transactions.filter(t => t.status === 'voided' && inRange(t.date));
    const periodExpenses = expenses.filter(e => inRange(e.date || e.createdAt));
    const periodAdvances = cashAdvances.filter(a => a.status === 'approved' && inRange(a.approvedAt || a.createdAt));
    const periodSessions = cashSessions.filter(s => inRange(s.openTime));

    // Sales Summary
    const grossSales = completed.reduce((s, t) => s + (t.subtotal || 0), 0);
    const discounts = completed.reduce((s, t) => s + (t.discount || 0), 0);
    const refunds = voided.reduce((s, t) => s + (t.totalAmount || 0), 0);
    const tax = completed.reduce((s, t) => s + (t.tax || 0), 0);
    const netSales = completed.reduce((s, t) => s + (t.totalAmount || 0), 0);

    // Payments
    const paymentBuckets = {};
    for (const t of completed) {
      const m = t.paymentMethod || 'Other';
      paymentBuckets[m] = (paymentBuckets[m] || 0) + (t.totalAmount || 0);
    }

    // Service sales breakdown
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

    // Therapist performance — aggregate by employee id
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

    // Expenses by category
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

    // Cash Advance rows
    const advanceRows = periodAdvances.map(a => ({
      employee: a.employeeName || empNameOf(a.employeeId),
      amount: a.amount || 0,
      reason: a.reason || '',
    }));
    const totalAdvances = advanceRows.reduce((s, r) => s + r.amount, 0);

    // Cash Flow
    const firstSession = [...periodSessions].sort((a, b) => new Date(a.openTime) - new Date(b.openTime))[0];
    const lastClosed = [...periodSessions].filter(s => s.status === 'closed')
      .sort((a, b) => new Date(b.closeTime) - new Date(a.closeTime))[0];
    const beginningCash = firstSession?.openingBalance ?? 0;
    const cashSales = completed.filter(t => t.paymentMethod === 'Cash').reduce((s, t) => s + (t.totalAmount || 0), 0);
    const endingCashActual = lastClosed?.actualCash;
    const endingCashExpected = beginningCash + cashSales - totalExpenses - totalAdvances;

    // KPI
    const totalClients = completed.length;
    const avgTicket = totalClients > 0 ? netSales / totalClients : 0;
    const activeTherapists = employees.filter(e => e.status === 'active').length;
    const therapistsWithSales = empMap.size;
    const utilization = activeTherapists > 0 ? (therapistsWithSales / activeTherapists) * 100 : 0;
    // Peak hours — bucket by hour, pick top bucket
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
      expenseRows, totalExpenses,
      advanceRows, totalAdvances,
      beginningCash, cashSales, endingCashActual, endingCashExpected,
      totalClients, avgTicket, utilization, peakHoursLabel,
      walkIns, booked,
    };
  }, [transactions, expenses, cashAdvances, cashSessions, employees, inRange]);

  const handlePrint = () => window.print();

  return (
    <div className="daily-sales-report">
      {/* Controls */}
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
          <button className="btn btn-primary" onClick={handlePrint}>Print / Export PDF</button>
        </div>
      </div>

      <div className="dsr-sheet">
        <header className="dsr-header">
          <h1>Daily Sales Report</h1>
          <p className="dsr-subtitle">{periodLabel}</p>
        </header>

        {/* 1. Basic Info */}
        <section className="dsr-section">
          <h2>1. Basic Info</h2>
          <div className="dsr-grid-2">
            <Field label="Date">{periodLabel}</Field>
            <Field label="Branch">{selectedBranch?.name || user?.branchName || '—'}</Field>
            {period === 'today' && (
              <Field label="Shift">
                <select value={manual.shift} onChange={e => setManual(m => ({ ...m, shift: e.target.value }))}>
                  <option>AM</option>
                  <option>PM</option>
                  <option>Whole Day</option>
                </select>
              </Field>
            )}
            <Field label="Prepared by">
              <input value={manual.preparedBy} onChange={e => setManual(m => ({ ...m, preparedBy: e.target.value }))} placeholder="Name" />
            </Field>
            <Field label="Approved by">
              <input value={manual.approvedBy} onChange={e => setManual(m => ({ ...m, approvedBy: e.target.value }))} placeholder="Name" />
            </Field>
          </div>
        </section>

        {/* 2. Sales Summary */}
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

        {/* 3. Payment Breakdown */}
        <section className="dsr-section">
          <h2>3. Payment Breakdown</h2>
          <table className="dsr-table">
            <thead>
              <tr><th>Method</th><th className="right">Amount</th></tr>
            </thead>
            <tbody>
              {Object.keys(data.paymentBuckets).length === 0 && (
                <tr><td colSpan={2} className="dsr-empty">No collections in this period.</td></tr>
              )}
              {Object.entries(data.paymentBuckets).map(([m, amt]) => (
                <tr key={m}><td>{m}</td><td className="right">{peso(amt)}</td></tr>
              ))}
              <tr className="dsr-total">
                <td>Total Collections</td>
                <td className="right">{peso(Object.values(data.paymentBuckets).reduce((s, v) => s + v, 0))}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 4. Service Sales */}
        <section className="dsr-section">
          <h2>4. Service Sales Breakdown</h2>
          <table className="dsr-table">
            <thead>
              <tr><th>Service</th><th className="right">Qty</th><th className="right">Amount</th></tr>
            </thead>
            <tbody>
              {data.serviceRows.length === 0 && (
                <tr><td colSpan={3} className="dsr-empty">No service sales.</td></tr>
              )}
              {data.serviceRows.map(row => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td className="right">{num(row.qty)}</td>
                  <td className="right">{peso(row.amount)}</td>
                </tr>
              ))}
              <tr className="dsr-total">
                <td>Total</td>
                <td className="right">{num(data.serviceTotals.qty)}</td>
                <td className="right">{peso(data.serviceTotals.amount)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 5. Therapist Performance */}
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
              {data.therapistRows.length === 0 && (
                <tr><td colSpan={4} className="dsr-empty">No therapist activity.</td></tr>
              )}
              {data.therapistRows.map(row => (
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

        {/* 6. Expenses */}
        <section className="dsr-section">
          <h2>6. Operating Expenses</h2>
          <table className="dsr-table">
            <thead>
              <tr><th>Type</th><th className="right">Amount</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {data.expenseRows.length === 0 && (
                <tr><td colSpan={3} className="dsr-empty">No expenses recorded.</td></tr>
              )}
              {data.expenseRows.map(row => (
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

        {/* 7. Cash Advance / Vale */}
        <section className="dsr-section">
          <h2>7. Cash Advance / Vale</h2>
          <table className="dsr-table">
            <thead>
              <tr><th>Employee</th><th className="right">Amount</th><th>Reason</th></tr>
            </thead>
            <tbody>
              {data.advanceRows.length === 0 && (
                <tr><td colSpan={3} className="dsr-empty">No cash advances.</td></tr>
              )}
              {data.advanceRows.map((row, i) => (
                <tr key={i}>
                  <td>{row.employee}</td>
                  <td className="right">{peso(row.amount)}</td>
                  <td className="dsr-small">{row.reason}</td>
                </tr>
              ))}
              {data.advanceRows.length > 0 && (
                <tr className="dsr-total">
                  <td>Total</td>
                  <td className="right">{peso(data.totalAdvances)}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* 8. Cash Flow */}
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

        {/* 10. KPI Dashboard */}
        <section className="dsr-section">
          <h2>9. KPI Dashboard</h2>
          <div className="dsr-kpi-grid">
            <Kpi label="Total Clients" value={num(data.totalClients)} tone={kpiClass(data.totalClients, { goodAbove: 10, warnAbove: 3 })} />
            <Kpi label="Average Ticket" value={peso(data.avgTicket)} tone={kpiClass(data.avgTicket, { goodAbove: 600, warnAbove: 300 })} />
            <Kpi label="Therapist Utilization" value={`${data.utilization.toFixed(0)}%`} tone={kpiClass(data.utilization, { goodAbove: 70, warnAbove: 40 })} />
            <Kpi label="Peak Hours" value={data.peakHoursLabel} tone="good" />
            <Kpi label="Walk-in vs Booking" value={`${data.walkIns} walk-in / ${data.booked} booked`} tone="good" />
            <Kpi label="Net Sales" value={peso(data.netSales)} tone={kpiClass(data.netSales, { goodAbove: 10000, warnAbove: 3000 })} />
          </div>
        </section>

        {/* 11. Notes / Incidents */}
        <section className="dsr-section">
          <h2>10. Notes / Incidents</h2>
          <div className="dsr-grid-2">
            <Field label="Late Therapist">
              <textarea rows={2} value={manual.lateTherapist} onChange={e => setManual(m => ({ ...m, lateTherapist: e.target.value }))} placeholder="Names / reasons" />
            </Field>
            <Field label="Customer Complaints">
              <textarea rows={2} value={manual.complaints} onChange={e => setManual(m => ({ ...m, complaints: e.target.value }))} placeholder="What happened / how resolved" />
            </Field>
            <Field label="Refund Reason">
              <textarea rows={2} value={manual.refundReason} onChange={e => setManual(m => ({ ...m, refundReason: e.target.value }))} placeholder="Why a refund was issued" />
            </Field>
            <Field label="System Issues">
              <textarea rows={2} value={manual.systemIssues} onChange={e => setManual(m => ({ ...m, systemIssues: e.target.value }))} placeholder="POS / sync / device issues" />
            </Field>
          </div>
        </section>

        {/* 12. Sign Off */}
        <section className="dsr-section dsr-signoff">
          <h2>11. Sign Off</h2>
          <div className="dsr-grid-3">
            <Signature label="Prepared by" value={manual.preparedBy} onChange={v => setManual(m => ({ ...m, preparedBy: v }))} />
            <Signature label="Verified by" value={manual.verifiedBy} onChange={v => setManual(m => ({ ...m, verifiedBy: v }))} />
            <Signature label="Owner Review" value={manual.ownerReview} onChange={v => setManual(m => ({ ...m, ownerReview: v }))} />
          </div>
        </section>
      </div>
    </div>
  );
};

// Small presentational helpers —

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

const Signature = ({ label, value, onChange }) => (
  <div className="dsr-sig">
    <input value={value} onChange={e => onChange(e.target.value)} placeholder="Name" />
    <div className="dsr-sig-line" />
    <div className="dsr-sig-label">{label}</div>
  </div>
);

export default DailySalesReport;
