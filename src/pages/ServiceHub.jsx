import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import mockApi from '../mockApi';
import Rooms from './Rooms';
import ServiceHistory from './ServiceHistory';
import '../assets/css/hub-pages.css';

const ServiceHub = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'rooms';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Quick stats for badges
  const [stats, setStats] = useState({
    availableRooms: 0,
    occupiedRooms: 0,
    todayServices: 0
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [rooms, transactions] = await Promise.all([
        mockApi.rooms.getRooms(),
        mockApi.transactions.getTransactions()
      ]);

      const availableRooms = rooms.filter(r => r.status === 'available').length;
      const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;

      // Count today's transactions
      const today = new Date().toDateString();
      const todayServices = transactions.filter(t =>
        new Date(t.date).toDateString() === today
      ).length;

      setStats({
        availableRooms,
        occupiedRooms,
        todayServices
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
      id: 'rooms',
      label: 'Rooms',
      icon: '🚪',
      badge: stats.occupiedRooms > 0 ? stats.occupiedRooms : null,
      badgeType: 'info'
    },
    {
      id: 'history',
      label: 'Service History',
      icon: '📋',
      badge: null
    }
  ];

  return (
    <div className="hub-page">
      <div className="hub-header">
        <div className="hub-title-row">
          <div className="hub-title">
            <span className="hub-title-icon">🏠</span>
            <div>
              <h1>Service Hub</h1>
              <p className="hub-subtitle">Manage rooms and track service history</p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="hub-quick-stats">
            <div className="hub-stat success">
              <span className="hub-stat-icon">✓</span>
              <span className="hub-stat-value">{stats.availableRooms}</span>
              <span className="hub-stat-label">available</span>
            </div>
            {stats.occupiedRooms > 0 && (
              <div className="hub-stat info">
                <span className="hub-stat-icon">👤</span>
                <span className="hub-stat-value">{stats.occupiedRooms}</span>
                <span className="hub-stat-label">occupied</span>
              </div>
            )}
            {stats.todayServices > 0 && (
              <div className="hub-stat">
                <span className="hub-stat-icon">📝</span>
                <span className="hub-stat-value">{stats.todayServices}</span>
                <span className="hub-stat-label">today</span>
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
        {activeTab === 'rooms' && <Rooms embedded onDataChange={loadStats} />}
        {activeTab === 'history' && <ServiceHistory embedded onDataChange={loadStats} />}
      </div>
    </div>
  );
};

export default ServiceHub;
