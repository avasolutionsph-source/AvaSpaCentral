import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { usersApi } from '../mockApi/offlineApi';
import Employees from './Employees';
import Attendance from './Attendance';
import Payroll from './Payroll';
import EmployeeAccounts from './EmployeeAccounts';
import HRRequests from './HRRequests';
import ShiftSchedules from './ShiftSchedules';
import PlanLock, { usePlanGate } from '../components/PlanLock';
import OTRequestRepository from '../services/storage/repositories/OTRequestRepository';
import LeaveRequestRepository from '../services/storage/repositories/LeaveRequestRepository';
import CashAdvanceRequestRepository from '../services/storage/repositories/CashAdvanceRequestRepository';
import IncidentReportRepository from '../services/storage/repositories/IncidentReportRepository';
import SavedPayrollsList from '../components/SavedPayrollsList';
import { SavedPayrollRepository } from '../services/storage/repositories';
import { supabase } from '../services/supabase/supabaseClient';
import '../assets/css/hub-pages.css';
import '../assets/css/pos.css';

const HRHub = () => {
  const { isOwner, isManager, isBranchOwner, canEdit, canManageEmployees, selectedBranch, getEffectiveBranchId } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'employees';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Multi-user accounts require Advance tier. Compute the gate once so the
  // tab strip, the header "+ Create Account" button, and the content render
  // all share the same locked state and toast copy.
  const accountsGate = usePlanGate('advance');

  // Refs to access child component functions
  const employeesOpenCreateRef = useRef(null);
  const accountsOpenCreateRef = useRef(null);
  const payrollCalculateRef = useRef(null);
  const payrollRemittancesRef = useRef(null);
  const payrollPayslipsRef = useRef(null);
  const payrollSaveRef = useRef(null);

  // Quick stats for badges
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    pendingRequests: 0,
    totalAccounts: 0,
    pendingHRRequests: 0
  });

  useEffect(() => {
    loadStats();
  }, [selectedBranch]);

  const loadStats = async () => {
    try {
      const [employees, payrollRequests, users] = await Promise.all([
        mockApi.employees.getEmployees(),
        mockApi.payrollRequests.getRequests(),
        usersApi.getUsers()
      ]);

      const activeEmployees = employees.filter(e => e.status === 'active').length;

      // Scope account count to the effective branch so the badge matches the
      // Accounts list. Resolve a user's branch from its own branchId or the
      // linked employee — same rule as EmployeeAccounts.filteredUsers.
      const effectiveBranchId = getEffectiveBranchId();
      const pendingRequests = payrollRequests
        .filter(r => r.status === 'pending')
        .filter(r => !effectiveBranchId || r.branchId === effectiveBranchId).length;
      const employeeById = new Map(employees.map(e => [e._id, e]));
      const scopedUsers = effectiveBranchId
        ? users.filter(u => {
            const resolved = u?.branchId || employeeById.get(u?.employeeId)?.branchId || null;
            return resolved === effectiveBranchId;
          })
        : users;

      // Count pending HR requests — scoped to the effective branch so the
      // tab badge matches what the Requests tab actually lists.
      let pendingHRRequests = 0;
      try {
        const [otReqs, leaveReqs, cashReqs, incidentReqs] = await Promise.all([
          OTRequestRepository.getPending(),
          LeaveRequestRepository.getPending(),
          CashAdvanceRequestRepository.getPending(),
          IncidentReportRepository.getPending()
        ]);
        const scopePending = (items) => effectiveBranchId
          ? items.filter(r => r.branchId === effectiveBranchId)
          : items;
        pendingHRRequests =
          scopePending(otReqs).length +
          scopePending(leaveReqs).length +
          scopePending(cashReqs).length +
          scopePending(incidentReqs).length;
      } catch (e) {
        // Silent fail for HR requests count
      }

      setStats({
        totalEmployees: employees.length,
        activeEmployees,
        pendingRequests,
        totalAccounts: scopedUsers.length,
        pendingHRRequests
      });
    } catch (error) {
      // Silent fail for stats
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Build tabs array - Accounts tab only visible to Owner
  const tabs = [
    {
      id: 'employees',
      label: 'Employees',
      badge: null
    },
    {
      id: 'attendance',
      label: 'Attendance',
      badge: null
    },
    {
      id: 'shift-schedules',
      label: 'Shift Schedules',
      badge: null
    },
    {
      id: 'requests',
      label: 'Requests',
      badge: stats.pendingHRRequests > 0 ? stats.pendingHRRequests : null,
      badgeType: 'warning'
    },
    {
      id: 'payroll',
      label: 'Payroll',
      badge: stats.pendingRequests > 0 ? stats.pendingRequests : null,
      badgeType: 'warning'
    },
    {
      id: 'saved-payrolls',
      label: 'Saved Payrolls',
      badge: null
    },
    // Only show Accounts tab to Owner and Branch Owner
    ...((isOwner() || isManager() || isBranchOwner()) ? [{
      id: 'accounts',
      label: 'Accounts',
      badge: stats.totalAccounts > 0 ? stats.totalAccounts : null,
      badgeType: 'info'
    }] : [])
  ];

  return (
    <div className="hub-page">
      <div className="hub-header">
        <div className="hub-title-row">
          <div className="hub-title">
            <div>
              <h1>Employees</h1>
              <p className="hub-subtitle">Manage employees, attendance, and process payroll</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="hub-header-actions">
            {/* Employees Tab Button */}
            {activeTab === 'employees' && canManageEmployees() && (
              <button
                className="btn btn-primary"
                onClick={() => employeesOpenCreateRef.current?.()}
              >
                + Add Employee
              </button>
            )}
            {/* Payroll Tab Buttons */}
            {activeTab === 'payroll' && (
              <>
                <button
                  className="btn btn-secondary"
                  onClick={() => payrollRemittancesRef.current?.()}
                >
                  Remittances
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => payrollPayslipsRef.current?.()}
                >
                  Payslips
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => payrollCalculateRef.current?.()}
                >
                  Calculate
                </button>
                <button
                  className="btn btn-success"
                  onClick={() => payrollSaveRef.current?.()}
                  title="Save snapshot to cloud (visible across devices)"
                >
                  💾 Save Payroll
                </button>
              </>
            )}
            {/* Accounts Tab Button — hidden on Starter; the tab is locked. */}
            {activeTab === 'accounts' && (isOwner() || isManager() || isBranchOwner()) && !accountsGate.locked && (
              <button
                className="btn btn-primary"
                onClick={() => accountsOpenCreateRef.current?.()}
              >
                + Create Account
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="sales-tabs">
          {tabs.map(tab => {
            const tabButton = (
              <button
                key={tab.id}
                className={`sales-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => handleTabChange(tab.id)}
              >
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`sales-tab-badge ${tab.badgeType || ''}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
            // Accounts tab is Advance+ only. Wrap with PlanLock so Starter
            // tenants see the same dim + 🔒 Upgrade badge + hover tooltip
            // pattern used on the Pahatid button in MainLayout.
            if (tab.id === 'accounts' && accountsGate.locked) {
              return (
                <PlanLock key={tab.id} requiredTier="advance" inline>
                  {tabButton}
                </PlanLock>
              );
            }
            return tabButton;
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="hub-content">
        {activeTab === 'employees' && <Employees embedded onDataChange={loadStats} onOpenCreateRef={employeesOpenCreateRef} />}
        {activeTab === 'attendance' && <Attendance embedded onDataChange={loadStats} />}
        {activeTab === 'shift-schedules' && <ShiftSchedules embedded onDataChange={loadStats} />}
        {activeTab === 'requests' && <HRRequests embedded onDataChange={loadStats} />}
        {activeTab === 'payroll' && <Payroll embedded onDataChange={loadStats} onCalculateRef={payrollCalculateRef} onRemittancesRef={payrollRemittancesRef} onPayslipsRef={payrollPayslipsRef} onSaveRef={payrollSaveRef} />}
        {activeTab === 'saved-payrolls' && <SavedPayrollsTabContent />}
        {activeTab === 'accounts' && (isOwner() || isManager() || isBranchOwner()) && (
          accountsGate.locked ? (
            // Starter tenants can land here via ?tab=accounts URL even though
            // the tab button is click-blocked by PlanLock. Render a parallel
            // locked notice instead of leaking the real Accounts UI.
            <div style={{
              padding: '3rem 1.5rem',
              textAlign: 'center',
              color: '#6b7280',
              maxWidth: 480,
              margin: '0 auto',
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔒</div>
              <h3 style={{ margin: '0 0 0.5rem', color: '#1f2937' }}>
                Multi-user accounts are an Advance feature
              </h3>
              <p style={{ margin: 0, fontSize: '0.95rem' }}>
                {accountsGate.message} Starter is Owner-only — upgrade to
                Advance or Enterprise to create additional staff logins.
              </p>
            </div>
          ) : (
            <EmployeeAccounts embedded onDataChange={loadStats} onOpenCreateRef={accountsOpenCreateRef} />
          )
        )}
      </div>
    </div>
  );
};

function SavedPayrollsTabContent() {
  const { user, showToast } = useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.businessId) return;
    try {
      const rows = await SavedPayrollRepository.list(user.businessId);
      setItems(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error('[HRHub] saved payrolls load failed', err);
      showToast?.('Failed to load saved payrolls', 'error');
    } finally {
      setLoading(false);
    }
  }, [user?.businessId, showToast]);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime: refetch on any insert/delete in this business
  useEffect(() => {
    if (!supabase || !user?.businessId) return undefined;
    const channel = supabase
      .channel('saved-payrolls-list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'saved_payrolls',
          filter: `business_id=eq.${user.businessId}`,
        },
        () => refresh(),
      )
      .subscribe();
    return () => { try { channel.unsubscribe(); } catch { /* best effort */ } };
  }, [user?.businessId, refresh]);

  const handleDelete = async (id) => {
    try {
      await SavedPayrollRepository.delete(id);
      setItems((prev) => prev.filter((r) => r.id !== id));
      showToast?.('Saved payroll deleted', 'success');
    } catch (err) {
      const msg = err?.message?.includes('403')
        ? "You can't delete this payroll (creator or Owner only)"
        : 'Failed to delete payroll';
      showToast?.(msg, 'error');
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}><div className="spinner" /></div>;
  }

  return (
    <SavedPayrollsList
      items={items}
      currentUser={user}
      onDelete={handleDelete}
    />
  );
}

export default HRHub;
