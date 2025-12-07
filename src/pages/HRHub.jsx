import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import mockApi from '../mockApi';
import Employees from './Employees';
import Payroll from './Payroll';
import '../assets/css/hub-pages.css';

const HRHub = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'employees';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Quick stats for badges
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    pendingRequests: 0
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [employees, payrollRequests] = await Promise.all([
        mockApi.employees.getEmployees(),
        mockApi.payrollRequests.getRequests()
      ]);

      const activeEmployees = employees.filter(e => e.status === 'active').length;
      const pendingRequests = payrollRequests.filter(r => r.status === 'pending').length;

      setStats({
        totalEmployees: employees.length,
        activeEmployees,
        pendingRequests
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
    }
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
      </div>
    </div>
  );
};

export default HRHub;
