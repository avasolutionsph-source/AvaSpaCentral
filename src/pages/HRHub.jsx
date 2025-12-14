import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { usersApi } from '../mockApi/offlineApi';
import Employees from './Employees';
import Payroll from './Payroll';
import EmployeeAccounts from './EmployeeAccounts';
import '../assets/css/hub-pages.css';

const HRHub = () => {
  const { isOwner } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'employees';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Quick stats for badges
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    pendingRequests: 0,
    totalAccounts: 0
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

      setStats({
        totalEmployees: employees.length,
        activeEmployees,
        pendingRequests,
        totalAccounts: users.length
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
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
      icon: '👥',
      badge: null
    },
    {
      id: 'payroll',
      label: 'Payroll',
      icon: '💰',
      badge: stats.pendingRequests > 0 ? stats.pendingRequests : null,
      badgeType: 'warning'
    },
    // Only show Accounts tab to Owner
    ...(isOwner() ? [{
      id: 'accounts',
      label: 'Accounts',
      icon: '🔐',
      badge: stats.totalAccounts > 0 ? stats.totalAccounts : null,
      badgeType: 'info'
    }] : [])
  ];

  return (
    <div className="hub-page">
      <div className="hub-header">
        <div className="hub-title-row">
          <div className="hub-title">
            <span className="hub-title-icon">👥</span>
            <div>
              <h1>HR Hub</h1>
              <p className="hub-subtitle">Manage employees and process payroll</p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="hub-quick-stats">
            <div className="hub-stat success">
              <span className="hub-stat-icon">✓</span>
              <span className="hub-stat-value">{stats.activeEmployees}</span>
              <span className="hub-stat-label">active staff</span>
            </div>
            {stats.pendingRequests > 0 && (
              <div className="hub-stat warning">
                <span className="hub-stat-icon">⏳</span>
                <span className="hub-stat-value">{stats.pendingRequests}</span>
                <span className="hub-stat-label">pending requests</span>
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
        {activeTab === 'employees' && <Employees embedded onDataChange={loadStats} />}
        {activeTab === 'payroll' && <Payroll embedded onDataChange={loadStats} />}
        {activeTab === 'accounts' && isOwner() && <EmployeeAccounts embedded onDataChange={loadStats} />}
      </div>
    </div>
  );
};

export default HRHub;
