import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const OpexTaxAnalytics = () => {
  const navigate = useNavigate();
  const { showToast } = useApp();

  const [loading, setLoading] = useState(true);
  const [opexData, setOpexData] = useState(null);
  const [salaryHealth, setSalaryHealth] = useState(null);

  useEffect(() => {
    loadOpexAnalytics();
  }, []);

  const loadOpexAnalytics = async () => {
    try {
      setLoading(true);
      const [data, salaryData] = await Promise.all([
        mockApi.analytics.getOpexAndTaxMetrics(),
        mockApi.analytics.getSalaryHealthMetrics()
      ]);
      setOpexData(data);
      setSalaryHealth(salaryData);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load OPEX analytics:', error);
      showToast('Failed to load OPEX analytics', 'error');
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

  // Transform byCategory object to array for charts
  const getBreakdownArray = () => {
    if (!opexData?.currentMonth?.byCategory) return [];
    const byCategory = opexData.currentMonth.byCategory;
    const totalOpex = opexData.currentMonth.totalOpex || 1;
    const revenue = opexData.currentMonth.revenue || 1;

    return Object.entries(byCategory).map(([category, amount]) => ({
      category,
      amount,
      percentOfOpex: ((amount / totalOpex) * 100).toFixed(1),
      percentOfRevenue: ((amount / revenue) * 100).toFixed(1),
      trend: 'stable'
    })).sort((a, b) => b.amount - a.amount);
  };

  const breakdownArray = getBreakdownArray();

  // OPEX breakdown pie chart
  const opexBreakdownData = breakdownArray.length > 0 ? {
    labels: breakdownArray.map(b => b.category),
    datasets: [{
      data: breakdownArray.map(b => b.amount),
      backgroundColor: [
        'rgba(27, 94, 55, 0.8)',
        'rgba(27, 94, 55, 0.6)',
        'rgba(217, 119, 6, 0.8)',
        'rgba(220, 38, 38, 0.8)',
        'rgba(102, 102, 102, 0.8)',
        'rgba(102, 102, 102, 0.6)',
        'rgba(26, 26, 26, 0.6)',
        'rgba(153, 153, 153, 0.6)'
      ],
      borderWidth: 0
    }]
  } : null;

  // Tax breakdown
  const taxBreakdownData = opexData ? {
    labels: ['VAT Payable', 'SSS', 'PhilHealth', 'Pag-IBIG', 'Withholding Tax'],
    datasets: [{
      label: 'Tax Obligations',
      data: [
        opexData.taxes?.vatPayable || 0,
        opexData.statutory?.sss || 0,
        opexData.statutory?.philHealth || 0,
        opexData.statutory?.pagIbig || 0,
        opexData.taxes?.withholdingTax || 0
      ],
      backgroundColor: [
        'rgba(27, 94, 55, 0.8)',
        'rgba(27, 94, 55, 0.6)',
        'rgba(217, 119, 6, 0.8)',
        'rgba(220, 38, 38, 0.8)',
        'rgba(102, 102, 102, 0.8)'
      ],
      borderRadius: 4
    }]
  } : null;

  // Fixed vs Variable expenses pie chart
  const fixedVsVariableData = opexData ? {
    labels: ['Fixed Costs', 'Variable Expenses'],
    datasets: [{
      data: [
        opexData.currentMonth?.fixedCosts || 0,
        opexData.currentMonth?.variableExpenses || 0
      ],
      backgroundColor: [
        'rgba(27, 94, 55, 0.8)',
        'rgba(217, 119, 6, 0.8)'
      ],
      borderWidth: 0
    }]
  } : null;

  // OPEX vs CAPEX stacked bar by month (using history data)
  const opexVsCapexData = opexData?.history ? {
    labels: opexData.history.map(h => h.month),
    datasets: [
      {
        label: 'OPEX',
        data: opexData.history.map(h => h.expenses),
        backgroundColor: 'rgba(27, 94, 55, 0.8)',
        borderRadius: 4
      },
      {
        label: 'CAPEX (Estimated)',
        data: opexData.history.map(h => Math.round(h.expenses * 0.15)), // Estimate CAPEX at 15% of OPEX
        backgroundColor: 'rgba(102, 102, 102, 0.6)',
        borderRadius: 4
      }
    ]
  } : null;

  // Expense ratio trend line
  const expenseRatioTrendData = opexData?.history ? {
    labels: opexData.history.map(h => h.month),
    datasets: [{
      label: 'OPEX % of Revenue',
      data: opexData.history.map(h => parseFloat(h.opexPercent)),
      borderColor: 'rgba(27, 94, 55, 1)',
      backgroundColor: 'rgba(27, 94, 55, 0.1)',
      fill: true,
      tension: 0.4
    }]
  } : null;

  if (loading) {
    return (
      <div className="analytics-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading OPEX & Tax analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-page opex-analytics">
      {/* Header */}
      <div className="analytics-header">
        <div className="header-left">
          <button className="btn-back" onClick={() => navigate('/analytics')}>
            ← Back
          </button>
          <div>
            <h1>OPEX & Tax Analytics</h1>
            <p className="subtitle">Operating expenses, efficiency ratios & tax compliance</p>
          </div>
        </div>
        <div className="header-right">
          <button onClick={loadOpexAnalytics} className="btn-refresh">
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <span className="summary-label">Total OPEX (Monthly)</span>
          <span className="summary-value">{formatCurrency(opexData?.currentMonth?.totalOpex || 0)}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">OPEX Ratio</span>
          <span className={`summary-value ${parseFloat(opexData?.currentMonth?.opexPercentage) <= 30 ? 'positive' : parseFloat(opexData?.currentMonth?.opexPercentage) <= 50 ? 'warning' : 'negative'}`}>
            {formatPercent(opexData?.currentMonth?.opexPercentage)}
          </span>
          <span className="summary-hint">of revenue</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Total Tax Obligations</span>
          <span className="summary-value">{formatCurrency(opexData?.taxes?.totalTaxLiability || 0)}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">VAT Payable</span>
          <span className="summary-value">{formatCurrency(opexData?.taxes?.vatPayable || 0)}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Statutory Contributions</span>
          <span className="summary-value">{formatCurrency(opexData?.statutory?.total || 0)}</span>
        </div>
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        <div className="chart-card">
          <h3>OPEX Breakdown</h3>
          {opexBreakdownData && (
            <Doughnut
              data={opexBreakdownData}
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
          <h3>Tax Obligations Breakdown</h3>
          {taxBreakdownData && (
            <Bar
              data={taxBreakdownData}
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
          <h3>Fixed Costs</h3>
          <div className="fixed-costs-list">
            {opexData?.fixedCosts && Object.entries(opexData.fixedCosts).map(([key, value]) => (
              <div key={key} className="fixed-cost-item">
                <span className="fixed-cost-label">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                <span className="fixed-cost-value">{formatCurrency(value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Additional Expense Type Charts */}
      <div className="charts-row" style={{ marginTop: '24px' }}>
        <div className="chart-card">
          <h3>Fixed vs Variable Expenses</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ flex: 1, height: '200px' }}>
              {fixedVsVariableData && (
                <Doughnut
                  data={fixedVsVariableData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: { color: '#666666', font: { size: 11 } }
                      }
                    }
                  }}
                />
              )}
            </div>
            <div style={{ minWidth: '140px' }}>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '0.75rem', color: '#888' }}>Fixed Costs</div>
                <div style={{ fontWeight: '600', color: 'var(--primary)' }}>
                  {formatCurrency(opexData?.currentMonth?.fixedCosts || 0)}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#666' }}>
                  {((opexData?.currentMonth?.fixedCosts || 0) / (opexData?.currentMonth?.totalOpex || 1) * 100).toFixed(1)}% of OPEX
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#888' }}>Variable Expenses</div>
                <div style={{ fontWeight: '600', color: '#D97706' }}>
                  {formatCurrency(opexData?.currentMonth?.variableExpenses || 0)}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#666' }}>
                  {((opexData?.currentMonth?.variableExpenses || 0) / (opexData?.currentMonth?.totalOpex || 1) * 100).toFixed(1)}% of OPEX
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="chart-card">
          <h3>OPEX vs CAPEX by Month</h3>
          {opexVsCapexData && (
            <Bar
              data={opexVsCapexData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                  legend: {
                    position: 'top',
                    labels: { color: '#666666', font: { size: 11 } }
                  }
                },
                scales: {
                  x: {
                    stacked: true,
                    ticks: { color: '#666666', font: { size: 10 } },
                    grid: { display: false }
                  },
                  y: {
                    stacked: true,
                    ticks: { color: '#666666', font: { size: 10 } },
                    grid: { color: 'rgba(224, 224, 224, 0.5)' }
                  }
                }
              }}
            />
          )}
        </div>
        <div className="chart-card">
          <h3>Expense Ratio Trend</h3>
          {expenseRatioTrendData && (
            <Line
              data={expenseRatioTrendData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                  legend: {
                    display: false
                  }
                },
                scales: {
                  x: {
                    ticks: { color: '#666666', font: { size: 10 } },
                    grid: { display: false }
                  },
                  y: {
                    min: 0,
                    max: 100,
                    ticks: {
                      color: '#666666',
                      font: { size: 10 },
                      callback: (value) => `${value}%`
                    },
                    grid: { color: 'rgba(224, 224, 224, 0.5)' }
                  }
                }
              }}
            />
          )}
          <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#888', textAlign: 'center' }}>
            Target: Below 30% for healthy operations
          </div>
        </div>
      </div>

      {/* Expense Details Table */}
      <div className="table-section">
        <h3>Operating Expense Details</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Monthly Amount</th>
                <th>% of Total OPEX</th>
                <th>% of Revenue</th>
              </tr>
            </thead>
            <tbody>
              {breakdownArray.map((item, index) => (
                <tr key={index}>
                  <td>{item.category}</td>
                  <td className="amount">{formatCurrency(item.amount)}</td>
                  <td>{formatPercent(item.percentOfOpex)}</td>
                  <td className={parseFloat(item.percentOfRevenue) <= 5 ? 'positive' : parseFloat(item.percentOfRevenue) <= 15 ? 'warning' : 'negative'}>
                    {formatPercent(item.percentOfRevenue)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td><strong>Total OPEX</strong></td>
                <td className="amount"><strong>{formatCurrency(opexData?.currentMonth?.totalOpex || 0)}</strong></td>
                <td><strong>100%</strong></td>
                <td><strong>{formatPercent(opexData?.currentMonth?.opexPercentage)}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Tax Compliance Section */}
      <div className="tax-section">
        <h3>Tax Compliance Summary</h3>
        <div className="tax-cards">
          <div className="tax-card">
            <div className="tax-header">
              <span className="tax-title">VAT Summary</span>
            </div>
            <div className="tax-details">
              <div className="tax-row">
                <span>VAT Payable</span>
                <span>{formatCurrency(opexData?.taxes?.vatPayable || 0)}</span>
              </div>
              <div className="tax-row">
                <span>Percentage Tax</span>
                <span>{formatCurrency(opexData?.taxes?.percentageTax || 0)}</span>
              </div>
              <div className="tax-row total">
                <span>Total Tax Liability</span>
                <span>{formatCurrency(opexData?.taxes?.totalTaxLiability || 0)}</span>
              </div>
            </div>
          </div>

          <div className="tax-card">
            <div className="tax-header">
              <span className="tax-title">Statutory Contributions</span>
            </div>
            <div className="tax-details">
              <div className="tax-row">
                <span>SSS (Employer Share)</span>
                <span>{formatCurrency(opexData?.statutory?.sss || 0)}</span>
              </div>
              <div className="tax-row">
                <span>PhilHealth (Employer Share)</span>
                <span>{formatCurrency(opexData?.statutory?.philHealth || 0)}</span>
              </div>
              <div className="tax-row">
                <span>Pag-IBIG (Employer Share)</span>
                <span>{formatCurrency(opexData?.statutory?.pagIbig || 0)}</span>
              </div>
              <div className="tax-row total">
                <span>Total Statutory</span>
                <span>{formatCurrency(opexData?.statutory?.total || 0)}</span>
              </div>
            </div>
          </div>

          <div className="tax-card">
            <div className="tax-header">
              <span className="tax-title">Withholding Taxes</span>
            </div>
            <div className="tax-details">
              <div className="tax-row">
                <span>Compensation Tax (Withheld)</span>
                <span>{formatCurrency(opexData?.taxes?.withholdingTax || 0)}</span>
              </div>
              <div className="tax-row info">
                <span className="info-text">Due for remittance by the 10th of the following month</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payroll Health Analysis */}
      {salaryHealth && (
        <div className="payroll-health-section" style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>💰</span> Payroll Health Analysis
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {/* Health Score Card */}
            <div className="summary-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: `conic-gradient(${salaryHealth.health.color} ${salaryHealth.health.score}%, #E5E7EB ${salaryHealth.health.score}%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column'
                  }}>
                    <span style={{ fontWeight: '700', fontSize: '1.4rem', color: salaryHealth.health.color }}>
                      {salaryHealth.health.score}
                    </span>
                    <span style={{ fontSize: '0.6rem', color: '#888' }}>/ 100</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '1.2rem', color: salaryHealth.health.color }}>
                    {salaryHealth.health.label}
                  </div>
                  <div style={{ color: '#666', fontSize: '0.9rem' }}>
                    Payroll: {salaryHealth.currentMonth.payrollPercentage}% of Revenue
                  </div>
                  <div style={{ fontSize: '0.8rem', marginTop: '4px', color: '#888' }}>
                    {salaryHealth.trend.direction === 'improving' && '↗️ Improving'}
                    {salaryHealth.trend.direction === 'declining' && '↘️ Needs Attention'}
                    {salaryHealth.trend.direction === 'stable' && '→ Stable'}
                    {' '}vs last month
                  </div>
                </div>
              </div>
            </div>

            {/* Payroll Metrics */}
            <div className="summary-card" style={{ padding: '20px' }}>
              <div style={{ fontWeight: '600', marginBottom: '12px' }}>Payroll Metrics</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#888' }}>Monthly Payroll</div>
                  <div style={{ fontWeight: '600', color: '#1B5E37' }}>
                    {formatCurrency(salaryHealth.currentMonth.totalPayroll)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#888' }}>Employees</div>
                  <div style={{ fontWeight: '600' }}>
                    {salaryHealth.currentMonth.employeeCount}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#888' }}>Avg per Employee</div>
                  <div style={{ fontWeight: '600' }}>
                    {formatCurrency(salaryHealth.currentMonth.avgSalaryPerEmployee)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#888' }}>Revenue/Employee</div>
                  <div style={{ fontWeight: '600', color: '#1B5E37' }}>
                    {formatCurrency(salaryHealth.currentMonth.revenuePerEmployee)}
                  </div>
                </div>
              </div>
            </div>

            {/* Industry Benchmark */}
            <div className="summary-card" style={{ padding: '20px' }}>
              <div style={{ fontWeight: '600', marginBottom: '12px' }}>Industry Benchmark</div>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#888', marginBottom: '6px' }}>
                  <span>0%</span>
                  <span style={{ color: '#10B981' }}>Healthy: {salaryHealth.benchmark.industry.min}-{salaryHealth.benchmark.industry.max}%</span>
                  <span>50%</span>
                </div>
                <div style={{ height: '12px', background: '#E5E7EB', borderRadius: '6px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute',
                    left: `${salaryHealth.benchmark.industry.min * 2}%`,
                    width: `${(salaryHealth.benchmark.industry.max - salaryHealth.benchmark.industry.min) * 2}%`,
                    height: '100%',
                    background: 'rgba(16, 185, 129, 0.3)',
                    borderRadius: '6px'
                  }}></div>
                  <div style={{
                    position: 'absolute',
                    left: `${Math.min(salaryHealth.currentMonth.payrollPercentage * 2, 98)}%`,
                    top: '-2px',
                    width: '16px',
                    height: '16px',
                    background: salaryHealth.health.color,
                    borderRadius: '50%',
                    border: '2px solid white',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    transform: 'translateX(-50%)'
                  }}></div>
                </div>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>
                {salaryHealth.benchmark.comparison === 'within' && '✅ Your payroll is within industry standards.'}
                {salaryHealth.benchmark.comparison === 'below' && '⚠️ Payroll is below industry average. Ensure fair compensation.'}
                {salaryHealth.benchmark.comparison === 'above' && '⚠️ Payroll exceeds industry standards. Review for optimization.'}
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {salaryHealth.recommendations?.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              {salaryHealth.recommendations.map((rec, i) => (
                <div key={i} style={{
                  padding: '12px 16px',
                  background: rec.type === 'warning' ? '#FEF3C7' : rec.type === 'success' ? '#D1FAE5' : '#EFF6FF',
                  borderRadius: '8px',
                  marginTop: '8px',
                  fontSize: '0.9rem',
                  color: rec.type === 'warning' ? '#92400E' : rec.type === 'success' ? '#065F46' : '#1E40AF',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  {rec.type === 'warning' && '⚠️'}
                  {rec.type === 'success' && '✅'}
                  {rec.type === 'info' && 'ℹ️'}
                  {rec.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Efficiency Insights */}
      <div className="insights-section compact">
        <h3>OPEX Efficiency Insights</h3>
        <div className="insight-cards">
          <div className="insight-card">
            <div className="insight-content">
              <strong>OPEX Ratio: {formatPercent(opexData?.currentMonth?.opexPercentage)}</strong>
              <p>
                {parseFloat(opexData?.currentMonth?.opexPercentage) <= 30
                  ? 'Excellent! Your operating expenses are well-controlled relative to revenue.'
                  : parseFloat(opexData?.currentMonth?.opexPercentage) <= 50
                  ? 'Moderate OPEX ratio. Look for opportunities to optimize major expense categories.'
                  : 'High OPEX ratio. Consider reviewing salaries, rent, or marketing spend for optimization.'}
              </p>
            </div>
          </div>
          <div className="insight-card">
            <div className="insight-content">
              <strong>Largest Expense: {breakdownArray[0]?.category || 'N/A'}</strong>
              <p>
                {breakdownArray[0]?.category || 'N/A'} accounts for {formatPercent(breakdownArray[0]?.percentOfOpex)} of total OPEX.
                {breakdownArray[0]?.category === 'Salaries'
                  ? ' This is typical for service businesses. Focus on productivity optimization.'
                  : ' Review if this allocation aligns with business priorities.'}
              </p>
            </div>
          </div>
          <div className="insight-card">
            <div className="insight-content">
              <strong>Tax Compliance</strong>
              <p>
                Total monthly tax obligations: {formatCurrency((opexData?.taxes?.totalTaxLiability || 0) + (opexData?.statutory?.total || 0))}.
                Ensure timely remittance to avoid penalties. SSS/PhilHealth/Pag-IBIG due by 10th-15th.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OpexTaxAnalytics;
