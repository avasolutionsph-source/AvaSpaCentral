import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import mockApi from '../mockApi';
import Expenses from './Expenses';
import CashDrawerHistory from './CashDrawerHistory';
import '../assets/css/hub-pages.css';

const FinanceHub = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'expenses';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Quick stats for badges
  const [stats, setStats] = useState({
    totalExpenses: 0,
    monthlyExpenses: 0,
    totalVariance: 0,
    openDrawers: 0
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [expenses, cashSessions] = await Promise.all([
        mockApi.expenses.getExpenses(),
        mockApi.cashDrawer.getSessions()
      ]);

      // Calculate monthly expenses
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthlyExpenses = expenses.filter(e => {
        const expenseDate = new Date(e.date);
        return expenseDate >= monthStart;
      }).reduce((sum, e) => sum + (e.amount || 0), 0);

      // Calculate variance and open drawers
      const totalVariance = cashSessions.reduce((sum, s) => sum + (s.variance || 0), 0);
      const openDrawers = cashSessions.filter(s => s.status === 'open').length;

      setStats({
        totalExpenses: expenses.length,
        monthlyExpenses,
        totalVariance,
        openDrawers
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
      id: 'expenses',
      label: 'Expenses',
      badge: null
    },
    {
      id: 'cash-drawer',
      label: 'Cash Drawer',
      badge: stats.openDrawers > 0 ? stats.openDrawers : null,
      badgeType: 'warning'
    }
  ];

  return (
    <div className="hub-page">
      <div className="hub-header">
        <div className="hub-title-row">
          <div className="hub-title">
            <div>
              <h1>Finance Hub</h1>
              <p className="hub-subtitle">Manage expenses and cash drawer operations</p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="hub-quick-stats">
            <div className="hub-stat">
              <span className="hub-stat-icon">📊</span>
              <span className="hub-stat-value">₱{stats.monthlyExpenses.toLocaleString()}</span>
              <span className="hub-stat-label">this month</span>
            </div>
            {stats.totalVariance !== 0 && (
              <div className={`hub-stat ${stats.totalVariance > 0 ? 'success' : 'warning'}`}>
                <span className="hub-stat-icon">⚖️</span>
                <span className="hub-stat-value">₱{Math.abs(stats.totalVariance).toLocaleString()}</span>
                <span className="hub-stat-label">{stats.totalVariance > 0 ? 'over' : 'short'}</span>
              </div>
            )}
            {stats.openDrawers > 0 && (
              <div className="hub-stat warning">
                <span className="hub-stat-icon">🔓</span>
                <span className="hub-stat-value">{stats.openDrawers}</span>
                <span className="hub-stat-label">open drawer{stats.openDrawers > 1 ? 's' : ''}</span>
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
        {activeTab === 'expenses' && <Expenses embedded onDataChange={loadStats} />}
        {activeTab === 'cash-drawer' && <CashDrawerHistory embedded onDataChange={loadStats} />}
      </div>
    </div>
  );
};

export default FinanceHub;
