import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi/mockApi';
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

  useEffect(() => {
    loadOpexAnalytics();
  }, []);

  const loadOpexAnalytics = async () => {
    try {
      setLoading(true);
      const data = await mockApi.analytics.getOpexAndTaxMetrics();
      setOpexData(data);
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
