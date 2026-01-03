import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { usersApi } from '../mockApi/offlineApi';
import Employees from './Employees';
import Attendance from './Attendance';
import Payroll from './Payroll';
import EmployeeAccounts from './EmployeeAccounts';
import HRRequests from './HRRequests';
import OTRequestRepository from '../services/storage/repositories/OTRequestRepository';
import LeaveRequestRepository from '../services/storage/repositories/LeaveRequestRepository';
import CashAdvanceRequestRepository from '../services/storage/repositories/CashAdvanceRequestRepository';
import IncidentReportRepository from '../services/storage/repositories/IncidentReportRepository';
import '../assets/css/hub-pages.css';
import '../assets/css/pos.css';

const HRHub = () => {
  const { isOwner, canEdit } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'employees';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Refs to access child component functions
  const employeesOpenCreateRef = useRef(null);
  const accountsOpenCreateRef = useRef(null);
  const payrollCalculateRef = useRef(null);
  const payrollRemittancesRef = useRef(null);
  const payrollPayslipsRef = useRef(null);

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
  }, []);

  const loadStats = async () => {
    try {
      const [employees, payrollRequests, users] = await Promise.all([
        mockApi.employees.getEmployees(),
        mockApi.payrollRequests.getRequests(),
        usersApi.getUsers()
      ]);

      const activeEmployees = employees.filter(e => e.status === 'active').length;
      const pendingRequests = payrollRequests.filter(r => r.status === 'pending').length;

      // Count pending HR requests
      let pendingHRRequests = 0;
      try {
        const [otReqs, leaveReqs, cashReqs, incidentReqs] = await Promise.all([
          OTRequestRepository.getPending(),
          LeaveRequestRepository.getPending(),
          CashAdvanceRequestRepository.getPending(),
          IncidentReportRepository.getPending()
        ]);
        pendingHRRequests = otReqs.length + leaveReqs.length + cashReqs.length + incidentReqs.length;
      } catch (e) {
        // Silent fail for HR requests count
      }

      setStats({
        totalEmployees: employees.length,
        activeEmployees,
        pendingRequests,
        totalAccounts: users.length,
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
    // Only show Accounts tab to Owner
    ...(isOwner() ? [{
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
            {activeTab === 'employees' && canEdit() && (
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
              </>
            )}
            {/* Accounts Tab Button */}
            {activeTab === 'accounts' && isOwner() && (
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
          {tabs.map(tab => (
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
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="hub-content">
        {activeTab === 'employees' && <Employees embedded onDataChange={loadStats} onOpenCreateRef={employeesOpenCreateRef} />}
        {activeTab === 'attendance' && <Attendance embedded onDataChange={loadStats} />}
        {activeTab === 'requests' && <HRRequests embedded onDataChange={loadStats} />}
        {activeTab === 'payroll' && <Payroll embedded onDataChange={loadStats} onCalculateRef={payrollCalculateRef} onRemittancesRef={payrollRemittancesRef} onPayslipsRef={payrollPayslipsRef} />}
        {activeTab === 'accounts' && isOwner() && <EmployeeAccounts embedded onDataChange={loadStats} onOpenCreateRef={accountsOpenCreateRef} />}
      </div>
    </div>
  );
};

export default HRHub;
