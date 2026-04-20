import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
// ChartJS is registered globally in main.jsx via utils/chartConfig
import { Bar, Doughnut, Line } from 'react-chartjs-2';

const CustomerAnalytics = () => {
  const navigate = useNavigate();
  const { showToast, getEffectiveBranchId } = useApp();

  const [loading, setLoading] = useState(true);
  const [customerData, setCustomerData] = useState(null);

  useEffect(() => {
    loadCustomerAnalytics();
  }, []);

  const loadCustomerAnalytics = async () => {
    try {
      setLoading(true);
      const data = await mockApi.analytics.getCustomerMetrics();

      // Filter customer data by branch
      const effectiveBranchId = getEffectiveBranchId();
      if (effectiveBranchId && data?.pareto?.top20Customers) {
        data.pareto.top20Customers = data.pareto.top20Customers.filter(item => item.branchId === effectiveBranchId);
      }
      if (effectiveBranchId && data?.segments) {
        Object.keys(data.segments).forEach(key => {
          if (Array.isArray(data.segments[key])) {
            data.segments[key] = data.segments[key].filter(item => item.branchId === effectiveBranchId);
          }
        });
      }

      setCustomerData(data);
      setLoading(false);
    } catch (error) {
      showToast('Failed to load customer analytics', 'error');
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
    return `${parseFloat(value || 0).toFixed(1)}%`;
  };

  // Transform segments object to array for charts
  const getSegmentsArray = () => {
    if (!customerData?.segments) return [];
    const { vip, regular, occasional, oneTime } = customerData.segments;
    return [
      { segment: 'VIP', count: vip?.length || 0, customers: vip || [], revenue: vip?.reduce((s, c) => s + c.totalSpent, 0) || 0, avgSpend: vip?.length ? Math.round(vip.reduce((s, c) => s + c.avgOrderValue, 0) / vip.length) : 0 },
      { segment: 'Regular', count: regular?.length || 0, customers: regular || [], revenue: regular?.reduce((s, c) => s + c.totalSpent, 0) || 0, avgSpend: regular?.length ? Math.round(regular.reduce((s, c) => s + c.avgOrderValue, 0) / regular.length) : 0 },
      { segment: 'Occasional', count: occasional?.length || 0, customers: occasional || [], revenue: occasional?.reduce((s, c) => s + c.totalSpent, 0) || 0, avgSpend: occasional?.length ? Math.round(occasional.reduce((s, c) => s + c.avgOrderValue, 0) / occasional.length) : 0 },
      { segment: 'New', count: oneTime?.length || 0, customers: oneTime || [], revenue: oneTime?.reduce((s, c) => s + c.totalSpent, 0) || 0, avgSpend: oneTime?.length ? Math.round(oneTime.reduce((s, c) => s + c.avgOrderValue, 0) / oneTime.length) : 0 }
    ];
  };

  const segmentsArray = getSegmentsArray();

  // Segment chart
  const segmentChartData = customerData ? {
    labels: segmentsArray.map(s => s.segment),
    datasets: [{
      data: segmentsArray.map(s => s.count),
      backgroundColor: [
        'rgba(27, 94, 55, 0.8)',
        'rgba(27, 94, 55, 0.6)',
        'rgba(217, 119, 6, 0.8)',
        'rgba(102, 102, 102, 0.6)'
      ],
      borderWidth: 0
    }]
  } : null;

  // Revenue by segment
  const revenueBySegmentData = customerData ? {
    labels: segmentsArray.map(s => s.segment),
    datasets: [{
      label: 'Revenue Contribution',
      data: segmentsArray.map(s => s.revenue),
      backgroundColor: 'rgba(27, 94, 55, 0.8)',
      borderRadius: 4
    }]
  } : null;

  // Pareto chart (80/20 rule)
  const paretoChartData = customerData?.pareto ? {
    labels: ['Top 20% Customers', 'Other 80% Customers'],
    datasets: [{
      data: [parseFloat(customerData.pareto.top20RevenuePercent) || 0, 100 - parseFloat(customerData.pareto.top20RevenuePercent || 0)],
      backgroundColor: [
        'rgba(27, 94, 55, 0.8)',
        'rgba(224, 224, 224, 0.6)'
      ],
      borderWidth: 0
    }]
  } : null;

  // Visit frequency distribution
  const visitFrequencyData = customerData ? {
    labels: ['1 visit', '2-3 visits', '4-6 visits', '7-10 visits', '10+ visits'],
    datasets: [{
      label: 'Customers',
      data: [
        segmentsArray.find(s => s.segment === 'New')?.count || 0,
        segmentsArray.find(s => s.segment === 'Occasional')?.count || 0,
        segmentsArray.find(s => s.segment === 'Regular')?.count || 0,
        Math.floor((segmentsArray.find(s => s.segment === 'VIP')?.count || 0) / 2),
        Math.ceil((segmentsArray.find(s => s.segment === 'VIP')?.count || 0) / 2)
      ],
      backgroundColor: 'rgba(27, 94, 55, 0.8)',
      borderRadius: 4
    }]
  } : null;

  if (loading) {
    return (
      <div className="analytics-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading customer analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-page customer-analytics">
      {/* Header */}
      <div className="analytics-header">
        <div className="header-left">
          <button className="btn-back" onClick={() => navigate('/analytics')}>
            ← Back
          </button>
          <div>
            <h1>Customer Analytics</h1>
            <p className="subtitle">CLV, AOV, retention rates & customer segmentation</p>
          </div>
        </div>
        <div className="header-right">
          <button onClick={loadCustomerAnalytics} className="btn-refresh">
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="summary-cards">
        <div className="summary-card highlight">
          <span className="summary-label">Customer Lifetime Value</span>
          <span className="summary-value">{formatCurrency(customerData?.summary?.avgCLV || 0)}</span>
          <span className="summary-hint">Avg revenue per customer over their lifetime</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Average Order Value</span>
          <span className="summary-value">{formatCurrency(customerData?.summary?.avgAOV || 0)}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Retention Rate</span>
          <span className={`summary-value ${parseFloat(customerData?.summary?.retentionRate) >= 70 ? 'positive' : parseFloat(customerData?.summary?.retentionRate) >= 50 ? 'warning' : 'negative'}`}>
            {formatPercent(customerData?.summary?.retentionRate)}
          </span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Total Customers</span>
          <span className="summary-value">{customerData?.summary?.totalCustomers || 0}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Returning Customers</span>
          <span className="summary-value positive">{customerData?.summary?.returningCustomers || 0}</span>
          <span className="summary-hint">Customers with 2+ visits</span>
        </div>
      </div>

      {/* Pareto Analysis */}
      <div className="pareto-section">
        <h3>Pareto Analysis (80/20 Rule)</h3>
        <div className="pareto-content">
          <div className="pareto-chart">
            {paretoChartData && (
              <Doughnut
                data={paretoChartData}
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
          <div className="pareto-stats">
            <div className="pareto-stat highlight">
              <span className="stat-value">{customerData?.pareto?.top20RevenuePercent || 0}%</span>
              <span className="stat-label">of revenue comes from</span>
            </div>
            <div className="pareto-stat">
              <span className="stat-value">{customerData?.pareto?.top20Count || 0}</span>
              <span className="stat-label">top customers (20%)</span>
            </div>
            <div className="pareto-insight">
              <strong>Insight:</strong> Focus retention efforts on your top {customerData?.pareto?.top20Count || 0} customers
              who contribute {customerData?.pareto?.top20RevenuePercent || 0}% of your revenue.
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        <div className="chart-card">
          <h3>Customer Segments</h3>
          {segmentChartData && (
            <Doughnut
              data={segmentChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                  legend: {
                    position: 'right',
                    labels: { color: '#666666' }
                  }
                }
              }}
            />
          )}
        </div>
        <div className="chart-card">
          <h3>Revenue by Segment</h3>
          {revenueBySegmentData && (
            <Bar
              data={revenueBySegmentData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                  legend: { display: false }
                },
                scales: {
                  x: {
                    ticks: { color: '#666666' },
                    grid: { display: false }
                  },
                  y: {
                    ticks: { color: '#666666' },
                    grid: { color: 'rgba(224, 224, 224, 0.5)' }
                  }
                }
              }}
            />
          )}
        </div>
        <div className="chart-card">
          <h3>Visit Frequency Distribution</h3>
          {visitFrequencyData && (
            <Bar
              data={visitFrequencyData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                  legend: { display: false }
                },
                scales: {
                  x: {
                    ticks: { color: '#666666' },
                    grid: { display: false }
                  },
                  y: {
                    ticks: { color: '#666666' },
                    grid: { color: 'rgba(224, 224, 224, 0.5)' }
                  }
                }
              }}
            />
          )}
        </div>
      </div>

      {/* Segment Details */}
      <div className="segment-section">
        <h3>Customer Segment Details</h3>
        <div className="segment-cards">
          {segmentsArray.map((segment, index) => (
            <div key={index} className={`segment-card ${segment.segment.toLowerCase()}`}>
              <div className="segment-header">
                <span className="segment-name">{segment.segment}</span>
              </div>
              <div className="segment-stats">
                <div className="segment-stat">
                  <span className="stat-value">{segment.count}</span>
                  <span className="stat-label">Customers</span>
                </div>
                <div className="segment-stat">
                  <span className="stat-value">{formatCurrency(segment.avgSpend)}</span>
                  <span className="stat-label">Avg Spend</span>
                </div>
                <div className="segment-stat">
                  <span className="stat-value">{formatCurrency(segment.revenue)}</span>
                  <span className="stat-label">Total Revenue</span>
                </div>
              </div>
              <div className="segment-desc">
                {segment.segment === 'VIP' && 'Top customers with highest lifetime value. Prioritize for exclusive offers.'}
                {segment.segment === 'Regular' && 'Consistent visitors. Focus on maintaining satisfaction and upselling.'}
                {segment.segment === 'Occasional' && 'Visit sometimes. Target with re-engagement campaigns.'}
                {segment.segment === 'New' && 'First-time visitors. Focus on great first experience and follow-up.'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Customers Table */}
      <div className="table-section">
        <h3>Top Customers by Lifetime Value</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Customer</th>
                <th>Email</th>
                <th>Total Visits</th>
                <th>Total Spent</th>
                <th>Avg Order Value</th>
                <th>CLV</th>
              </tr>
            </thead>
            <tbody>
              {customerData?.pareto?.top20Customers?.map((customer, index) => (
                <tr key={index}>
                  <td>
                    <span className={`rank-badge ${index < 3 ? 'top3' : ''}`}>
                      #{index + 1}
                    </span>
                  </td>
                  <td className="customer-name">{customer.name}</td>
                  <td>{customer.email}</td>
                  <td>{customer.visitCount || 0}</td>
                  <td className="highlight">{formatCurrency(customer.totalSpent)}</td>
                  <td>{formatCurrency(customer.avgOrderValue)}</td>
                  <td>{formatCurrency(customer.clv)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Retention Insights */}
      <div className="insights-section compact">
        <h3>Retention Insights</h3>
        <div className="insight-cards">
          <div className="insight-card">
            <div className="insight-content">
              <strong>Retention Rate: {formatPercent(customerData?.summary?.retentionRate)}</strong>
              <p>
                {parseFloat(customerData?.summary?.retentionRate) >= 70
                  ? 'Excellent! Your retention rate is above industry average. Keep up the great work!'
                  : parseFloat(customerData?.summary?.retentionRate) >= 50
                  ? 'Good retention rate. Focus on VIP customers to push this higher.'
                  : 'Needs improvement. Consider loyalty programs and personalized follow-ups.'}
              </p>
            </div>
          </div>
          <div className="insight-card">
            <div className="insight-content">
              <strong>CLV Opportunity</strong>
              <p>
                Increasing retention by 5% could boost CLV to {formatCurrency((customerData?.summary?.avgCLV || 0) * 1.25)}.
                Focus on converting Occasional customers to Regular.
              </p>
            </div>
          </div>
          <div className="insight-card">
            <div className="insight-content">
              <strong>VIP Strategy</strong>
              <p>
                Your {segmentsArray.find(s => s.segment === 'VIP')?.count || 0} VIP customers
                generate disproportionate value. Consider exclusive perks and early access to new services.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerAnalytics;
