import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import MySchedule from './MySchedule';
import PayrollRequests from './PayrollRequests';
import MyAttendanceHistory from './MyAttendanceHistory';
import MyRequests from './MyRequests';
import OTRequestRepository from '../services/storage/repositories/OTRequestRepository';
import LeaveRequestRepository from '../services/storage/repositories/LeaveRequestRepository';
import CashAdvanceRequestRepository from '../services/storage/repositories/CashAdvanceRequestRepository';
import IncidentReportRepository from '../services/storage/repositories/IncidentReportRepository';
import '../assets/css/hub-pages.css';
import '../assets/css/pos.css';

const MyPortal = () => {
  const { user } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'history';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Quick stats for badges
  const [stats, setStats] = useState({
    shiftsThisWeek: 0,
    pendingRequests: 0,
    upcomingAppointments: 0,
    pendingHRRequests: 0
  });

  // Ref for Submit Request button
  const payrollSubmitRef = useRef(null);

  useEffect(() => {
    loadStats();
  }, [user]);

  const loadStats = async () => {
    if (!user) return;

    try {
      const [payrollRequests, appointments] = await Promise.all([
        mockApi.payrollRequests.getRequests(user._id),
        mockApi.appointments.getAppointments()
      ]);

      const pendingRequests = payrollRequests.filter(r => r.status === 'pending').length;

      // Count upcoming appointments for this employee
      const today = new Date();
      const upcomingAppointments = appointments.filter(a => {
        if (!user.employeeId) return false;
        return a.employeeId === user.employeeId && new Date(a.date) >= today;
      }).length;

      // Count pending HR requests
      let pendingHRRequests = 0;
      if (user.employeeId) {
        try {
          const [otReqs, leaveReqs, cashReqs, incidentReqs] = await Promise.all([
            OTRequestRepository.getByEmployee(user.employeeId),
            LeaveRequestRepository.getByEmployee(user.employeeId),
            CashAdvanceRequestRepository.getByEmployee(user.employeeId),
            IncidentReportRepository.getByEmployee(user.employeeId)
          ]);
          pendingHRRequests = [
            ...otReqs.filter(r => r.status === 'pending'),
            ...leaveReqs.filter(r => r.status === 'pending'),
            ...cashReqs.filter(r => r.status === 'pending'),
            ...incidentReqs.filter(r => r.status === 'pending')
          ].length;
        } catch (e) {
          // Silent fail for HR requests count
        }
      }

      setStats({
        shiftsThisWeek: 5, // Placeholder - would come from schedule API
        pendingRequests,
        upcomingAppointments,
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

  const tabs = [
    {
      id: 'history',
      label: 'My History',
      badge: null
    },
    {
      id: 'schedule',
      label: 'My Schedule',
      badge: stats.upcomingAppointments > 0 ? stats.upcomingAppointments : null,
      badgeType: 'info'
    },
    {
      id: 'requests',
      label: 'My Requests',
      badge: stats.pendingHRRequests > 0 ? stats.pendingHRRequests : null,
      badgeType: 'warning'
    },
    {
      id: 'payroll',
      label: 'My Payroll',
      badge: stats.pendingRequests > 0 ? stats.pendingRequests : null,
      badgeType: 'warning'
    }
  ];

  return (
    <div className="hub-page">
      <div className="hub-header">
        <div className="hub-title-row">
          <div className="hub-title">
            <div>
              <h1>My Portal</h1>
              <p className="hub-subtitle">Your personal schedule and payroll information</p>
            </div>
          </div>

          {/* Quick Stats and Action Button */}
          <div className="hub-header-actions">
            <div className="hub-quick-stats">
              {stats.upcomingAppointments > 0 && (
                <div className="hub-stat info">
                  <span className="hub-stat-icon">📋</span>
                  <span className="hub-stat-value">{stats.upcomingAppointments}</span>
                  <span className="hub-stat-label">upcoming</span>
                </div>
              )}
              {stats.pendingRequests > 0 && (
                <div className="hub-stat warning">
                  <span className="hub-stat-icon">⏳</span>
                  <span className="hub-stat-value">{stats.pendingRequests}</span>
                  <span className="hub-stat-label">pending</span>
                </div>
              )}
            </div>
            {activeTab === 'payroll' && (
              <button
                className="btn btn-primary"
                onClick={() => payrollSubmitRef.current?.()}
              >
                Submit Request
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
        {activeTab === 'history' && <MyAttendanceHistory embedded />}
        {activeTab === 'schedule' && <MySchedule embedded onDataChange={loadStats} />}
        {activeTab === 'requests' && <MyRequests embedded onDataChange={loadStats} />}
        {activeTab === 'payroll' && <PayrollRequests embedded onDataChange={loadStats} onOpenSubmitRef={payrollSubmitRef} />}
      </div>
    </div>
  );
};

export default MyPortal;
