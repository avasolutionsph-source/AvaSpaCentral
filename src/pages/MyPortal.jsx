import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import MySchedule from './MySchedule';
import PayrollRequests from './PayrollRequests';
import '../assets/css/hub-pages.css';

const MyPortal = () => {
  const { user } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'schedule';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Quick stats for badges
  const [stats, setStats] = useState({
    shiftsThisWeek: 0,
    pendingRequests: 0,
    upcomingAppointments: 0
  });

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

      setStats({
        shiftsThisWeek: 5, // Placeholder - would come from schedule API
        pendingRequests,
        upcomingAppointments
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const tabs = [
    {
      id: 'schedule',
      label: 'My Schedule',
      icon: '📅',
      badge: stats.upcomingAppointments > 0 ? stats.upcomingAppointments : null,
      badgeType: 'info'
    },
    {
      id: 'payroll',
      label: 'My Payroll',
      icon: '💵',
      badge: stats.pendingRequests > 0 ? stats.pendingRequests : null,
      badgeType: 'warning'
    }
  ];

  return (
    <div className="hub-page">
      <div className="hub-header">
        <div className="hub-title-row">
          <div className="hub-title">
            <span className="hub-title-icon">👤</span>
            <div>
              <h1>My Portal</h1>
              <p className="hub-subtitle">Your personal schedule and payroll information</p>
            </div>
          </div>

          {/* Quick Stats */}
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
        </div>

        {/* Tab Navigation */}
        <div className="hub-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`hub-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => handleTabChange(tab.id)}
            >
              <span className="hub-tab-icon">{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`hub-tab-badge ${tab.badgeType || ''}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="hub-content">
        {activeTab === 'schedule' && <MySchedule embedded onDataChange={loadStats} />}
        {activeTab === 'payroll' && <PayrollRequests embedded onDataChange={loadStats} />}
      </div>
    </div>
  );
};

export default MyPortal;
