import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
// ChartJS is registered globally in main.jsx via utils/chartConfig
import { Bar } from 'react-chartjs-2';

const ProductAnalytics = () => {
  const navigate = useNavigate();
  const { showToast } = useApp();

  const [loading, setLoading] = useState(true);
  const [productData, setProductData] = useState(null);
  const [sortBy, setSortBy] = useState('revenue');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    loadProductAnalytics();
  }, []);

  const loadProductAnalytics = async () => {
    try {
      setLoading(true);
      const data = await mockApi.analytics.getProductAnalytics();
      setProductData(data);
      setLoading(false);
    } catch (error) {
      showToast('Failed to load product analytics', 'error');
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

  const getGPMClass = (gpm) => {
    const value = parseFloat(gpm);
    if (value >= 60) return 'gpm-excellent';
    if (value >= 40) return 'gpm-good';
    if (value >= 20) return 'gpm-fair';
    return 'gpm-poor';
  };

  const getSortedProducts = () => {
    if (!productData?.products) return [];

    let products = [...productData.products];

    // Filter by type
    if (filterType !== 'all') {
      products = products.filter(p => p.type === filterType);
    }

    // Sort
    switch (sortBy) {
      case 'revenue':
        return products.sort((a, b) => b.revenue - a.revenue);
      case 'gpm':
        return products.sort((a, b) => parseFloat(b.gpm) - parseFloat(a.gpm));
      case 'units':
        return products.sort((a, b) => b.unitsSold - a.unitsSold);
      case 'name':
        return products.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return products;
    }
  };

  // Chart data for top products by GPM
  const gpmChartData = productData ? {
    labels: productData.topByGPM.map(p => p.name.substring(0, 20)),
    datasets: [{
      label: 'Gross Profit Margin %',
      data: productData.topByGPM.map(p => parseFloat(p.gpm)),
      backgroundColor: productData.topByGPM.map(p => {
        const gpm = parseFloat(p.gpm);
        if (gpm >= 60) return 'rgba(16, 185, 129, 0.8)';
        if (gpm >= 40) return 'rgba(99, 102, 241, 0.8)';
        if (gpm >= 20) return 'rgba(245, 158, 11, 0.8)';
        return 'rgba(239, 68, 68, 0.8)';
      }),
      borderRadius: 4
    }]
  } : null;

  // Chart data for revenue by product
  const revenueChartData = productData ? {
    labels: productData.products.slice(0, 10).map(p => p.name.substring(0, 15)),
    datasets: [{
      label: 'Revenue',
      data: productData.products.slice(0, 10).map(p => p.revenue),
      backgroundColor: 'rgba(99, 102, 241, 0.8)',
      borderRadius: 4
    }]
  } : null;

  if (loading) {
    return (
      <div className="analytics-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading product analytics...</p>
        </div>
      </div>
    );
  }

  const sortedProducts = getSortedProducts();

  return (
    <div className="analytics-page product-analytics">
      {/* Header */}
      <div className="analytics-header">
        <div className="header-left">
          <button className="btn-back" onClick={() => navigate('/analytics')}>
            ← Back
          </button>
          <div>
            <h1>Product Analytics</h1>
            <p className="subtitle">GPM analysis, pricing optimization & bundling insights</p>
          </div>
        </div>
        <div className="header-right">
          <button onClick={loadProductAnalytics} className="btn-refresh">
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <span className="summary-label">Total Products</span>
          <span className="summary-value">{productData?.summary?.totalProducts}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Total Revenue</span>
          <span className="summary-value">{formatCurrency(productData?.summary?.totalRevenue)}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Average GPM</span>
          <span className={`summary-value ${getGPMClass(productData?.summary?.avgGPM)}`}>
            {productData?.summary?.avgGPM}%
          </span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Low Margin Items</span>
          <span className="summary-value warning">{productData?.summary?.lowMarginCount}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">High Performers</span>
          <span className="summary-value positive">{productData?.summary?.highPerformerCount}</span>
        </div>
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        <div className="chart-card">
          <h3>Top Products by GPM</h3>
          {gpmChartData && (
            <Bar
              data={gpmChartData}
              options={{
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false }
                },
                scales: {
                  x: {
                    ticks: { color: '#94a3b8' },
                    grid: { color: 'rgba(148, 163, 184, 0.1)' },
                    max: 100
                  },
                  y: {
                    ticks: { color: '#94a3b8' },
                    grid: { display: false }
                  }
                }
              }}
            />
          )}
        </div>
        <div className="chart-card">
          <h3>Revenue by Product (Top 10)</h3>
          {revenueChartData && (
            <Bar
              data={revenueChartData}
              options={{
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false }
                },
                scales: {
                  x: {
                    ticks: { color: '#94a3b8' },
                    grid: { color: 'rgba(148, 163, 184, 0.1)' }
                  },
                  y: {
                    ticks: { color: '#94a3b8' },
                    grid: { display: false }
                  }
                }
              }}
            />
          )}
        </div>
      </div>

      {/* Low Margin Alert */}
      {productData?.lowMarginProducts?.length > 0 && (
        <div className="alert-section">
          <h3>⚠️ Low Margin Products (Below 30% GPM)</h3>
          <div className="alert-table">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Current Price</th>
                  <th>Cost</th>
                  <th>GPM</th>
                  <th>Suggested Price</th>
                  <th>Potential GPM</th>
                </tr>
              </thead>
              <tbody>
                {productData.lowMarginProducts.map((product, index) => (
                  <tr key={index}>
                    <td>{product.name}</td>
                    <td>{formatCurrency(product.price)}</td>
                    <td>{formatCurrency(product.cost)}</td>
                    <td className="gpm-poor">{product.gpm}%</td>
                    <td className="suggested">{formatCurrency(product.suggestedPrice)}</td>
                    <td className="gpm-good">{product.potentialGPM}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cannibalization Analysis */}
      {productData?.cannibalization?.length > 0 && (
        <div className="analysis-section">
          <h3>🔄 Product Cannibalization</h3>
          <p className="section-desc">Products that may be cannibalizing sales from each other</p>
          <div className="cannibalization-cards">
            {productData.cannibalization.map((item, index) => (
              <div key={index} className="cannibalization-card">
                <div className="product-pair">
                  <span className="product-a">{item.productA}</span>
                  <span className="vs">vs</span>
                  <span className="product-b">{item.productB}</span>
                </div>
                <div className="impact">
                  <span className="impact-label">Revenue Impact:</span>
                  <span className="impact-value negative">-{formatCurrency(item.revenueImpact)}</span>
                </div>
                <div className="recommendation">{item.recommendation}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bundle Suggestions */}
      {productData?.bundleSuggestions?.length > 0 && (
        <div className="analysis-section">
          <h3>📦 Bundle Recommendations</h3>
          <p className="section-desc">Products frequently purchased together</p>
          <div className="bundle-cards">
            {productData.bundleSuggestions.map((bundle, index) => (
              <div key={index} className="bundle-card">
                <div className="bundle-products">
                  {bundle.products.join(' + ')}
                </div>
                <div className="bundle-stats">
                  <div className="stat">
                    <span className="stat-label">Correlation</span>
                    <span className="stat-value">{bundle.correlation}%</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Frequency</span>
                    <span className="stat-value">{bundle.frequency}x</span>
                  </div>
                </div>
                <div className="bundle-pricing">
                  <div className="price-row">
                    <span>Combined Price:</span>
                    <span>{formatCurrency(bundle.combinedPrice)}</span>
                  </div>
                  <div className="price-row suggested">
                    <span>Suggested Bundle:</span>
                    <span>{formatCurrency(bundle.suggestedBundlePrice)}</span>
                  </div>
                  <div className="price-row savings">
                    <span>Customer Saves:</span>
                    <span>{formatCurrency(bundle.savings)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Product Table */}
      <div className="table-section">
        <div className="table-header">
          <h3>All Products Performance</h3>
          <div className="table-controls">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="all">All Types</option>
              <option value="service">Services</option>
              <option value="product">Products</option>
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="revenue">Sort by Revenue</option>
              <option value="gpm">Sort by GPM</option>
              <option value="units">Sort by Units Sold</option>
              <option value="name">Sort by Name</option>
            </select>
          </div>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Product/Service</th>
                <th>Type</th>
                <th>Price</th>
                <th>Cost</th>
                <th>Units Sold</th>
                <th>Revenue</th>
                <th>GPM</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedProducts.map((product, index) => (
                <tr key={index}>
                  <td>{product.name}</td>
                  <td>
                    <span className={`type-badge ${product.type}`}>
                      {product.type}
                    </span>
                  </td>
                  <td>{formatCurrency(product.price)}</td>
                  <td>{formatCurrency(product.cost)}</td>
                  <td>{product.unitsSold}</td>
                  <td>{formatCurrency(product.revenue)}</td>
                  <td className={getGPMClass(product.gpm)}>{product.gpm}%</td>
                  <td>
                    {product.isHighPerformer && <span className="badge success">High Performer</span>}
                    {product.isLowMargin && <span className="badge warning">Low Margin</span>}
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

export default ProductAnalytics;
