import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import MySchedule from './MySchedule';
import PayrollRequests from './PayrollRequests';
import MyAttendanceHistory from './MyAttendanceHistory';
import MyRequests from './MyRequests';
import CameraCapture from '../components/CameraCapture';
import OTRequestRepository from '../services/storage/repositories/OTRequestRepository';
import LeaveRequestRepository from '../services/storage/repositories/LeaveRequestRepository';
import CashAdvanceRequestRepository from '../services/storage/repositories/CashAdvanceRequestRepository';
import IncidentReportRepository from '../services/storage/repositories/IncidentReportRepository';
import { SettingsRepository } from '../services/storage/repositories';
import { logClockIn, logClockOut } from '../utils/activityLogger';
import { format } from 'date-fns';
import '../assets/css/hub-pages.css';
import '../assets/css/pos.css';

const MyPortal = () => {
  const { user, showToast, hasManagementAccess, getUserBranchId } = useApp();
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

  // Clock In/Out state
  const [showCamera, setShowCamera] = useState(false);
  const [pendingClockAction, setPendingClockAction] = useState(null);
  const [todayRecord, setTodayRecord] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [clockLoading, setClockLoading] = useState(false);

  // Ref for Submit Request button
  const payrollSubmitRef = useRef(null);

  useEffect(() => {
    loadStats();
    loadTodayAttendance();
  }, [user]);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadTodayAttendance = async () => {
    if (!user?.employeeId) return;
    try {
      const allAttendance = await mockApi.attendance.getAttendance();
      const today = format(new Date(), 'yyyy-MM-dd');
      let myToday = allAttendance.find(
        a => a.employeeId === user.employeeId && a.date === today
      );

      // If no today record, check for active overnight shift from yesterday
      if (!myToday) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = format(yesterday, 'yyyy-MM-dd');
        myToday = allAttendance.find(
          a => a.employeeId === user.employeeId && a.date === yesterdayStr && a.clockIn && !a.clockOut
        );
      }

      setTodayRecord(myToday || null);
    } catch (e) {
      // Silent fail
    }
  };

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

  // Calculate distance between two GPS coordinates using Haversine formula (returns meters)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleClockAction = (type) => {
    setPendingClockAction({ type, employeeId: user?.employeeId });
    setShowCamera(true);
  };

  const handleCameraCapture = async (captureData) => {
    if (!pendingClockAction) return;

    const { type, employeeId } = pendingClockAction;
    setClockLoading(true);

    try {
      const captureWithBranch = { ...captureData };
      const activeBranchId = getUserBranchId();
      if (activeBranchId) {
        captureWithBranch.branchId = activeBranchId;
      }

      // GPS geofencing check - requires proper setup
      let isOutOfRange = false;
      try {
        const gpsConfig = await SettingsRepository.get('gpsConfig');
        if (!gpsConfig || !gpsConfig.branches) {
          showToast('GPS geofencing is not configured. Please ask your manager to set up GPS settings.', 'warning');
        } else if (!activeBranchId) {
          showToast('No branch assigned. GPS geofencing cannot be validated.', 'warning');
        } else {
          const branchGps = gpsConfig.branches[activeBranchId];
          if (!branchGps || !branchGps.latitude || !branchGps.longitude) {
            showToast('Branch GPS location is not set up. Please ask your manager to configure it in Settings.', 'warning');
          } else if (!branchGps.radius) {
            showToast('GPS radius is not configured for this branch. Please ask your manager to set it up.', 'warning');
          } else if (captureData.location) {
            const distance = calculateDistance(
              captureData.location.latitude,
              captureData.location.longitude,
              branchGps.latitude,
              branchGps.longitude
            );
            if (distance > branchGps.radius) {
              isOutOfRange = true;
            }
          }
        }
      } catch (err) {
        console.warn('GPS config check failed:', err);
        showToast('Failed to check GPS config. Please contact your manager.', 'warning');
      }

      captureWithBranch.isOutOfRange = isOutOfRange;
      const employeeName = user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim();

      if (type === 'in') {
        const result = await mockApi.attendance.clockIn(employeeId, captureWithBranch);
        if (isOutOfRange) {
          showToast('Clocked in but you are outside the allowed area. Pending manager approval.', 'warning');
        } else if (result?.shiftWarning) {
          const [warnType, shiftTime] = result.shiftWarning.split('|');
          if (warnType === 'early_clockin') {
            showToast(`Clocked in but your shift doesn't start until ${shiftTime}`, 'warning');
          } else if (warnType === 'very_late') {
            showToast(`Clocked in - very late! Your shift started at ${shiftTime}`, 'warning');
          }
        } else {
          showToast('Clocked in successfully!', 'success');
        }
        logClockIn(user, employeeName);
      } else {
        await mockApi.attendance.clockOut(employeeId, captureWithBranch);
        if (isOutOfRange) {
          showToast('Clocked out but you are outside the allowed area. Pending manager approval.', 'warning');
        } else {
          showToast('Clocked out successfully!', 'success');
        }
        logClockOut(user, employeeName);
      }

      setShowCamera(false);
      setPendingClockAction(null);
      loadTodayAttendance();
    } catch (error) {
      showToast(`Failed to clock ${type}: ${error.message}`, 'error');
    } finally {
      setClockLoading(false);
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

  const getTodayStatus = () => {
    if (!todayRecord) return { label: 'Not Clocked In', color: '#888' };
    if (todayRecord.clockIn && todayRecord.clockOut) return { label: 'Completed', color: '#22c55e' };
    if (todayRecord.clockIn) return { label: 'Clocked In', color: '#3b82f6' };
    return { label: 'Not Clocked In', color: '#888' };
  };

  const todayStatus = getTodayStatus();

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

        {/* Clock In/Out Section */}
        {!hasManagementAccess() && user?.employeeId && (
          <div className="my-portal-clock-section">
            <div className="my-portal-clock-info">
              <div className="my-portal-clock-time">
                {format(currentTime, 'hh:mm:ss a')}
              </div>
              <div className="my-portal-clock-date">
                {format(currentTime, 'EEEE, MMMM dd, yyyy')}
              </div>
              <div className="my-portal-clock-status" style={{ color: todayStatus.color }}>
                {todayStatus.label}
                {todayRecord?.clockIn && (
                  <span style={{ color: '#666', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                    (In: {todayRecord.clockIn}{todayRecord.clockOut ? ` - Out: ${todayRecord.clockOut}` : ''})
                  </span>
                )}
              </div>
            </div>
            <div className="my-portal-clock-buttons">
              <button
                className="btn btn-success"
                onClick={() => handleClockAction('in')}
                disabled={clockLoading || (todayRecord?.clockIn && !todayRecord?.clockOut)}
              >
                Clock In
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleClockAction('out')}
                disabled={clockLoading || !todayRecord?.clockIn || !!todayRecord?.clockOut}
              >
                Clock Out
              </button>
            </div>
          </div>
        )}

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

      {/* Camera Capture Modal */}
      {showCamera && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => { setShowCamera(false); setPendingClockAction(null); }}
          title={`Clock ${pendingClockAction?.type === 'in' ? 'In' : 'Out'} - Photo Capture`}
        />
      )}
    </div>
  );
};

export default MyPortal;
