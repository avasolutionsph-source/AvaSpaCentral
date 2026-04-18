import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
// ChartJS is registered globally in main.jsx via utils/chartConfig
import { Bar, Radar, Doughnut } from 'react-chartjs-2';

const EmployeeAnalytics = () => {
  const navigate = useNavigate();
  const { showToast, getEffectiveBranchId } = useApp();

  const [loading, setLoading] = useState(true);
  const [employeeData, setEmployeeData] = useState(null);
  const [sortBy, setSortBy] = useState('revenue');

  useEffect(() => {
    loadEmployeeAnalytics();
  }, []);

  const loadEmployeeAnalytics = async () => {
    try {
      setLoading(true);
      const data = await mockApi.analytics.getEmployeeProductivityMetrics();

      // Filter employees by branch
      const effectiveBranchId = getEffectiveBranchId();
      if (effectiveBranchId && data?.employees) {
        data.employees = data.employees.filter(item => !item.branchId || item.branchId === effectiveBranchId);
      }

      setEmployeeData(data);
      setLoading(false);
    } catch (error) {
      showToast('Failed to load employee analytics', 'error');
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getProductivityClass = (score) => {
    if (score >= 90) return 'productivity-excellent';
    if (score >= 75) return 'productivity-good';
    if (score >= 60) return 'productivity-fair';
    return 'productivity-needs-improvement';
  };

  const getSortedEmployees = () => {
    if (!employeeData?.employees) return [];

    const employees = [...employeeData.employees];

    switch (sortBy) {
      case 'revenue':
        return employees.sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
      case 'services':
        return employees.sort((a, b) => (b.transactionCount || 0) - (a.transactionCount || 0));
      case 'efficiency':
        return employees.sort((a, b) => (b.efficiency || 0) - (a.efficiency || 0));
      case 'attendance':
        return employees.sort((a, b) => parseFloat(b.punctualityRate || 0) - parseFloat(a.punctualityRate || 0));
      case 'name':
        return employees.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      default:
        return employees;
    }
  };

  // Calculate avg punctuality for charts
  const avgPunctuality = employeeData?.employees?.length > 0
    ? employeeData.employees.reduce((sum, e) => sum + parseFloat(e.punctualityRate || 0), 0) / employeeData.employees.length
    : 0;

  // Revenue by employee chart
  const revenueChartData = employeeData ? {
    labels: employeeData.employees.slice(0, 8).map(e => e.name),
    datasets: [{
      label: 'Revenue Generated',
      data: employeeData.employees.slice(0, 8).map(e => e.revenue || 0),
      backgroundColor: 'rgba(27, 94, 55, 0.8)',
      borderRadius: 4
    }]
  } : null;

  // Services completed chart
  const servicesChartData = employeeData ? {
    labels: employeeData.employees.slice(0, 8).map(e => e.name),
    datasets: [{
      label: 'Services Completed',
      data: employeeData.employees.slice(0, 8).map(e => e.transactionCount || 0),
      backgroundColor: 'rgba(27, 94, 55, 0.6)',
      borderRadius: 4
    }]
  } : null;

  // Attendance breakdown
  const attendanceChartData = employeeData ? {
    labels: ['On Time', 'Late', 'Other'],
    datasets: [{
      data: [
        Math.round(avgPunctuality),
        Math.round(100 - avgPunctuality - 5),
        5
      ],
      backgroundColor: [
        'rgba(27, 94, 55, 0.8)',
        'rgba(217, 119, 6, 0.8)',
        'rgba(220, 38, 38, 0.8)'
      ],
      borderWidth: 0
    }]
  } : null;

  // Top performer radar
  const topPerformer = employeeData?.employees?.[0];
  const avgServicesPerDay = parseFloat(employeeData?.summary?.avgServicesPerDay || 1);
  const radarChartData = topPerformer ? {
    labels: ['Revenue', 'Services', 'Efficiency', 'Punctuality', 'Hours'],
    datasets: [{
      label: topPerformer.name,
      data: [
        Math.min(100, ((topPerformer.revenue || 0) / (employeeData.summary.avgRevenuePerEmployee || 1)) * 50),
        Math.min(100, (parseFloat(topPerformer.servicesPerDay || 0) / avgServicesPerDay) * 50),
        topPerformer.efficiency || 0,
        parseFloat(topPerformer.punctualityRate || 0),
        Math.min(100, ((topPerformer.totalHours || 0) / 160) * 100)
      ],
      backgroundColor: 'rgba(27, 94, 55, 0.2)',
      borderColor: 'rgba(27, 94, 55, 1)',
      borderWidth: 2,
      pointBackgroundColor: 'rgba(27, 94, 55, 1)'
    }]
  } : null;

  if (loading) {
    return (
      <div className="analytics-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading employee analytics...</p>
        </div>
      </div>
    );
  }

  const sortedEmployees = getSortedEmployees();

  return (
    <div className="analytics-page employee-analytics">
      {/* Header */}
      <div className="analytics-header">
        <div className="header-left">
          <button className="btn-back" onClick={() => navigate('/analytics')}>
            ← Back
          </button>
          <div>
            <h1>Employee Analytics</h1>
            <p className="subtitle">Productivity metrics, performance & attendance analysis</p>
          </div>
        </div>
        <div className="header-right">
          <button onClick={loadEmployeeAnalytics} className="btn-refresh">
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <span className="summary-label">Total Staff</span>
          <span className="summary-value">{employeeData?.summary?.totalStaff || 0}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Avg Revenue/Employee</span>
          <span className="summary-value">{formatCurrency(employeeData?.summary?.avgRevenuePerEmployee || 0)}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Avg Services/Day</span>
          <span className="summary-value">{employeeData?.summary?.avgServicesPerDay || '0.0'}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Avg Punctuality Rate</span>
          <span className={`summary-value ${avgPunctuality >= 90 ? 'positive' : 'warning'}`}>
            {avgPunctuality.toFixed(1)}%
          </span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Total Revenue</span>
          <span className="summary-value">{formatCurrency(employeeData?.summary?.totalRevenue || 0)}</span>
        </div>
      </div>

      {/* Top Performer Spotlight */}
      {topPerformer && (
        <div className="spotlight-section">
          <h3>Top Performer Spotlight</h3>
          <div className="spotlight-content">
            <div className="spotlight-info">
              <div className="performer-header">
                <div className="performer-avatar">
                  {topPerformer.name?.charAt(0) || '?'}
                </div>
                <div className="performer-details">
                  <h4>{topPerformer.name}</h4>
                  <span className="performer-position">{topPerformer.position}</span>
                </div>
              </div>
              <div className="performer-stats">
                <div className="stat">
                  <span className="stat-value">{formatCurrency(topPerformer.revenue || 0)}</span>
                  <span className="stat-label">Total Revenue</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{topPerformer.transactionCount || 0}</span>
                  <span className="stat-label">Services Completed</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{topPerformer.efficiency || 0}%</span>
                  <span className="stat-label">Efficiency</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{topPerformer.punctualityRate || 0}%</span>
                  <span className="stat-label">Punctuality</span>
                </div>
              </div>
            </div>
            <div className="spotlight-chart">
              {radarChartData && (
                <Radar
                  data={radarChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    plugins: {
                      legend: { display: false }
                    },
                    scales: {
                      r: {
                        angleLines: { color: 'rgba(224, 224, 224, 0.5)' },
                        grid: { color: 'rgba(224, 224, 224, 0.5)' },
                        pointLabels: { color: '#666666' },
                        ticks: { display: false },
                        suggestedMin: 0,
                        suggestedMax: 100
                      }
                    }
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="charts-row">
        <div className="chart-card">
          <h3>Revenue by Employee</h3>
          {revenueChartData && (
            <Bar
              data={revenueChartData}
              options={{
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                  legend: { display: false }
                },
                scales: {
                  x: {
                    ticks: { color: '#666666' },
                    grid: { color: 'rgba(224, 224, 224, 0.5)' }
                  },
                  y: {
                    ticks: { color: '#666666' },
                    grid: { display: false }
                  }
                }
              }}
            />
          )}
        </div>
        <div className="chart-card">
          <h3>Services Completed</h3>
          {servicesChartData && (
            <Bar
              data={servicesChartData}
              options={{
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                  legend: { display: false }
                },
                scales: {
                  x: {
                    ticks: { color: '#666666' },
                    grid: { color: 'rgba(224, 224, 224, 0.5)' }
                  },
                  y: {
                    ticks: { color: '#666666' },
                    grid: { display: false }
                  }
                }
              }}
            />
          )}
        </div>
        <div className="chart-card small">
          <h3>Punctuality Breakdown</h3>
          {attendanceChartData && (
            <Doughnut
              data={attendanceChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: { color: '#666666' }
                  }
                }
              }}
            />
          )}
        </div>
      </div>

      {/* Employee Table */}
      <div className="table-section">
        <div className="table-header">
          <h3>All Employees Performance</h3>
          <div className="table-controls">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="revenue">Sort by Revenue</option>
              <option value="services">Sort by Services</option>
              <option value="efficiency">Sort by Efficiency</option>
              <option value="attendance">Sort by Punctuality</option>
              <option value="name">Sort by Name</option>
            </select>
          </div>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Employee</th>
                <th>Position</th>
                <th>Services</th>
                <th>Revenue</th>
                <th>Avg/Service</th>
                <th>Efficiency</th>
                <th>Punctuality</th>
                <th>Late Count</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedEmployees.map((employee, index) => (
                <tr key={index}>
                  <td>
                    <span className={`rank-badge ${index < 3 ? 'top3' : ''}`}>
                      #{index + 1}
                    </span>
                  </td>
                  <td className="employee-name">
                    <div className="employee-cell">
                      <span className="avatar">{employee.name?.charAt(0) || '?'}</span>
                      <span>{employee.name}</span>
                    </div>
                  </td>
                  <td>{employee.position}</td>
                  <td>{employee.transactionCount || 0}</td>
                  <td className="highlight">{formatCurrency(employee.revenue || 0)}</td>
                  <td>{formatCurrency(employee.avgTicket || 0)}</td>
                  <td className={getProductivityClass(employee.efficiency || 0)}>
                    {employee.efficiency || 0}%
                  </td>
                  <td className={parseFloat(employee.punctualityRate || 0) >= 90 ? 'positive' : parseFloat(employee.punctualityRate || 0) >= 80 ? 'warning' : 'negative'}>
                    {employee.punctualityRate || 0}%
                  </td>
                  <td className={(employee.lateCount || 0) <= 2 ? '' : (employee.lateCount || 0) <= 5 ? 'warning' : 'negative'}>
                    {employee.lateCount || 0}
                  </td>
                  <td>
                    {index === 0 && <span className="badge success">Top Performer</span>}
                    {parseFloat(employee.punctualityRate || 0) < 80 && <span className="badge warning">Punctuality Issue</span>}
                    {(employee.lateCount || 0) > 5 && <span className="badge warning">Frequently Late</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Performance Insights */}
      <div className="insights-section compact">
        <h3>Performance Insights</h3>
        <div className="insight-cards">
          <div className="insight-card">
            <div className="insight-content">
              <strong>Team Efficiency</strong>
              <p>
                Average team efficiency is at {Math.round(employeeData?.employees?.reduce((sum, e) => sum + (e.efficiency || 0), 0) / (employeeData?.employees?.length || 1))}%.
                {(employeeData?.employees?.reduce((sum, e) => sum + (e.efficiency || 0), 0) / (employeeData?.employees?.length || 1)) >= 85
                  ? ' Great performance across the team!'
                  : ' Consider additional training to boost efficiency.'}
              </p>
            </div>
          </div>
          <div className="insight-card">
            <div className="insight-content">
              <strong>Punctuality Pattern</strong>
              <p>
                {avgPunctuality >= 90
                  ? 'Excellent punctuality across the team. Maintain current policies.'
                  : 'Some punctuality gaps detected. Review scheduling and flexibility options.'}
              </p>
            </div>
          </div>
          <div className="insight-card">
            <div className="insight-content">
              <strong>Revenue Distribution</strong>
              <p>
                Top 3 employees generate {Math.round(
                  ((employeeData?.employees?.slice(0, 3).reduce((sum, e) => sum + (e.revenue || 0), 0) || 0) /
                  (employeeData?.summary?.totalRevenue || 1)) * 100
                )}% of total revenue. Consider mentorship programs to elevate others.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeAnalytics;
