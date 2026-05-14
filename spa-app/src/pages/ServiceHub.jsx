import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import Rooms from './Rooms';
import ServiceHistory from './ServiceHistory';
import '../assets/css/hub-pages.css';

const ServiceHub = () => {
  const { canEdit, getEffectiveBranchId } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'rooms';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Refs to access child component functions
  const roomsOpenCreateRef = useRef(null);

  // Quick stats for badges
  const [stats, setStats] = useState({
    availableRooms: 0,
    occupiedRooms: 0,
    todayServices: 0
  });

  const effectiveBranchId = getEffectiveBranchId();

  useEffect(() => {
    loadStats();
  }, [effectiveBranchId]);

  const loadStats = async () => {
    try {
      const [rooms, transactions] = await Promise.all([
        mockApi.rooms.getRooms(),
        mockApi.transactions.getTransactions()
      ]);

      // Match the Rooms page filter — only count rooms in the current branch
      const branchRooms = effectiveBranchId
        ? rooms.filter(r => r.branchId === effectiveBranchId)
        : rooms;
      const availableRooms = branchRooms.filter(r => r.status === 'available').length;
      const occupiedRooms = branchRooms.filter(r => r.status === 'occupied').length;

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
      // Silent fail for stats
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
      badge: stats.occupiedRooms > 0 ? stats.occupiedRooms : null,
      badgeType: 'info'
    },
    {
      id: 'history',
      label: 'Service History',
      badge: null
    }
  ];

  return (
    <div className="hub-page">
      <div className="hub-header">
        <div className="hub-title-row">
          <div className="hub-title">
            <div>
              <h1>Service Hub</h1>
              <p className="hub-subtitle">Manage rooms and track service history</p>
            </div>
          </div>

          {/* Quick Stats and Action Button */}
          <div className="hub-header-actions">
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
            {activeTab === 'rooms' && canEdit() && (
              <button
                className="btn btn-primary"
                onClick={() => roomsOpenCreateRef.current?.()}
              >
                + Add Room
              </button>
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
        {activeTab === 'rooms' && <Rooms embedded onDataChange={loadStats} onOpenCreateRef={roomsOpenCreateRef} />}
        {activeTab === 'history' && <ServiceHistory embedded onDataChange={loadStats} />}
      </div>
    </div>
  );
};

export default ServiceHub;
