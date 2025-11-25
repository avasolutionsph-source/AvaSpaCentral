import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi/mockApi';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line, Pie, Bar, Doughnut } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const Dashboard = () => {
  const navigate = useNavigate();
  const { showToast } = useApp();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kpis, setKpis] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [dailyGoal, setDailyGoal] = useState(15000);
  const [newGoal, setNewGoal] = useState('');
  const [pendingRevenue, setPendingRevenue] = useState(0);
  const [todaysBookings, setTodaysBookings] = useState(0);
  const [aiInsights, setAiInsights] = useState([]);
  const [showAiInsights, setShowAiInsights] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Get business settings
      const business = await mockApi.business.getSettings();
      setDailyGoal(business.settings.dailyGoal);

      // Get today's date
      const today = new Date().toISOString().split('T')[0];

      // Fetch all data
      const [todaySummary, weekSummary, monthSummary, transactions, appointments, attendance, products, rooms, pendingRevenueData, todaysBookingsCount] =
        await Promise.all([
          mockApi.transactions.getRevenueSummary('today'),
          mockApi.transactions.getRevenueSummary('week'),
          mockApi.transactions.getRevenueSummary('month'),
          mockApi.transactions.getTransactions({ limit: 10 }),
          mockApi.appointments.getAppointments({ date: today }),
          mockApi.attendance.getAttendance({ date: today }),
          mockApi.products.getProducts(),
          mockApi.rooms.getRooms(),
          mockApi.advanceBooking.getPendingRevenue(),
          mockApi.advanceBooking.getTodaysBookingsCount()
        ]);

      // Calculate KPIs
      const kpiData = {
        financial: {
          todayRevenue: todaySummary.totalRevenue,
          weekRevenue: weekSummary.totalRevenue,
          monthRevenue: monthSummary.totalRevenue,
          avgTransaction: todaySummary.averageTransaction
        },
        operational: {
          pendingAppointments: appointments.filter(a => a.status === 'pending').length,
          confirmedAppointments: appointments.filter(a => a.status === 'confirmed').length,
          completedToday: todaySummary.totalTransactions,
          roomUtilization: calculateRoomUtilization(rooms)
        },
        staff: {
          attendanceRate: calculateAttendanceRate(attendance),
          totalOvertime: 0, // Would calculate from attendance
          lateArrivals: attendance.filter(a => a.lateMinutes > 0).length,
          activeEmployees: attendance.length
        },
        inventory: {
          criticalStock: products.filter(p => p.type === 'product' && p.stock <= p.lowStockAlert).length,
          outOfStock: products.filter(p => p.type === 'product' && p.stock === 0).length,
          totalValue: calculateInventoryValue(products),
          lowStockAlerts: products.filter(p => p.type === 'product' && p.stock > 0 && p.stock <= p.lowStockAlert).length
        }
      };

      setKpis(kpiData);
      setRecentTransactions(transactions);
      setPendingRevenue(pendingRevenueData.total);
      setTodaysBookings(todaysBookingsCount);

      // Generate AI insights
      generateAIInsights(kpiData, transactions, products, rooms, pendingRevenueData, todaysBookingsCount);

      setLoading(false);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      showToast('Failed to load dashboard data', 'error');
      setLoading(false);
    }
  };

  const refreshDashboard = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
    showToast('Dashboard refreshed', 'success');
  };

  const calculateRoomUtilization = (rooms) => {
    const occupied = rooms.filter(r => r.status === 'occupied').length;
    const available = rooms.filter(r => r.status === 'available').length;
    const total = occupied + available;
    return total > 0 ? Math.round((occupied / total) * 100) : 0;
  };

  const calculateAttendanceRate = (attendance) => {
    const present = attendance.filter(a => a.status === 'present').length;
    const total = attendance.length;
    return total > 0 ? Math.round((present / total) * 100) : 0;
  };

  const calculateInventoryValue = (products) => {
    return products
      .filter(p => p.type === 'product')
      .reduce((sum, p) => sum + (p.stock * p.cost || 0), 0);
  };

  const generateAIInsights = (kpiData, transactions, products, rooms, pendingRevenueData, todaysBookingsCount) => {
    const insights = [];

    // Revenue Performance Insight
    const revenueGrowth = ((kpiData.financial.weekRevenue / 7) / dailyGoal) * 100;
    if (revenueGrowth >= 120) {
      insights.push({
        id: 'revenue_excellent',
        type: 'success',
        icon: '📈',
        title: 'Excellent Revenue Performance',
        message: `Your average daily revenue is ${revenueGrowth.toFixed(0)}% of your goal. Keep up the great work!`,
        action: 'View Reports',
        actionLink: '/reports',
        priority: 1
      });
    } else if (revenueGrowth < 70) {
      insights.push({
        id: 'revenue_low',
        type: 'warning',
        icon: '📉',
        title: 'Revenue Below Target',
        message: `Average daily revenue is only ${revenueGrowth.toFixed(0)}% of goal. Consider promotional campaigns or service bundles.`,
        action: 'Create Promotion',
        actionLink: '/products',
        priority: 2
      });
    }

    // Room Utilization Insight
    if (kpiData.operational.roomUtilization < 40) {
      insights.push({
        id: 'low_utilization',
        type: 'info',
        icon: '🏠',
        title: 'Low Room Utilization',
        message: `Only ${kpiData.operational.roomUtilization}% of rooms are occupied. Consider offering discounts during off-peak hours.`,
        action: 'View Rooms',
        actionLink: '/rooms',
        priority: 3
      });
    } else if (kpiData.operational.roomUtilization > 80) {
      insights.push({
        id: 'high_utilization',
        type: 'success',
        icon: '🔥',
        title: 'High Demand Alert',
        message: `Room utilization is at ${kpiData.operational.roomUtilization}%. Consider adding more capacity or raising prices.`,
        action: 'Manage Rooms',
        actionLink: '/rooms',
        priority: 1
      });
    }

    // Inventory Insights
    if (kpiData.inventory.criticalStock > 0) {
      insights.push({
        id: 'critical_stock',
        type: 'critical',
        icon: '⚠️',
        title: 'Critical Stock Levels',
        message: `${kpiData.inventory.criticalStock} products are critically low. Order supplies soon to avoid service disruptions.`,
        action: 'View Inventory',
        actionLink: '/products',
        priority: 1
      });
    }

    // Advance Booking Insight
    if (todaysBookingsCount > 5) {
      insights.push({
        id: 'high_bookings',
        type: 'success',
        icon: '📅',
        title: 'Busy Day Ahead',
        message: `You have ${todaysBookingsCount} advance bookings scheduled for today. Prepare your team accordingly.`,
        action: 'View Schedule',
        actionLink: '/appointments',
        priority: 2
      });
    }

    // Pending Revenue Opportunity
    if (pendingRevenueData.total > 5000) {
      insights.push({
        id: 'pending_revenue',
        type: 'info',
        icon: '💰',
        title: 'Pending Revenue Opportunity',
        message: `₱${pendingRevenueData.total.toLocaleString()} in pay-after bookings. Follow up to ensure collection.`,
        action: 'View Bookings',
        actionLink: '/appointments',
        priority: 2
      });
    }

    // Staff Performance Insight
    if (kpiData.staff.lateArrivals > 3) {
      insights.push({
        id: 'attendance_issue',
        type: 'warning',
        icon: '⏰',
        title: 'Attendance Concerns',
        message: `${kpiData.staff.lateArrivals} late arrivals today. Consider reviewing attendance policies.`,
        action: 'View Attendance',
        actionLink: '/attendance',
        priority: 3
      });
    } else if (kpiData.staff.attendanceRate === 100) {
      insights.push({
        id: 'perfect_attendance',
        type: 'success',
        icon: '⭐',
        title: 'Perfect Attendance',
        message: 'All employees are present today. Great team dedication!',
        action: null,
        actionLink: null,
        priority: 4
      });
    }

    // Service Bundle Recommendation
    const avgTransaction = kpiData.financial.avgTransaction;
    if (avgTransaction < 1000) {
      insights.push({
        id: 'upsell_opportunity',
        type: 'info',
        icon: '💡',
        title: 'Upsell Opportunity',
        message: `Average transaction is ₱${avgTransaction.toLocaleString()}. Create service bundles to increase ticket size.`,
        action: 'Manage Services',
        actionLink: '/products',
        priority: 3
      });
    }

    // Sort by priority
    insights.sort((a, b) => a.priority - b.priority);

    setAiInsights(insights.slice(0, 6)); // Show top 6 insights
  };

  const handleSetGoal = async () => {
    try {
      const goal = parseFloat(newGoal);
      if (isNaN(goal) || goal <= 0) {
        showToast('Please enter a valid goal amount', 'error');
        return;
      }

      await mockApi.business.updateDailyGoal(goal);
      setDailyGoal(goal);
      setShowGoalModal(false);
      setNewGoal('');
      showToast(`Daily goal set to ₱${goal.toLocaleString()}`, 'success');
    } catch (error) {
      showToast('Failed to update goal', 'error');
    }
  };

  const generateAlerts = async () => {
    try {
      const newAlerts = [];

      // Low stock alerts
      const products = await mockApi.products.getProducts();
      const lowStock = products.filter(p => p.type === 'product' && p.stock > 0 && p.stock <= p.lowStockAlert);
      if (lowStock.length > 0) {
        newAlerts.push({
          id: 'alert_low_stock',
          type: 'critical',
          title: 'Low Stock Alert',
          message: `${lowStock.length} items need reordering`,
          action: 'View Inventory',
          actionLink: '/products'
        });
      }

      // Revenue below goal
      if (kpis && dailyGoal > 0) {
        const goalProgress = (kpis.financial.todayRevenue / dailyGoal) * 100;
        const currentHour = new Date().getHours();
        if (goalProgress < 50 && currentHour >= 17) {
          newAlerts.push({
            id: 'alert_revenue',
            type: 'warning',
            title: 'Revenue Below Target',
            message: `Only ${goalProgress.toFixed(0)}% of daily goal reached`,
            action: 'View Details',
            actionLink: '/dashboard'
          });
        }
      }

      // Late arrivals
      if (kpis && kpis.staff.lateArrivals > 2) {
        newAlerts.push({
          id: 'alert_late',
          type: 'warning',
          title: 'Multiple Late Arrivals',
          message: `${kpis.staff.lateArrivals} employees late today`,
          action: 'View Attendance',
          actionLink: '/attendance'
        });
      }

      // Pending appointments
      if (kpis && kpis.operational.pendingAppointments > 0) {
        newAlerts.push({
          id: 'alert_appointments',
          type: 'info',
          title: 'Pending Appointments',
          message: `${kpis.operational.pendingAppointments} appointments need confirmation`,
          action: 'View Appointments',
          actionLink: '/appointments'
        });
      }

      setAlerts(newAlerts);
      showToast(`${newAlerts.length} alerts generated`, 'success');
    } catch (error) {
      showToast('Failed to generate alerts', 'error');
    }
  };

  const dismissAlert = (alertId) => {
    setAlerts(alerts.filter(a => a.id !== alertId));
  };

  const exportDailySales = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const transactions = await mockApi.transactions.getTransactions({
        startDate: today,
        endDate: today
      });

      // Generate CSV
      let csv = 'Time,Receipt#,Items,Employee,Customer,Payment Method,Subtotal,Discount,Total\n';

      transactions.forEach(t => {
        const time = new Date(t.date).toLocaleTimeString();
        const items = t.items.map(i => i.name).join(' + ');
        csv += `"${time}","${t.receiptNumber}","${items}","${t.employee?.name}","${t.customer?.name || 'Walk-in'}","${t.paymentMethod}","₱${t.subtotal}","₱${t.discount}","₱${t.totalAmount}"\n`;
      });

      // Add summary
      const total = transactions.reduce((sum, t) => sum + t.totalAmount, 0);
      csv += '\nSummary\n';
      csv += `Total Transactions,${transactions.length}\n`;
      csv += `Total Sales,"₱${total.toFixed(2)}"\n`;

      // Download
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `daily-sales-${today}.csv`;
      a.click();

      showToast('Daily sales report downloaded', 'success');
    } catch (error) {
      showToast('Failed to export sales', 'error');
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  // Chart data
  const revenueChartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Revenue (₱)',
        data: [8500, 12000, 10500, 15000, 13500, 18000, 16000],
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        tension: 0.4
      }
    ]
  };

  const bookingSourcesData = {
    labels: ['Walk-in', 'Phone', 'Facebook', 'Instagram', 'Website'],
    datasets: [
      {
        data: [35, 25, 20, 15, 5],
        backgroundColor: ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b']
      }
    ]
  };

  const topServicesData = {
    labels: ['Swedish Massage', 'Hot Stone', 'Facial', 'Body Scrub', 'Thai Massage'],
    datasets: [
      {
        label: 'Revenue (₱)',
        data: [96000, 72000, 48600, 35000, 32400],
        backgroundColor: '#8b5cf6'
      }
    ]
  };

  const paymentMethodsData = {
    labels: ['Cash', 'Card', 'GCash'],
    datasets: [
      {
        data: [50, 30, 20],
        backgroundColor: ['#10b981', '#3b82f6', '#f59e0b']
      }
    ]
  };

  return (
    <div className="dashboard-page">
      {/* Header Actions */}
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Real-time business overview</p>
        </div>
        <div className="header-actions">
          <button
            className="btn btn-secondary"
            onClick={refreshDashboard}
            disabled={refreshing}
          >
            {refreshing ? '↻ Refreshing...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        {/* Financial Metrics */}
        <div className="kpi-card">
          <div className="kpi-header">
            <h3>💰 Financial Metrics</h3>
            <button
              className="icon-btn"
              onClick={() => setShowGoalModal(true)}
              title="Set Daily Goal"
            >
              🎯
            </button>
          </div>
          <div className="kpi-items">
            <div className="kpi-item">
              <span className="kpi-label">Today's Revenue</span>
              <span className="kpi-value">₱{kpis?.financial.todayRevenue.toLocaleString()}</span>
            </div>
            <div className="kpi-item">
              <span className="kpi-label">This Week</span>
              <span className="kpi-value">₱{kpis?.financial.weekRevenue.toLocaleString()}</span>
            </div>
            <div className="kpi-item">
              <span className="kpi-label">This Month</span>
              <span className="kpi-value">₱{kpis?.financial.monthRevenue.toLocaleString()}</span>
            </div>
            <div className="kpi-item">
              <span className="kpi-label">Avg Transaction</span>
              <span className="kpi-value">₱{kpis?.financial.avgTransaction.toLocaleString()}</span>
            </div>
          </div>
          {dailyGoal > 0 && (
            <div className="goal-progress">
              <div className="progress-info">
                <span>Daily Goal Progress</span>
                <span>{Math.round((kpis?.financial.todayRevenue / dailyGoal) * 100)}%</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min((kpis?.financial.todayRevenue / dailyGoal) * 100, 100)}%`,
                    backgroundColor:
                      (kpis?.financial.todayRevenue / dailyGoal) >= 1 ? '#10b981' :
                      (kpis?.financial.todayRevenue / dailyGoal) >= 0.5 ? '#f59e0b' : '#ef4444'
                  }}
                ></div>
              </div>
              <div className="progress-text">
                ₱{kpis?.financial.todayRevenue.toLocaleString()} / ₱{dailyGoal.toLocaleString()}
              </div>
            </div>
          )}
        </div>

        {/* Operational Metrics */}
        <div className="kpi-card">
          <div className="kpi-header">
            <h3>📊 Operational Metrics</h3>
          </div>
          <div className="kpi-items">
            <div className="kpi-item">
              <span className="kpi-label">Pending Appointments</span>
              <span className="kpi-value">{kpis?.operational.pendingAppointments}</span>
            </div>
            <div className="kpi-item">
              <span className="kpi-label">Confirmed Appointments</span>
              <span className="kpi-value">{kpis?.operational.confirmedAppointments}</span>
            </div>
            <div className="kpi-item">
              <span className="kpi-label">Completed Today</span>
              <span className="kpi-value">{kpis?.operational.completedToday}</span>
            </div>
            <div className="kpi-item">
              <span className="kpi-label">Room Utilization</span>
              <span className="kpi-value">{kpis?.operational.roomUtilization}%</span>
            </div>
          </div>
        </div>

        {/* Staff Metrics */}
        <div className="kpi-card">
          <div className="kpi-header">
            <h3>👥 Staff Metrics</h3>
          </div>
          <div className="kpi-items">
            <div className="kpi-item">
              <span className="kpi-label">Attendance Rate</span>
              <span className="kpi-value">{kpis?.staff.attendanceRate}%</span>
            </div>
            <div className="kpi-item">
              <span className="kpi-label">Total Overtime</span>
              <span className="kpi-value">{kpis?.staff.totalOvertime}h</span>
            </div>
            <div className="kpi-item">
              <span className="kpi-label">Late Arrivals Today</span>
              <span className="kpi-value">{kpis?.staff.lateArrivals}</span>
            </div>
            <div className="kpi-item">
              <span className="kpi-label">Active Employees</span>
              <span className="kpi-value">{kpis?.staff.activeEmployees}</span>
            </div>
          </div>
        </div>

        {/* Inventory Metrics */}
        <div className="kpi-card">
          <div className="kpi-header">
            <h3>📦 Inventory Metrics</h3>
          </div>
          <div className="kpi-items">
            <div className="kpi-item clickable" onClick={() => navigate('/products')}>
              <span className="kpi-label">Critical Stock</span>
              <span className="kpi-value kpi-critical">{kpis?.inventory.criticalStock}</span>
            </div>
            <div className="kpi-item">
              <span className="kpi-label">Out of Stock</span>
              <span className="kpi-value">{kpis?.inventory.outOfStock}</span>
            </div>
            <div className="kpi-item">
              <span className="kpi-label">Total Value</span>
              <span className="kpi-value">₱{kpis?.inventory.totalValue.toLocaleString()}</span>
            </div>
            <div className="kpi-item">
              <span className="kpi-label">Low Stock Alerts</span>
              <span className="kpi-value kpi-warning">{kpis?.inventory.lowStockAlerts}</span>
            </div>
          </div>
        </div>

        {/* Advance Booking - Pending Revenue */}
        <div className="kpi-card">
          <div className="kpi-header">
            <h3>💰 Pending Revenue</h3>
          </div>
          <div className="kpi-items">
            <div className="kpi-item clickable" onClick={() => navigate('/appointments')}>
              <span className="kpi-label">Pay-After Bookings</span>
              <span className="kpi-value kpi-warning">₱{pendingRevenue.toLocaleString()}</span>
            </div>
            <div className="kpi-item">
              <span className="kpi-label">Description</span>
              <span className="kpi-description">Revenue from advance bookings awaiting payment after service</span>
            </div>
          </div>
        </div>

        {/* Advance Booking - Today's Bookings */}
        <div className="kpi-card">
          <div className="kpi-header">
            <h3>📅 Today's Bookings</h3>
          </div>
          <div className="kpi-items">
            <div className="kpi-item clickable" onClick={() => navigate('/appointments')}>
              <span className="kpi-label">Scheduled for Today</span>
              <span className="kpi-value">{todaysBookings}</span>
            </div>
            <div className="kpi-item">
              <span className="kpi-label">Description</span>
              <span className="kpi-description">Advance bookings scheduled for today</span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Insights Section */}
      {aiInsights.length > 0 && showAiInsights && (
        <div className="ai-insights-section">
          <div className="ai-insights-header">
            <div>
              <h2>🤖 AI-Powered Business Insights</h2>
              <p>Smart recommendations based on your business data</p>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowAiInsights(false)}
            >
              Hide Insights
            </button>
          </div>
          <div className="ai-insights-grid">
            {aiInsights.map((insight) => (
              <div key={insight.id} className={`ai-insight-card ai-insight-${insight.type}`}>
                <div className="ai-insight-icon">{insight.icon}</div>
                <div className="ai-insight-content">
                  <h4 className="ai-insight-title">{insight.title}</h4>
                  <p className="ai-insight-message">{insight.message}</p>
                  {insight.action && (
                    <button
                      className="ai-insight-action"
                      onClick={() => navigate(insight.actionLink)}
                    >
                      {insight.action} →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Show Insights Button (when hidden) */}
      {!showAiInsights && (
        <div style={{ marginBottom: 'var(--spacing-lg)', textAlign: 'center' }}>
          <button
            className="btn btn-primary"
            onClick={() => setShowAiInsights(true)}
          >
            🤖 Show AI Insights
          </button>
        </div>
      )}

      {/* Charts Section */}
      <div className="charts-grid">
        <div className="chart-card">
          <h3>📈 Revenue Trend (7 Days)</h3>
          <div className="chart-container">
            <Line data={revenueChartData} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>

        <div className="chart-card">
          <h3>📍 Booking Sources</h3>
          <div className="chart-container">
            <Pie data={bookingSourcesData} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>

        <div className="chart-card">
          <h3>⭐ Top Services by Revenue</h3>
          <div className="chart-container">
            <Bar data={topServicesData} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>

        <div className="chart-card">
          <h3>💳 Payment Methods</h3>
          <div className="chart-container">
            <Doughnut data={paymentMethodsData} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>
      </div>

      {/* Recent Transactions & Alerts Row */}
      <div className="dashboard-row">
        {/* Recent Transactions */}
        <div className="dashboard-section">
          <div className="section-header">
            <h3>💵 Recent Transactions</h3>
          </div>
          <div className="transactions-table">
            <table>
              <thead>
                <tr>
                  <th>Receipt #</th>
                  <th>Time</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((t) => (
                  <tr key={t._id}>
                    <td>{t.receiptNumber}</td>
                    <td>{new Date(t.date).toLocaleTimeString()}</td>
                    <td>{t.customer.name}</td>
                    <td className="amount">₱{t.totalAmount.toLocaleString()}</td>
                    <td><span className="badge">{t.paymentMethod}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alerts Section */}
        <div className="dashboard-section">
          <div className="section-header">
            <h3>🔔 Active Alerts</h3>
            <button className="btn btn-sm" onClick={generateAlerts}>
              Generate Alerts
            </button>
          </div>
          <div className="alerts-container">
            {alerts.length === 0 ? (
              <div className="empty-state">
                <p>No active alerts</p>
                <button className="btn btn-secondary btn-sm" onClick={generateAlerts}>
                  Generate Alerts
                </button>
              </div>
            ) : (
              alerts.map((alert) => (
                <div key={alert.id} className={`alert-card alert-${alert.type}`}>
                  <div className="alert-content">
                    <div className="alert-icon">
                      {alert.type === 'critical' && '🔴'}
                      {alert.type === 'warning' && '⚠️'}
                      {alert.type === 'info' && 'ℹ️'}
                    </div>
                    <div className="alert-details">
                      <h4>{alert.title}</h4>
                      <p>{alert.message}</p>
                    </div>
                  </div>
                  <div className="alert-actions">
                    <button
                      className="btn btn-sm"
                      onClick={() => navigate(alert.actionLink)}
                    >
                      {alert.action}
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => dismissAlert(alert.id)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h3>⚡ Quick Actions</h3>
        <div className="quick-actions-grid">
          <div className="quick-action-card" onClick={() => navigate('/pos')}>
            <div className="action-icon">💳</div>
            <h4>Open POS</h4>
            <p>Process sales & transactions</p>
          </div>
          <div className="quick-action-card" onClick={() => navigate('/appointments')}>
            <div className="action-icon">📅</div>
            <h4>Manage Appointments</h4>
            <p>View & schedule appointments</p>
          </div>
          <div className="quick-action-card" onClick={() => navigate('/attendance')}>
            <div className="action-icon">⏰</div>
            <h4>Check Attendance</h4>
            <p>Clock in/out & view records</p>
          </div>
          <div className="quick-action-card" onClick={() => navigate('/products')}>
            <div className="action-icon">📦</div>
            <h4>Check Inventory</h4>
            <p>Manage products & stock</p>
          </div>
          <div className="quick-action-card" onClick={refreshDashboard}>
            <div className="action-icon">↻</div>
            <h4>Sync Data</h4>
            <p>Refresh all data</p>
          </div>
          <div className="quick-action-card" onClick={exportDailySales}>
            <div className="action-icon">📊</div>
            <h4>Export Daily Sales</h4>
            <p>Download CSV report</p>
          </div>
        </div>
      </div>

      {/* Set Goal Modal */}
      {showGoalModal && (
        <div className="modal-overlay" onClick={() => setShowGoalModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Set Daily Revenue Goal</h2>
              <button className="modal-close" onClick={() => setShowGoalModal(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Current Goal: ₱{dailyGoal.toLocaleString()}</label>
                <input
                  type="number"
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                  placeholder="Enter new daily goal"
                  className="form-control"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowGoalModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSetGoal}>
                Save Goal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
