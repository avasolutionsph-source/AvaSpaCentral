import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
// ChartJS is registered globally in main.jsx via utils/chartConfig
import { Line, Bar, Doughnut } from 'react-chartjs-2';

const AnalyticsDashboard = () => {
  const navigate = useNavigate();
  const { showToast, getUserBranchId } = useApp();

  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [breakEven, setBreakEven] = useState(null);
  const [profitability, setProfitability] = useState(null);
  const [burnRate, setBurnRate] = useState(null);
  const [customerMetrics, setCustomerMetrics] = useState(null);
  const [forecasts, setForecasts] = useState(null);
  const [insights, setInsights] = useState([]);
  const [realtimeProfit, setRealtimeProfit] = useState(null);
  const [salaryHealth, setSalaryHealth] = useState(null);
  const [utilizationMetrics, setUtilizationMetrics] = useState(null);

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  // Real-time profit update every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const realtime = await mockApi.analytics.getRealtimeProfit();
        setRealtimeProfit(realtime);
      } catch (error) {
        // Silent fail for realtime updates
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      const [bep, profit, burn, customers, forecast, aiInsights, realtime, salaryHealthData, utilization] = await Promise.all([
        mockApi.analytics.getBreakEvenMetrics(),
        mockApi.analytics.getProfitabilityMetrics(period),
        mockApi.analytics.getBurnRateAndRunway(),
        mockApi.analytics.getCustomerMetrics(),
        mockApi.analytics.getForecasts(),
        mockApi.analytics.getInsights(),
        mockApi.analytics.getRealtimeProfit(),
        mockApi.analytics.getSalaryHealthMetrics(),
        mockApi.analytics.getUtilizationMetrics(period)
      ]);

      // Filter insights by branch
      const userBranchId = getUserBranchId();
      let filteredInsights = aiInsights?.insights || [];
      if (userBranchId) {
        filteredInsights = filteredInsights.filter(item => !item.branchId || item.branchId === userBranchId);
      }

      setBreakEven(bep);
      setProfitability(profit);
      setBurnRate(burn);
      setCustomerMetrics(customers);
      setForecasts(forecast);
      setInsights(filteredInsights);
      setRealtimeProfit(realtime);
      setSalaryHealth(salaryHealthData);
      setUtilizationMetrics(utilization);
      setLoading(false);
    } catch (error) {
      showToast('Failed to load analytics data', 'error');
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

  const formatPercent = (value) => {
    return `${parseFloat(value).toFixed(1)}%`;
  };

  const getInsightIcon = (type) => {
    switch (type) {
      case 'warning': return '⚠️';
      case 'success': return '✅';
      case 'opportunity': return '💡';
      case 'critical': return '🚨';
      default: return '📊';
    }
  };

  const getInsightClass = (type) => {
    switch (type) {
      case 'warning': return 'insight-warning';
      case 'success': return 'insight-success';
      case 'opportunity': return 'insight-opportunity';
      case 'critical': return 'insight-critical';
      default: return 'insight-info';
    }
  };

  // Chart configurations
  const profitTrendChart = profitability?.trend ? {
    labels: profitability.trend.map(t => t.date),
    datasets: [
      {
        label: 'Revenue',
        data: profitability.trend.map(t => t.revenue),
        borderColor: 'rgba(27, 94, 55, 1)',
        backgroundColor: 'rgba(27, 94, 55, 0.1)',
        fill: true,
        tension: 0.4
      },
      {
        label: 'COGS',
        data: profitability.trend.map(t => t.cogs),
        borderColor: 'rgba(220, 38, 38, 1)',
        backgroundColor: 'rgba(220, 38, 38, 0.1)',
        fill: true,
        tension: 0.4
      },
      {
        label: 'Gross Profit',
        data: profitability.trend.map(t => t.grossProfit),
        borderColor: 'rgba(102, 102, 102, 1)',
        backgroundColor: 'rgba(102, 102, 102, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  } : null;

  const forecastChart = forecasts?.sales?.forecast ? {
    labels: forecasts.sales.forecast.map(f => f.month),
    datasets: [
      {
        label: 'Forecasted Revenue',
        data: forecasts.sales.forecast.map(f => f.forecastedRevenue),
        borderColor: 'rgba(27, 94, 55, 1)',
        backgroundColor: 'rgba(27, 94, 55, 0.5)',
        borderDash: [5, 5]
      }
    ]
  } : null;

  const customerSegmentChart = customerMetrics?.segments ? {
    labels: ['VIP', 'Regular', 'Occasional', 'One-Time'],
    datasets: [{
      data: [
        customerMetrics.segments.vip?.length || 0,
        customerMetrics.segments.regular?.length || 0,
        customerMetrics.segments.occasional?.length || 0,
        customerMetrics.segments.oneTime?.length || 0
      ],
      backgroundColor: [
        'rgba(27, 94, 55, 0.8)',
        'rgba(27, 94, 55, 0.6)',
        'rgba(102, 102, 102, 0.6)',
        'rgba(102, 102, 102, 0.4)'
      ],
      borderWidth: 0
    }]
  } : null;

  if (loading) {
    return (
      <div className="analytics-dashboard">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard">
      {/* Header */}
      <div className="analytics-header">
        <div className="header-left">
          <h1>Analytics Dashboard</h1>
          <p className="subtitle">Executive overview of business performance</p>
        </div>
        <div className="header-right">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="period-select"
          >
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="quarter">Last Quarter</option>
            <option value="year">Last Year</option>
          </select>
          <button onClick={loadAnalytics} className="btn-refresh">
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Quick Navigation - Detailed Analytics */}
      <div className="quick-nav top">
        <div className="nav-cards">
          <div className="nav-card" onClick={() => navigate('/analytics/products')}>
            <span className="nav-icon">📦</span>
            <span className="nav-title">Product Analytics</span>
            <span className="nav-desc">GPM by product, pricing optimization</span>
          </div>
          <div className="nav-card" onClick={() => navigate('/analytics/inventory')}>
            <span className="nav-icon">📊</span>
            <span className="nav-title">Inventory Analytics</span>
            <span className="nav-desc">Turnover rates, stockout forecasts</span>
          </div>
          <div className="nav-card" onClick={() => navigate('/analytics/customers')}>
            <span className="nav-icon">👥</span>
            <span className="nav-title">Customer Analytics</span>
            <span className="nav-desc">CLV, retention, Pareto analysis</span>
          </div>
          <div className="nav-card" onClick={() => navigate('/analytics/employees')}>
            <span className="nav-icon">👔</span>
            <span className="nav-title">Employee Analytics</span>
            <span className="nav-desc">Productivity metrics, performance</span>
          </div>
          <div className="nav-card" onClick={() => navigate('/analytics/opex')}>
            <span className="nav-icon">💵</span>
            <span className="nav-title">OPEX & Tax</span>
            <span className="nav-desc">Operating expenses, tax compliance</span>
          </div>
          <div className="nav-card" onClick={() => navigate('/analytics/heatmap')}>
            <span className="nav-icon">🔥</span>
            <span className="nav-title">Sales Heatmap</span>
            <span className="nav-desc">Peak hours, daily patterns</span>
          </div>
        </div>
      </div>

      {/* Real-time Profit Banner */}
      {realtimeProfit?.today && (
        <div className={`realtime-banner ${realtimeProfit.today.netProfit >= 0 ? 'positive' : 'negative'}`}>
          <div className="realtime-content">
            <span className="realtime-label">Today's Live Profit</span>
            <span className="realtime-value">{formatCurrency(realtimeProfit.today.netProfit)}</span>
            <span className="realtime-details">
              Revenue: {formatCurrency(realtimeProfit.today.revenue)} |
              Costs: {formatCurrency(realtimeProfit.today.laborCost + realtimeProfit.today.dailyFixedCost + realtimeProfit.today.cogs)} |
              Transactions: {realtimeProfit.today.transactionCount}
            </span>
          </div>
          <div className="realtime-indicator">
            <span className="pulse"></span> LIVE
          </div>
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="kpi-grid">
        {/* Break-Even Progress */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-icon">📊</span>
            <span className="kpi-title">Break-Even Progress</span>
          </div>
          <div className="kpi-value">{formatPercent(breakEven?.monthly?.progressPercent)}</div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${Math.min(breakEven?.monthly?.progressPercent || 0, 100)}%` }}
            ></div>
          </div>
          <div className="kpi-details">
            <span>Daily Target: {formatCurrency(breakEven?.daily?.dailyRevenueTarget)}</span>
            <span>Monthly BEP: {formatCurrency(breakEven?.breakEvenRevenue)}</span>
          </div>
        </div>

        {/* Gross Profit Margin */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-icon">💰</span>
            <span className="kpi-title">Gross Profit Margin</span>
          </div>
          <div className={`kpi-value ${parseFloat(profitability?.grossProfitMargin) >= 50 ? 'positive' : 'warning'}`}>
            {formatPercent(profitability?.grossProfitMargin)}
          </div>
          <div className="kpi-details">
            <span>Revenue: {formatCurrency(profitability?.revenue)}</span>
            <span>COGS: {formatCurrency(profitability?.cogs)}</span>
          </div>
        </div>

        {/* Net Profit Margin */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-icon">📈</span>
            <span className="kpi-title">Net Profit Margin</span>
          </div>
          <div className={`kpi-value ${parseFloat(profitability?.netProfitMargin) >= 15 ? 'positive' : parseFloat(profitability?.netProfitMargin) >= 0 ? 'warning' : 'negative'}`}>
            {formatPercent(profitability?.netProfitMargin)}
          </div>
          <div className="kpi-details">
            <span>Gross Profit: {formatCurrency(profitability?.grossProfit)}</span>
            <span>Net Profit: {formatCurrency(profitability?.netProfit)}</span>
          </div>
        </div>

        {/* Cash Runway */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-icon">🏦</span>
            <span className="kpi-title">Cash Runway</span>
          </div>
          <div className={`kpi-value ${burnRate?.runwayMonths >= 6 ? 'positive' : burnRate?.runwayMonths >= 3 ? 'warning' : 'negative'}`}>
            {burnRate?.runwayMonths || 0} months
          </div>
          <div className="kpi-details">
            <span>Cash: {formatCurrency(burnRate?.cash?.totalCash)}</span>
            <span>Burn Rate: {formatCurrency(burnRate?.monthlyBurnRate)}/mo</span>
          </div>
        </div>

        {/* Customer Lifetime Value */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-icon">👥</span>
            <span className="kpi-title">Customer Lifetime Value</span>
          </div>
          <div className="kpi-value">{formatCurrency(customerMetrics?.summary?.avgCLV)}</div>
          <div className="kpi-details">
            <span>AOV: {formatCurrency(customerMetrics?.summary?.avgAOV)}</span>
            <span>Retention: {formatPercent(customerMetrics?.summary?.retentionRate)}</span>
          </div>
        </div>

        {/* Total Customers */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-icon">🎯</span>
            <span className="kpi-title">Customer Base</span>
          </div>
          <div className="kpi-value">{customerMetrics?.summary?.totalCustomers || 0}</div>
          <div className="kpi-details">
            <span>Returning: {customerMetrics?.summary?.returningCustomers || 0}</span>
            <span>Top 20%: {customerMetrics?.pareto?.top20Count || 0} customers</span>
          </div>
        </div>

        {/* Salary Health Indicator */}
        {salaryHealth && (
          <div className="kpi-card salary-health-card">
            <div className="kpi-header">
              <span className="kpi-icon">💰</span>
              <span className="kpi-title">Salary Health</span>
            </div>
            <div className="salary-health-score" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                className="health-score-circle"
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: `conic-gradient(${salaryHealth.health.color} ${salaryHealth.health.score}%, #E5E7EB ${salaryHealth.health.score}%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  color: salaryHealth.health.color
                }}>
                  {salaryHealth.health.score}
                </div>
              </div>
              <div>
                <div style={{ fontWeight: '600', color: salaryHealth.health.color, fontSize: '1rem' }}>
                  {salaryHealth.health.label}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#666' }}>
                  {salaryHealth.currentMonth.payrollPercentage}% of Revenue
                </div>
              </div>
            </div>
            <div className="salary-benchmark-bar" style={{ marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#888', marginBottom: '4px' }}>
                <span>0%</span>
                <span style={{ color: '#10B981' }}>Industry: {salaryHealth.benchmark.industry.min}-{salaryHealth.benchmark.industry.max}%</span>
                <span>50%</span>
              </div>
              <div style={{ height: '8px', background: '#E5E7EB', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute',
                  left: `${salaryHealth.benchmark.industry.min * 2}%`,
                  width: `${(salaryHealth.benchmark.industry.max - salaryHealth.benchmark.industry.min) * 2}%`,
                  height: '100%',
                  background: 'rgba(16, 185, 129, 0.2)',
                  borderRadius: '4px'
                }}></div>
                <div style={{
                  position: 'absolute',
                  left: `${Math.min(salaryHealth.currentMonth.payrollPercentage * 2, 98)}%`,
                  width: '4px',
                  height: '100%',
                  background: salaryHealth.health.color,
                  borderRadius: '2px',
                  transform: 'translateX(-50%)'
                }}></div>
              </div>
            </div>
            <div className="kpi-details" style={{ marginTop: '8px' }}>
              <span>
                {salaryHealth.trend.direction === 'improving' && '↗️ '}
                {salaryHealth.trend.direction === 'declining' && '↘️ '}
                {salaryHealth.trend.direction === 'stable' && '→ '}
                {salaryHealth.trend.direction}
              </span>
              <span>₱{salaryHealth.currentMonth.totalPayroll.toLocaleString()}/mo</span>
            </div>
          </div>
        )}

        {/* No-Show Rate */}
        {utilizationMetrics && (
          <div className="kpi-card">
            <div className="kpi-header">
              <span className="kpi-icon">📅</span>
              <span className="kpi-title">No-Show Rate</span>
            </div>
            <div className={`kpi-value ${parseFloat(utilizationMetrics.noShow.noShowRate) <= 10 ? 'positive' : 'warning'}`}>
              {utilizationMetrics.noShow.noShowRate}%
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${Math.min(parseFloat(utilizationMetrics.noShow.noShowRate) * 5, 100)}%`,
                  background: parseFloat(utilizationMetrics.noShow.noShowRate) > 10 ? 'var(--error)' : 'var(--primary)'
                }}
              ></div>
            </div>
            <div className="kpi-details">
              <span>{utilizationMetrics.noShow.noShowCount} no-shows</span>
              <span>Lost: {formatCurrency(utilizationMetrics.noShow.costOfNoShows)}</span>
            </div>
          </div>
        )}

        {/* Room Utilization */}
        {utilizationMetrics && (
          <div className="kpi-card">
            <div className="kpi-header">
              <span className="kpi-icon">🚪</span>
              <span className="kpi-title">Room Utilization</span>
            </div>
            <div className={`kpi-value ${utilizationMetrics.roomUtilization.avgUtilizationPercent >= 60 ? 'positive' : 'warning'}`}>
              {utilizationMetrics.roomUtilization.avgUtilizationPercent}%
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${utilizationMetrics.roomUtilization.avgUtilizationPercent}%` }}
              ></div>
            </div>
            <div className="kpi-details">
              <span>{utilizationMetrics.roomUtilization.activeRooms} active rooms</span>
              <span>Rev/Room: {formatCurrency(utilizationMetrics.roomUtilization.avgRevenuePerRoom)}</span>
            </div>
          </div>
        )}

        {/* Therapist Utilization */}
        {utilizationMetrics && (
          <div className="kpi-card">
            <div className="kpi-header">
              <span className="kpi-icon">💆</span>
              <span className="kpi-title">Therapist Utilization</span>
            </div>
            <div className={`kpi-value ${utilizationMetrics.therapistUtilization.avgUtilizationPercent >= 65 ? 'positive' : 'warning'}`}>
              {utilizationMetrics.therapistUtilization.avgUtilizationPercent}%
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${utilizationMetrics.therapistUtilization.avgUtilizationPercent}%` }}
              ></div>
            </div>
            <div className="kpi-details">
              <span>{utilizationMetrics.therapistUtilization.totalTherapists} therapists</span>
              <span>Rev/Therapist: {formatCurrency(utilizationMetrics.summary.revenuePerTherapist)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="charts-grid">
        {/* Profitability Trend */}
        <div className="chart-card large">
          <h3>Profitability Trend</h3>
          <div style={{ flex: 1, minHeight: 0 }}>
            {profitTrendChart && (
              <Line
                data={profitTrendChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  animation: false,
                  plugins: {
                    legend: {
                      position: 'top',
                      labels: { color: '#666666', font: { size: 10 } }
                    }
                  },
                  scales: {
                    x: { ticks: { color: '#666666', font: { size: 9 } }, grid: { color: '#E0E0E0' } },
                    y: { ticks: { color: '#666666', font: { size: 9 } }, grid: { color: '#E0E0E0' } }
                  }
                }}
              />
            )}
          </div>
        </div>

        {/* Revenue Forecast */}
        <div className="chart-card">
          <h3>Revenue Forecast</h3>
          <div style={{ flex: 1, minHeight: 0 }}>
            {forecastChart && (
              <Line
                data={forecastChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  animation: false,
                  plugins: {
                    legend: {
                      position: 'top',
                      labels: { color: '#666666', font: { size: 10 } }
                    }
                  },
                  scales: {
                    x: { ticks: { color: '#666666', font: { size: 9 } }, grid: { color: '#E0E0E0' } },
                    y: { ticks: { color: '#666666', font: { size: 9 } }, grid: { color: '#E0E0E0' } }
                  }
                }}
              />
            )}
          </div>
        </div>

        {/* Customer Segments */}
        <div className="chart-card">
          <h3>Customer Segments</h3>
          <div style={{ flex: 1, minHeight: 0 }}>
            {customerSegmentChart && (
              <Doughnut
                data={customerSegmentChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  animation: false,
                  plugins: {
                    legend: {
                      position: 'right',
                      labels: { color: '#666666', font: { size: 10 } }
                    }
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* AI Insights Section */}
      <div className="insights-section">
        <h3>AI-Powered Insights & Recommendations</h3>
        <div className="insights-grid">
          {insights.map((insight, index) => (
            <div key={index} className={`insight-card ${getInsightClass(insight.type)}`}>
              <div className="insight-header">
                <span className="insight-icon">{getInsightIcon(insight.type)}</span>
                <span className="insight-category">{insight.category}</span>
              </div>
              <p className="insight-message">{insight.message}</p>
              {insight.action && (
                <div className="insight-action">
                  <strong>Suggested Action:</strong> {insight.action}
                </div>
              )}
              {insight.impact && (
                <div className="insight-impact">
                  <strong>Potential Impact:</strong> {insight.impact}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default AnalyticsDashboard;
