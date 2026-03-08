import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
// ChartJS is registered globally in main.jsx via utils/chartConfig
import { Bar, Line } from 'react-chartjs-2';

const InventoryAnalytics = () => {
  const navigate = useNavigate();
  const { showToast, getUserBranchId } = useApp();

  const [loading, setLoading] = useState(true);
  const [inventoryData, setInventoryData] = useState(null);
  const [supplierData, setSupplierData] = useState(null);
  const [forecasts, setForecasts] = useState(null);

  useEffect(() => {
    loadInventoryAnalytics();
  }, []);

  const loadInventoryAnalytics = async () => {
    try {
      setLoading(true);
      const [inventory, suppliers, forecastData] = await Promise.all([
        mockApi.analytics.getInventoryMetrics(),
        mockApi.analytics.getSupplierMetrics(),
        mockApi.analytics.getForecasts()
      ]);
      // Filter inventory data by branch
      const userBranchId = getUserBranchId();
      if (userBranchId) {
        if (inventory?.products) {
          inventory.products = inventory.products.filter(item => !item.branchId || item.branchId === userBranchId);
        }
        if (inventory?.alerts?.slowMoving) {
          inventory.alerts.slowMoving = inventory.alerts.slowMoving.filter(item => !item.branchId || item.branchId === userBranchId);
        }
        if (inventory?.alerts?.criticalStock) {
          inventory.alerts.criticalStock = inventory.alerts.criticalStock.filter(item => !item.branchId || item.branchId === userBranchId);
        }
        if (suppliers?.suppliers) {
          suppliers.suppliers = suppliers.suppliers.filter(item => !item.branchId || item.branchId === userBranchId);
        }
      }

      setInventoryData(inventory);
      setSupplierData(suppliers);
      setForecasts(forecastData);
      setLoading(false);
    } catch (error) {
      showToast('Failed to load inventory analytics', 'error');
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

  const getTurnoverClass = (rate) => {
    if (rate >= 6) return 'turnover-excellent';
    if (rate >= 4) return 'turnover-good';
    if (rate >= 2) return 'turnover-fair';
    return 'turnover-slow';
  };

  const getStockoutClass = (days) => {
    if (days <= 7) return 'stockout-critical';
    if (days <= 14) return 'stockout-warning';
    if (days <= 30) return 'stockout-caution';
    return 'stockout-ok';
  };

  // Chart for turnover rates
  const turnoverChartData = inventoryData?.products ? {
    labels: inventoryData.products.slice(0, 10).map(p => (p.productName || 'Unknown').substring(0, 15)),
    datasets: [{
      label: 'Turnover Rate',
      data: inventoryData.products.slice(0, 10).map(p => parseFloat(p.turnoverRate) || 0),
      backgroundColor: inventoryData.products.slice(0, 10).map(p => {
        const rate = parseFloat(p.turnoverRate) || 0;
        if (rate >= 6) return 'rgba(27, 94, 55, 0.8)';
        if (rate >= 4) return 'rgba(27, 94, 55, 0.6)';
        if (rate >= 2) return 'rgba(217, 119, 6, 0.8)';
        return 'rgba(220, 38, 38, 0.8)';
      }),
      borderRadius: 4
    }]
  } : null;

  // Chart for inventory forecast
  const inventoryForecastChart = forecasts?.inventoryForecast ? {
    labels: forecasts.inventoryForecast.map(f => f.month),
    datasets: [{
      label: 'Forecasted Inventory Needs',
      data: forecasts.inventoryForecast.map(f => f.forecast),
      borderColor: '#1B5E37',
      backgroundColor: 'rgba(27, 94, 55, 0.1)',
      fill: true,
      tension: 0.4
    }]
  } : null;

  // Chart for supplier performance
  const supplierChartData = supplierData?.suppliers ? {
    labels: supplierData.suppliers.map(s => s.name),
    datasets: [
      {
        label: 'On-Time Delivery %',
        data: supplierData.suppliers.map(s => parseFloat(s.onTimeRate)),
        backgroundColor: 'rgba(27, 94, 55, 0.8)',
        borderRadius: 4
      },
      {
        label: 'Quality Score',
        data: supplierData.suppliers.map(s => (100 - parseFloat(s.defectRate))),
        backgroundColor: 'rgba(102, 102, 102, 0.6)',
        borderRadius: 4
      }
    ]
  } : null;

  if (loading) {
    return (
      <div className="analytics-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading inventory analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-page inventory-analytics">
      {/* Header */}
      <div className="analytics-header">
        <div className="header-left">
          <button className="btn-back" onClick={() => navigate('/analytics')}>
            ← Back
          </button>
          <div>
            <h1>Inventory Analytics</h1>
            <p className="subtitle">Turnover rates, stockout forecasts & supplier performance</p>
          </div>
        </div>
        <div className="header-right">
          <button onClick={loadInventoryAnalytics} className="btn-refresh">
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <span className="summary-label">Average Turnover Rate</span>
          <span className={`summary-value ${getTurnoverClass(parseFloat(inventoryData?.summary?.turnoverRate))}`}>
            {inventoryData?.summary?.turnoverRate || 0}x
          </span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Slow Moving Items</span>
          <span className="summary-value warning">{inventoryData?.alerts?.slowMoving?.length || 0}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">At-Risk Stock</span>
          <span className="summary-value negative">{inventoryData?.alerts?.criticalStock?.length || 0}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Total Inventory Value</span>
          <span className="summary-value">{formatCurrency(inventoryData?.summary?.currentInventoryValue || 0)}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Days of Stock</span>
          <span className="summary-value">{inventoryData?.summary?.daysToTurn || 0} days</span>
        </div>
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        <div className="chart-card">
          <h3>Turnover Rate by Product</h3>
          {turnoverChartData && (
            <Bar
              data={turnoverChartData}
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
          <h3>Inventory Needs Forecast</h3>
          {inventoryForecastChart && (
            <Line
              data={inventoryForecastChart}
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
                    grid: { color: 'rgba(224, 224, 224, 0.5)' }
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

      {/* Stockout Forecast */}
      <div className="stockout-section">
        <h3>Stockout Risk Forecast</h3>
        <p className="section-desc">Products at risk of running out of stock based on current sales velocity</p>
        <div className="stockout-grid">
          {inventoryData?.products
            ?.filter(p => p.daysUntilStockout < 30)
            .sort((a, b) => a.daysUntilStockout - b.daysUntilStockout)
            .map((product, index) => (
              <div key={index} className={`stockout-card ${getStockoutClass(product.daysUntilStockout)}`}>
                <div className="stockout-header">
                  <span className="product-name">{product.productName}</span>
                  <span className="days-badge">
                    {product.daysUntilStockout} days
                  </span>
                </div>
                <div className="stockout-details">
                  <div className="detail">
                    <span className="label">Current Stock:</span>
                    <span className="value">{product.currentStock} units</span>
                  </div>
                  <div className="detail">
                    <span className="label">Daily Velocity:</span>
                    <span className="value">{product.avgDailySales}/day</span>
                  </div>
                  <div className="detail">
                    <span className="label">Status:</span>
                    <span className="value">{product.status}</span>
                  </div>
                  {product.reorderSuggestion && (
                    <div className="detail">
                      <span className="label">Action:</span>
                      <span className="value highlight">{product.reorderSuggestion}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Supplier Performance */}
      <div className="supplier-section">
        <h3>Supplier Performance</h3>
        <div className="chart-card full-width">
          {supplierChartData && (
            <Bar
              data={supplierChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                  legend: {
                    position: 'top',
                    labels: { color: '#666666' }
                  }
                },
                scales: {
                  x: {
                    ticks: { color: '#666666' },
                    grid: { display: false }
                  },
                  y: {
                    ticks: { color: '#666666' },
                    grid: { color: 'rgba(224, 224, 224, 0.5)' },
                    max: 100
                  }
                }
              }}
            />
          )}
        </div>

        <div className="supplier-table">
          <table>
            <thead>
              <tr>
                <th>Supplier</th>
                <th>On-Time Rate</th>
                <th>Defect Rate</th>
                <th>Avg Lead Time</th>
                <th>Total Orders</th>
                <th>Total Spend</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {supplierData?.suppliers.map((supplier, index) => (
                <tr key={index}>
                  <td>{supplier.name}</td>
                  <td className={parseFloat(supplier.onTimeRate) >= 90 ? 'positive' : parseFloat(supplier.onTimeRate) >= 80 ? 'warning' : 'negative'}>
                    {supplier.onTimeRate}%
                  </td>
                  <td className={parseFloat(supplier.defectRate) <= 2 ? 'positive' : parseFloat(supplier.defectRate) <= 5 ? 'warning' : 'negative'}>
                    {supplier.defectRate}%
                  </td>
                  <td>{supplier.avgLeadTime} days</td>
                  <td>{supplier.totalOrders}</td>
                  <td>{formatCurrency(supplier.totalSpend)}</td>
                  <td>
                    <span className={`score-badge ${supplier.score >= 90 ? 'excellent' : supplier.score >= 80 ? 'good' : supplier.score >= 70 ? 'fair' : 'poor'}`}>
                      {supplier.score}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="table-section">
        <h3>All Inventory Items</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Current Stock</th>
                <th>Inventory Value</th>
                <th>Daily Velocity</th>
                <th>Turnover Rate</th>
                <th>Days Until Stockout</th>
                <th>Sold Last 30 Days</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {inventoryData?.products?.map((product, index) => (
                <tr key={index}>
                  <td>{product.productName}</td>
                  <td>{product.currentStock}</td>
                  <td>{formatCurrency(product.inventoryValue)}</td>
                  <td>{product.avgDailySales}/day</td>
                  <td className={getTurnoverClass(parseFloat(product.turnoverRate))}>{product.turnoverRate}x</td>
                  <td className={getStockoutClass(product.daysUntilStockout)}>
                    {product.daysUntilStockout === 999 ? 'N/A' : `${product.daysUntilStockout} days`}
                  </td>
                  <td>{product.soldLast30Days}</td>
                  <td>
                    {product.status === 'critical' && <span className="badge critical">Critical</span>}
                    {product.status === 'low' && <span className="badge warning">Low Stock</span>}
                    {parseFloat(product.turnoverRate) < 2 && <span className="badge info">Slow Moving</span>}
                    {product.status === 'healthy' && parseFloat(product.turnoverRate) >= 4 && <span className="badge success">Healthy</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InventoryAnalytics;
