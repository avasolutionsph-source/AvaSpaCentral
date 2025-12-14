import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import MySchedule from './MySchedule';
import PayrollRequests from './PayrollRequests';
import MyAttendanceHistory from './MyAttendanceHistory';
import CameraCapture from '../components/CameraCapture';
import '../assets/css/hub-pages.css';

const MyPortal = () => {
  const { user, showToast } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'attendance';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Quick stats for badges
  const [stats, setStats] = useState({
    shiftsThisWeek: 0,
    pendingRequests: 0,
    upcomingAppointments: 0
  });

  // Attendance state
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showCamera, setShowCamera] = useState(false);
  const [clockAction, setClockAction] = useState(null); // 'in' or 'out'
  const [loadingAttendance, setLoadingAttendance] = useState(true);

  useEffect(() => {
    loadStats();
    loadTodayAttendance();
    // Update time every second for clock display
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
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

  const loadTodayAttendance = async () => {
    if (!user?.employeeId) {
      setLoadingAttendance(false);
      return;
    }

    try {
      setLoadingAttendance(true);
      const today = format(new Date(), 'yyyy-MM-dd');
      // Fetch attendance filtered by employee and date for better performance
      const attendance = await mockApi.attendance.getAttendance({
        employeeId: user.employeeId,
        date: today
      });
      // Get the first (and should be only) record for today
      const myRecord = attendance.length > 0 ? attendance[0] : null;
      setTodayAttendance(myRecord);
    } catch (error) {
      console.error('Failed to load attendance:', error);
    } finally {
      setLoadingAttendance(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Clock in/out handlers
  const handleClockAction = (action) => {
    if (!user?.employeeId) {
      showToast('Your account is not linked to an employee record', 'error');
      return;
    }
    setClockAction(action);
    setShowCamera(true);
  };

  const handleCameraCapture = async (captureData) => {
    if (!clockAction || !user?.employeeId) return;

    try {
      if (clockAction === 'in') {
        await mockApi.attendance.clockIn(user.employeeId, captureData);
        showToast('Clocked in successfully!', 'success');
      } else {
        await mockApi.attendance.clockOut(user.employeeId, captureData);
        showToast('Clocked out successfully!', 'success');
      }

      setShowCamera(false);
      setClockAction(null);
      loadTodayAttendance();
    } catch (error) {
      showToast(error.message || `Failed to clock ${clockAction}`, 'error');
      setShowCamera(false);
      setClockAction(null);
    }
  };

  const handleCameraCancel = () => {
    setShowCamera(false);
    setClockAction(null);
  };

  // Calculate hours worked
  const calculateHoursWorked = () => {
    if (!todayAttendance?.clockIn || !todayAttendance?.clockOut) return null;

    try {
      // Handle both HH:mm and HH:mm:ss formats
      const clockInTime = todayAttendance.clockIn.includes(':') ? todayAttendance.clockIn : '00:00';
      const clockOutTime = todayAttendance.clockOut.includes(':') ? todayAttendance.clockOut : '00:00';

      const clockIn = parseISO(`${todayAttendance.date}T${clockInTime}:00`);
      const clockOut = parseISO(`${todayAttendance.date}T${clockOutTime}:00`);
      const minutes = differenceInMinutes(clockOut, clockIn);
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h ${mins}m`;
    } catch (error) {
      console.error('Error calculating hours:', error);
      return null;
    }
  };

  const tabs = [
    {
      id: 'attendance',
      label: 'Clock In/Out',
      icon: '⏱️',
      badge: null
    },
    {
      id: 'history',
      label: 'My History',
      icon: '📋',
      badge: null
    },
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

  // Attendance Tab Content
  const renderAttendanceTab = () => {
    if (loadingAttendance) {
      return (
        <div className="page-loading">
          <div className="spinner"></div>
          <p>Loading attendance...</p>
        </div>
      );
    }

    if (!user?.employeeId) {
      return (
        <div className="alert alert-warning">
          <span>⚠️</span>
          <span>Your account is not linked to an employee record. Please contact your manager.</span>
        </div>
      );
    }

    const hoursWorked = calculateHoursWorked();

    return (
      <div className="my-attendance-section">
        {/* Current Time Display */}
        <div className="clock-display-card">
          <div className="clock-time-large">{format(currentTime, 'HH:mm:ss')}</div>
          <div className="clock-date-large">{format(currentTime, 'EEEE, MMMM dd, yyyy')}</div>
        </div>

        {/* Today's Status Card */}
        <div className="attendance-status-card">
          <h3>Today's Attendance</h3>
          <div className="attendance-status-grid">
            <div className="attendance-status-item">
              <span className="status-label">Clock In</span>
              <span className={`status-value ${todayAttendance?.clockIn ? 'success' : 'pending'}`}>
                {todayAttendance?.clockIn || 'Not yet'}
              </span>
            </div>
            <div className="attendance-status-item">
              <span className="status-label">Clock Out</span>
              <span className={`status-value ${todayAttendance?.clockOut ? 'success' : 'pending'}`}>
                {todayAttendance?.clockOut || 'Not yet'}
              </span>
            </div>
            {hoursWorked && (
              <div className="attendance-status-item">
                <span className="status-label">Hours Worked</span>
                <span className="status-value info">{hoursWorked}</span>
              </div>
            )}
          </div>
        </div>

        {/* Clock Buttons */}
        <div className="clock-buttons">
          {!todayAttendance?.clockIn ? (
            <button
              className="btn btn-success btn-lg clock-btn"
              onClick={() => handleClockAction('in')}
            >
              <span className="clock-btn-icon">🟢</span>
              <span className="clock-btn-text">Clock In</span>
              <span className="clock-btn-hint">Take a photo to clock in</span>
            </button>
          ) : !todayAttendance?.clockOut ? (
            <button
              className="btn btn-primary btn-lg clock-btn"
              onClick={() => handleClockAction('out')}
            >
              <span className="clock-btn-icon">🔴</span>
              <span className="clock-btn-text">Clock Out</span>
              <span className="clock-btn-hint">Take a photo to clock out</span>
            </button>
          ) : (
            <div className="attendance-complete">
              <span className="complete-icon">✅</span>
              <span className="complete-text">Attendance Complete for Today</span>
              <span className="complete-hint">You've clocked in and out successfully</span>
            </div>
          )}
        </div>

        {/* Photo Preview (if available) */}
        {(todayAttendance?.clockInPhoto || todayAttendance?.clockOutPhoto) && (
          <div className="attendance-photos">
            <h4>Today's Photos</h4>
            <div className="photos-grid">
              {todayAttendance?.clockInPhoto && (
                <div className="photo-item">
                  <img src={todayAttendance.clockInPhoto} alt="Clock In" />
                  <span className="photo-label">Clock In - {todayAttendance.clockIn}</span>
                </div>
              )}
              {todayAttendance?.clockOutPhoto && (
                <div className="photo-item">
                  <img src={todayAttendance.clockOutPhoto} alt="Clock Out" />
                  <span className="photo-label">Clock Out - {todayAttendance.clockOut}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <style>{`
          .my-attendance-section {
            display: flex;
            flex-direction: column;
            gap: var(--spacing-lg);
            max-width: 600px;
            margin: 0 auto;
          }

          .clock-display-card {
            background: var(--primary);
            color: white;
            padding: var(--spacing-xl);
            border-radius: var(--radius-lg);
            text-align: center;
          }

          .clock-time-large {
            font-size: 3rem;
            font-weight: 700;
            font-family: monospace;
          }

          .clock-date-large {
            font-size: 1rem;
            opacity: 0.9;
            margin-top: var(--spacing-sm);
          }

          .attendance-status-card {
            background: var(--bg-primary);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-lg);
            padding: var(--spacing-lg);
          }

          .attendance-status-card h3 {
            margin: 0 0 var(--spacing-md) 0;
            font-size: 1rem;
            color: var(--text-secondary);
          }

          .attendance-status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: var(--spacing-md);
          }

          .attendance-status-item {
            text-align: center;
            padding: var(--spacing-md);
            background: var(--bg-secondary);
            border-radius: var(--radius-md);
          }

          .status-label {
            display: block;
            font-size: 0.75rem;
            color: var(--text-secondary);
            margin-bottom: var(--spacing-xs);
          }

          .status-value {
            display: block;
            font-size: 1.25rem;
            font-weight: 600;
          }

          .status-value.success {
            color: var(--success);
          }

          .status-value.pending {
            color: var(--text-tertiary);
          }

          .status-value.info {
            color: var(--primary);
          }

          .clock-buttons {
            display: flex;
            justify-content: center;
          }

          .clock-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: var(--spacing-xl) var(--spacing-xxl);
            min-width: 200px;
            border-radius: var(--radius-lg);
          }

          .clock-btn-icon {
            font-size: 2rem;
            margin-bottom: var(--spacing-sm);
          }

          .clock-btn-text {
            font-size: 1.25rem;
            font-weight: 600;
          }

          .clock-btn-hint {
            font-size: 0.75rem;
            opacity: 0.8;
            margin-top: var(--spacing-xs);
          }

          .attendance-complete {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: var(--spacing-xl);
            background: var(--success-bg);
            border-radius: var(--radius-lg);
            text-align: center;
          }

          .complete-icon {
            font-size: 2.5rem;
            margin-bottom: var(--spacing-sm);
          }

          .complete-text {
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--success);
          }

          .complete-hint {
            font-size: 0.85rem;
            color: var(--text-secondary);
            margin-top: var(--spacing-xs);
          }

          .attendance-photos {
            background: var(--bg-primary);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-lg);
            padding: var(--spacing-lg);
          }

          .attendance-photos h4 {
            margin: 0 0 var(--spacing-md) 0;
            font-size: 0.9rem;
            color: var(--text-secondary);
          }

          .photos-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: var(--spacing-md);
          }

          .photo-item {
            text-align: center;
          }

          .photo-item img {
            width: 100%;
            max-width: 150px;
            height: 150px;
            object-fit: cover;
            border-radius: var(--radius-md);
            border: 2px solid var(--border-color);
          }

          .photo-label {
            display: block;
            font-size: 0.75rem;
            color: var(--text-secondary);
            margin-top: var(--spacing-xs);
          }

          @media (max-width: 480px) {
            .clock-time-large {
              font-size: 2.5rem;
            }

            .clock-btn {
              width: 100%;
            }
          }
        `}</style>
      </div>
    );
  };

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
            {todayAttendance?.clockIn && !todayAttendance?.clockOut && (
              <div className="hub-stat success">
                <span className="hub-stat-icon">🟢</span>
                <span className="hub-stat-value">In</span>
                <span className="hub-stat-label">clocked in</span>
              </div>
            )}
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
        {activeTab === 'attendance' && renderAttendanceTab()}
        {activeTab === 'history' && <MyAttendanceHistory embedded />}
        {activeTab === 'schedule' && <MySchedule embedded onDataChange={loadStats} />}
        {activeTab === 'payroll' && <PayrollRequests embedded onDataChange={loadStats} />}
      </div>

      {/* Camera Capture Modal */}
      <CameraCapture
        isOpen={showCamera}
        onCapture={handleCameraCapture}
        onCancel={handleCameraCancel}
      />
    </div>
  );
};

export default MyPortal;
