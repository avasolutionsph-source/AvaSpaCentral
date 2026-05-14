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
import { formatTime12Hour } from '../utils/dateUtils';
import { format } from 'date-fns';
import { supabaseSyncManager } from '../services/supabase';
import dataChangeEmitter from '../services/sync/DataChangeEmitter';
import '../assets/css/hub-pages.css';
import '../assets/css/pos.css';

const MyPortal = () => {
  const { user, showToast, hasManagementAccess, getEffectiveBranchId } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'today';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Today's tasks for therapists
  const [todayTasks, setTodayTasks] = useState([]);
  const [todayTasksLoading, setTodayTasksLoading] = useState(false);

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

      // Branch-scope: a request belongs to the branch it was submitted from.
      const effectiveBranchId = getEffectiveBranchId?.();
      const scopedPayrollRequests = effectiveBranchId
        ? payrollRequests.filter(r => r.branchId === effectiveBranchId)
        : payrollRequests;
      const pendingRequests = scopedPayrollRequests.filter(r => r.status === 'pending').length;

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

  // Load today's tasks for therapists
  const loadTodayTasks = async () => {
    if (!user?.employeeId) return;
    setTodayTasksLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const [bookings, rooms, transactions] = await Promise.all([
        mockApi.advanceBooking.listAdvanceBookings(),
        mockApi.rooms.getRooms(),
        mockApi.transactions.getTransactions()
      ]);

      const tasks = [];

      // Today's advance bookings for this therapist
      const myBookings = bookings.filter(b => {
        if (!b.bookingDateTime) return false;
        const bookingDate = b.bookingDateTime.split('T')[0];
        return bookingDate === today && b.employeeId === user.employeeId && b.status !== 'cancelled';
      });
      myBookings.forEach(b => {
        const time = b.bookingDateTime.includes('T')
          ? format(new Date(b.bookingDateTime), 'h:mm a')
          : b.bookingDateTime;
        tasks.push({
          id: `booking-${b._id}`,
          type: b.status === 'completed' ? 'completed' : 'upcoming',
          time,
          service: b.serviceName || 'Service',
          client: b.clientName || 'Walk-in',
          room: b.roomName || 'TBD',
          status: b.status || 'scheduled',
          rawTime: new Date(b.bookingDateTime)
        });
      });

      // Active rooms assigned to this therapist
      const myRooms = rooms.filter(r =>
        r.assignedEmployeeId === user.employeeId &&
        (r.status === 'occupied' || r.status === 'pending')
      );
      myRooms.forEach(r => {
        tasks.push({
          id: `room-${r._id}`,
          type: r.status === 'occupied' ? 'in-progress' : 'pending',
          time: r.startTime ? format(new Date(r.startTime), 'h:mm a') : 'Now',
          service: r.currentService || 'Service',
          client: r.currentClient || 'Client',
          room: r.name,
          status: r.status,
          rawTime: r.startTime ? new Date(r.startTime) : new Date()
        });
      });

      // Today's completed transactions for this therapist
      const myCompleted = transactions.filter(t => {
        if (!t.date) return false;
        const txDate = t.date.split('T')[0];
        return txDate === today && t.employeeId === user.employeeId && t.status !== 'voided' && t.status !== 'cancelled';
      });
      myCompleted.forEach(t => {
        // Don't duplicate if already in bookings
        const alreadyListed = tasks.some(task => task.type !== 'completed');
        if (!alreadyListed || !tasks.some(task => task.id === `booking-${t.advanceBookingId}`)) {
          tasks.push({
            id: `tx-${t._id}`,
            type: 'completed',
            time: format(new Date(t.date), 'h:mm a'),
            service: t.items?.map(i => i.name).join(', ') || 'Service',
            client: t.customer?.name || 'Walk-in',
            room: t.roomName || '-',
            status: 'completed',
            rawTime: new Date(t.date)
          });
        }
      });

      // Sort: in-progress first, then upcoming by time, then completed
      const typeOrder = { 'in-progress': 0, 'pending': 1, 'upcoming': 2, 'completed': 3 };
      tasks.sort((a, b) => {
        const orderDiff = (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9);
        if (orderDiff !== 0) return orderDiff;
        return a.rawTime - b.rawTime;
      });

      setTodayTasks(tasks);
    } catch (e) {
      console.error('Failed to load today tasks:', e);
    } finally {
      setTodayTasksLoading(false);
    }
  };

  // Load today's tasks on mount + refresh on realtime / data-change /
  // visibility-resume. The 30s polling is kept as a safety net for
  // environments where realtime is misbehaving, but it should rarely
  // be the source of truth anymore.
  useEffect(() => {
    loadTodayTasks();
    const interval = setInterval(loadTodayTasks, 30000);
    return () => clearInterval(interval);
  }, [user?.employeeId]);

  // Cross-device live updates so a service started from POS / another device
  // shows up in the therapist's portal immediately instead of after the next
  // 30s poll. Watches the entities that materially change a therapist's tasks.
  useEffect(() => {
    let syncDebounce = null;
    const unsubscribeSync = supabaseSyncManager.subscribe((status) => {
      const watched = ['advanceBookings', 'activeServices', 'homeServices', 'rooms', 'appointments', 'transactions'];
      if (
        (status.type === 'realtime_update' && watched.includes(status.entityType)) ||
        status.type === 'pull_complete' || status.type === 'sync_complete'
      ) {
        clearTimeout(syncDebounce);
        syncDebounce = setTimeout(() => loadTodayTasks(), 500);
      }
    });

    let dataDebounce = null;
    const unsubscribeData = dataChangeEmitter.subscribe((change) => {
      if (['advanceBookings', 'activeServices', 'homeServices', 'rooms', 'appointments'].includes(change.entityType)) {
        clearTimeout(dataDebounce);
        dataDebounce = setTimeout(() => loadTodayTasks(), 300);
      }
    });

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadTodayTasks();
        loadStats();
        loadTodayAttendance();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unsubscribeSync();
      unsubscribeData();
      clearTimeout(syncDebounce);
      clearTimeout(dataDebounce);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user?.employeeId]);

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
      // Stamp the record with the branch the employee is currently working at.
      // Must match the read filter (getEffectiveBranchId), or the new record
      // becomes an orphan that's invisible to both employee and manager views.
      const activeBranchId = getEffectiveBranchId();
      if (!activeBranchId) {
        showToast('No branch is selected. Please contact your manager.', 'error');
        setShowCamera(false);
        setPendingClockAction(null);
        setClockLoading(false);
        return;
      }
      // Stamp the actor (whoever is logged in pressing Clock In/Out).
      // MyPortal is the self-service path, so this is almost always the
      // employee themselves — but a manager / receptionist who is
      // logged in could also use MyPortal to clock themselves in, and
      // we want the trail either way. The same captureWithBranch shape
      // flows into mockApi.attendance.clockIn / clockOut, which stamp
      // these on the record.
      const actorName = (user?.name
        || `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
        || user?.username
        || user?.email
        || 'User').trim();
      const captureWithBranch = {
        ...captureData,
        branchId: activeBranchId,
        actorName,
        actorId: user?.id || null,
        actorRole: user?.role || null,
      };

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
        if (result?.missedClockOut) {
          const missedDate = new Date(result.missedClockOut.date + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
          let msg = `Warning: You did not clock out last shift (${missedDate}, clocked in at ${result.missedClockOut.clockIn}). Please inform your manager.`;
          if (result.autoClosedCount > 0) {
            msg += ` ${result.autoClosedCount} older missed shift${result.autoClosedCount > 1 ? 's were' : ' was'} auto-closed at scheduled end time.`;
          }
          showToast(msg, 'warning');
        }
        if (isOutOfRange) {
          showToast('Clocked in but you are outside the allowed area. Pending manager approval.', 'warning');
        } else if (result?.shiftWarning) {
          const [warnType, shiftTime] = result.shiftWarning.split('|');
          if (warnType === 'early_clockin') {
            showToast(`Clocked in but your shift doesn't start until ${shiftTime}`, 'warning');
          } else if (warnType === 'very_late') {
            showToast(`Clocked in - very late! Your shift started at ${shiftTime}`, 'warning');
          }
        } else if (!result?.missedClockOut) {
          showToast('Clocked in successfully!', 'success');
        }
      } else {
        await mockApi.attendance.clockOut(employeeId, captureWithBranch);
        if (isOutOfRange) {
          showToast('Clocked out but you are outside the allowed area. Pending manager approval.', 'warning');
        } else {
          showToast('Clocked out successfully!', 'success');
        }
      }

      setShowCamera(false);
      setPendingClockAction(null);
      loadTodayAttendance();
    } catch (error) {
      showToast(`Failed to clock ${type}: ${error.message}`, 'error');
      setShowCamera(false);
      setPendingClockAction(null);
      // Refresh on error — the validation may have healed an orphan record
      // (legacy rows missing branchId), and we want it to surface so the
      // user can see and act on it (e.g. Clock Out instead of Clock In).
      loadTodayAttendance();
    } finally {
      setClockLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const todayActiveCount = todayTasks.filter(t => t.type !== 'completed').length;

  const tabs = [
    {
      id: 'today',
      label: "Today's Tasks",
      badge: todayActiveCount > 0 ? todayActiveCount : null,
      badgeType: 'info'
    },
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
        {activeTab === 'today' && (
          <div style={{ padding: '16px' }}>
            {todayTasksLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>Loading tasks...</div>
            ) : todayTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🎉</div>
                <h3 style={{ margin: '0 0 8px 0', color: '#374151' }}>No tasks for today</h3>
                <p style={{ color: '#9ca3af', margin: 0 }}>You have no scheduled services or active rooms right now.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {todayTasks.map(task => (
                  <div key={task.id} style={{
                    background: task.type === 'in-progress' ? '#eff6ff' : task.type === 'completed' ? '#f9fafb' : '#fff',
                    border: `1px solid ${task.type === 'in-progress' ? '#93c5fd' : task.type === 'completed' ? '#e5e7eb' : '#e5e7eb'}`,
                    borderLeft: `4px solid ${task.type === 'in-progress' ? '#3b82f6' : task.type === 'pending' ? '#f59e0b' : task.type === 'completed' ? '#22c55e' : '#6b7280'}`,
                    borderRadius: '8px',
                    padding: '14px 16px',
                    opacity: task.type === 'completed' ? 0.7 : 1
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                          padding: '2px 8px', borderRadius: '4px',
                          background: task.type === 'in-progress' ? '#3b82f6' : task.type === 'pending' ? '#f59e0b' : task.type === 'completed' ? '#22c55e' : '#6b7280',
                          color: '#fff'
                        }}>
                          {task.type === 'in-progress' ? 'In Progress' : task.type === 'pending' ? 'Pending' : task.type === 'completed' ? 'Done' : 'Upcoming'}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{task.time}</span>
                      </div>
                      {task.room && task.room !== '-' && (
                        <span style={{ fontSize: '0.8rem', color: '#6b7280', background: '#f3f4f6', padding: '2px 8px', borderRadius: '4px' }}>
                          🚪 {task.room}
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 500, fontSize: '0.95rem', color: '#111827' }}>{task.service}</div>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '2px' }}>Client: {task.client}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === 'history' && <MyAttendanceHistory embedded />}
        {activeTab === 'schedule' && <MySchedule embedded onDataChange={loadStats} />}
        {activeTab === 'requests' && <MyRequests embedded onDataChange={loadStats} />}
        {activeTab === 'payroll' && <PayrollRequests embedded onDataChange={loadStats} onOpenSubmitRef={payrollSubmitRef} />}
      </div>

      {/* Camera Capture Modal — note: CameraCapture uses `isOpen` to decide
          whether to render and `onCancel` for the dismiss callback. The
          previous wiring (onClose, missing isOpen) silently rendered
          nothing, which is why therapists/riders couldn't clock in from
          their own portal even though clicking the button "did something". */}
      <CameraCapture
        isOpen={showCamera}
        onCapture={handleCameraCapture}
        onCancel={() => { setShowCamera(false); setPendingClockAction(null); }}
      />
    </div>
  );
};

export default MyPortal;
