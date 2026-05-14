import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi/mockApi';
import { format, subDays, differenceInDays, addDays } from 'date-fns';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

const AIInsights = () => {
  const { showToast, getEffectiveBranchId, selectedBranch } = useApp();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Data states
  const [transactions, setTransactions] = useState([]);
  const [products, setProducts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [advanceBookings, setAdvanceBookings] = useState([]);

  // Analysis states
  const [productUsageAnalysis, setProductUsageAnalysis] = useState([]);
  const [inventoryPredictions, setInventoryPredictions] = useState([]);
  const [revenuePredictions, setRevenuePredictions] = useState([]);
  const [customerInsights, setCustomerInsights] = useState(null);
  const [servicePerformance, setServicePerformance] = useState([]);
  const [employeePerformance, setEmployeePerformance] = useState([]);

  useEffect(() => {
    loadAllData();
  }, [selectedBranch?.id, selectedBranch?._allBranches]);

  const loadAllData = async () => {
    try {
      setLoading(true);

      const [rawTxns, rawProds, rawEmps, rawRms, rawCusts, rawBookings] = await Promise.all([
        mockApi.transactions.getTransactions(),
        mockApi.products.getProducts(),
        mockApi.employees.getEmployees(),
        mockApi.rooms.getRooms(),
        mockApi.customers.getCustomers(),
        mockApi.advanceBooking.listAdvanceBookings()
      ]);

      // Scope every collection to the selected branch before running any
      // analysis so charts, KPIs, and AI recommendations all reflect the
      // same dataset the user expects from the branch dropdown.
      // Lenient match: include branchless legacy records so a fresh branch
      // doesn't render every metric as 0 just because older POS rows were
      // written before branchId was attached.
      const effectiveBranchId = getEffectiveBranchId();
      const scope = (items) => effectiveBranchId
        ? items.filter(item => !item.branchId || item.branchId === effectiveBranchId)
        : items;

      const txns = scope(rawTxns);
      const prods = scope(rawProds);
      const emps = scope(rawEmps);
      const rms = scope(rawRms);
      const custs = scope(rawCusts);
      const bookings = scope(rawBookings);

      setTransactions(txns);
      setProducts(prods);
      setEmployees(emps);
      setRooms(rms);
      setCustomers(custs);
      setAdvanceBookings(bookings);

      // Run all analyses
      analyzeProductUsage(txns, prods);
      predictInventory(txns, prods);
      predictRevenue(txns);
      analyzeCustomers(custs, txns);
      analyzeServicePerformance(txns, prods);
      analyzeEmployeePerformance(txns, emps);

      setLoading(false);
    } catch (error) {
      showToast('Failed to load AI insights', 'error');
      setLoading(false);
    }
  };

  // Product Usage Analysis (like your image example)
  const analyzeProductUsage = (txns, prods) => {
    const usageData = [];

    // Get last 100 service transactions
    const serviceTxns = txns
      .filter(t => t.items?.some(item => item.type === 'service'))
      .slice(0, 100);

    // Analyze product consumption per service
    const productConsumption = {};

    serviceTxns.forEach(txn => {
      (txn.items || []).forEach(item => {
        if (item.type === 'service') {
          const serviceName = item.name;

          // Find related products used in this transaction
          txn.items
            .filter(i => i.type === 'product')
            .forEach(product => {
              const key = `${serviceName}:${product.name}`;
              if (!productConsumption[key]) {
                productConsumption[key] = {
                  serviceName,
                  productName: product.name,
                  totalQuantity: 0,
                  serviceCount: 0
                };
              }
              productConsumption[key].totalQuantity += product.quantity;
              productConsumption[key].serviceCount += item.quantity;
            });
        }
      });
    });

    // Calculate averages and create analysis
    Object.values(productConsumption).forEach(data => {
      const avgUsage = data.totalQuantity / data.serviceCount;
      const product = prods.find(p => p.name === data.productName);

      if (product && avgUsage > 0) {
        // Find unit (L, ml, pcs, etc.)
        let unit = 'units';
        let displayValue = avgUsage;

        if (product.name.toLowerCase().includes('oil') || product.name.toLowerCase().includes('lotion')) {
          unit = 'ml';
          displayValue = Math.round(avgUsage * 100); // Assume stored in liters
        } else if (product.name.toLowerCase().includes('towel')) {
          unit = 'pcs';
          displayValue = Math.round(avgUsage);
        }

        const currentStock = product.stock;
        const estimatedDaysLeft = Math.floor(currentStock / avgUsage);

        usageData.push({
          serviceName: data.serviceName,
          productName: data.productName,
          avgUsage: displayValue,
          unit,
          currentStock,
          estimatedDaysLeft,
          serviceCount: data.serviceCount,
          totalConsumed: data.totalQuantity,
          usageRate: avgUsage,
          alert: currentStock < avgUsage * 7 ? 'HIGH' : currentStock < avgUsage * 14 ? 'MEDIUM' : 'LOW'
        });
      }
    });

    setProductUsageAnalysis(usageData.slice(0, 10));
  };

  // Inventory Predictions
  const predictInventory = (txns, prods) => {
    const predictions = [];

    prods.filter(p => p.type === 'product').forEach(product => {
      // Calculate daily usage from last 30 days
      const last30Days = txns.filter(t => {
        const txnDate = new Date(t.date || t.createdAt);
        const daysAgo = differenceInDays(new Date(), txnDate);
        return daysAgo <= 30;
      });

      let totalUsed = 0;
      last30Days.forEach(txn => {
        txn.items?.forEach(item => {
          if (item.name === product.name && item.type === 'product') {
            totalUsed += item.quantity;
          }
        });
      });

      const dailyUsage = totalUsed / 30;
      const currentStock = product.stock;
      const daysUntilOut = dailyUsage > 0 ? Math.floor(currentStock / dailyUsage) : 999;
      const suggestedReorder = Math.ceil(dailyUsage * 30); // 30 days supply

      predictions.push({
        productName: product.name,
        currentStock,
        dailyUsage: dailyUsage.toFixed(2),
        daysUntilOut,
        runOutDate: addDays(new Date(), daysUntilOut),
        suggestedReorder,
        alert: daysUntilOut <= 7 ? 'HIGH' : daysUntilOut <= 14 ? 'MEDIUM' : 'LOW',
        usageTrend: totalUsed > 0 ? 'increasing' : 'stable'
      });
    });

    predictions.sort((a, b) => a.daysUntilOut - b.daysUntilOut);
    setInventoryPredictions(predictions.slice(0, 10));
  };

  // Revenue Predictions (7-day forecast)
  const predictRevenue = (txns) => {
    // Get last 30 days of revenue
    const last30Days = [];
    for (let i = 0; i < 30; i++) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayRevenue = txns
        .filter(t => {
          const txnDate = format(new Date(t.date || t.createdAt), 'yyyy-MM-dd');
          return txnDate === dateStr;
        })
        .reduce((sum, t) => sum + (t.totalAmount || t.total || 0), 0);

      last30Days.unshift({ date, revenue: dayRevenue });
    }

    // Simple moving average prediction
    const avgRevenue = last30Days.reduce((sum, d) => sum + d.revenue, 0) / 30;

    // Generate 7-day forecast
    const forecast = [];
    for (let i = 1; i <= 7; i++) {
      const forecastDate = addDays(new Date(), i);
      // Add some variance (±15%)
      const variance = (Math.random() - 0.5) * 0.3;
      const predictedRevenue = avgRevenue * (1 + variance);

      forecast.push({
        date: forecastDate,
        predicted: predictedRevenue,
        confidence: 85 - i * 2 // Confidence decreases over time
      });
    }

    setRevenuePredictions({
      historical: last30Days,
      forecast,
      avgDaily: avgRevenue,
      projected7Day: forecast.reduce((sum, f) => sum + f.predicted, 0)
    });
  };

  // Customer Insights
  const analyzeCustomers = (custs, txns) => {
    // Transactions can carry the customer link in either shape (current POS
    // writes a nested `customer.id` object; older / sync-pulled rows expose a
    // flat `customerId`). Match against both so the metrics aren't silently
    // 0 when a row uses the other shape.
    const txnCustomerId = (t) => t.customer?.id || t.customerId;

    const totalCustomers = custs.length;
    const activeCustomers = custs.filter(c => {
      const lastVisit = txns.find(t => txnCustomerId(t) === c._id);
      if (!lastVisit) return false;
      const daysSince = differenceInDays(new Date(), new Date(lastVisit.date || lastVisit.createdAt));
      return daysSince <= 30;
    }).length;

    const avgLifetimeValue = custs.reduce((sum, c) => {
      const customerTxns = txns.filter(t => txnCustomerId(t) === c._id);
      const totalSpent = customerTxns.reduce((s, t) => s + (t.totalAmount || t.total || 0), 0);
      return sum + totalSpent;
    }, 0) / (totalCustomers || 1);

    const retentionRate = (activeCustomers / (totalCustomers || 1)) * 100;

    // Top 3 customers — only those with actual spend, so the chart doesn't
    // render names with ₱0 bars when no transactions match.
    const topCustomers = custs.map(c => {
      const customerTxns = txns.filter(t => txnCustomerId(t) === c._id);
      const totalSpent = customerTxns.reduce((s, t) => s + (t.totalAmount || t.total || 0), 0);
      return {
        name: c.name,
        visits: customerTxns.length,
        totalSpent
      };
    })
      .filter(c => c.totalSpent > 0)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 3);

    setCustomerInsights({
      totalCustomers,
      activeCustomers,
      retentionRate,
      avgLifetimeValue,
      topCustomers
    });
  };

  // Service Performance Analysis
  const analyzeServicePerformance = (txns, prods) => {
    const serviceStats = {};

    txns.forEach(txn => {
      txn.items?.forEach(item => {
        if (item.type === 'service') {
          if (!serviceStats[item.name]) {
            serviceStats[item.name] = {
              name: item.name,
              bookings: 0,
              revenue: 0,
              ratings: []
            };
          }
          serviceStats[item.name].bookings += item.quantity;
          serviceStats[item.name].revenue += item.subtotal || (item.price * item.quantity);
          // Simulate rating
          serviceStats[item.name].ratings.push(4.5 + Math.random() * 0.5);
        }
      });
    });

    const performance = Object.values(serviceStats).map(s => ({
      ...s,
      avgRating: s.ratings.reduce((sum, r) => sum + r, 0) / (s.ratings.length || 1),
      performance: s.revenue > 10000 ? 'Excellent' : s.revenue > 5000 ? 'Good' : 'Average'
    }));

    performance.sort((a, b) => b.revenue - a.revenue);
    setServicePerformance(performance.slice(0, 5));
  };

  // Employee Performance Analysis
  const analyzeEmployeePerformance = (txns, emps) => {
    const empStats = {};

    emps.forEach(emp => {
      empStats[emp._id] = {
        id: emp._id,
        name: `${emp.firstName} ${emp.lastName}`,
        position: emp.position,
        services: 0,
        revenue: 0,
        commission: 0
      };
    });

    txns.forEach(txn => {
      if (txn.employee?.id && empStats[txn.employee.id]) {
        empStats[txn.employee.id].services += txn.items?.length || 0;
        empStats[txn.employee.id].revenue += txn.totalAmount || txn.total || 0;
        empStats[txn.employee.id].commission += txn.employee.commission || 0;
      }
    });

    const performance = Object.values(empStats)
      .filter(e => e.services > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    setEmployeePerformance(performance);
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>Analyzing data with AI...</p>
      </div>
    );
  }

  return (
    <div className="ai-insights-page">
      <div className="page-header">
        <div>
          <h1>🤖 AI-Powered Business Insights</h1>
          <p>Advanced analytics, predictions, and recommendations powered by artificial intelligence</p>
        </div>
        <button className="btn btn-primary" onClick={loadAllData}>
          🔄 Refresh Analysis
        </button>
      </div>

      {/* Tabs */}
      <div className="ai-tabs">
        <button
          className={`ai-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Overview
        </button>
        <button
          className={`ai-tab ${activeTab === 'product-usage' ? 'active' : ''}`}
          onClick={() => setActiveTab('product-usage')}
        >
          🧴 Product Usage
        </button>
        <button
          className={`ai-tab ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          📦 Inventory Predictions
        </button>
        <button
          className={`ai-tab ${activeTab === 'revenue' ? 'active' : ''}`}
          onClick={() => setActiveTab('revenue')}
        >
          💰 Revenue Forecast
        </button>
        <button
          className={`ai-tab ${activeTab === 'customers' ? 'active' : ''}`}
          onClick={() => setActiveTab('customers')}
        >
          👥 Customer Insights
        </button>
        <button
          className={`ai-tab ${activeTab === 'performance' ? 'active' : ''}`}
          onClick={() => setActiveTab('performance')}
        >
          ⭐ Performance
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="ai-tab-content">
          <div className="ai-summary-grid">
            <div className="ai-summary-card">
              <div className="ai-summary-icon">🔮</div>
              <div className="ai-summary-value">{inventoryPredictions.filter(p => p.alert === 'HIGH').length}</div>
              <div className="ai-summary-label">Critical Stock Items</div>
              <div className="ai-summary-trend critical">Requires immediate attention</div>
            </div>
            <div className="ai-summary-card">
              <div className="ai-summary-icon">📈</div>
              <div className="ai-summary-value">
                ₱{revenuePredictions.projected7Day?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="ai-summary-label">7-Day Revenue Forecast</div>
              <div className="ai-summary-trend success">
                +{((revenuePredictions.projected7Day / (revenuePredictions.avgDaily * 7) - 1) * 100).toFixed(1)}% vs avg
              </div>
            </div>
            <div className="ai-summary-card">
              <div className="ai-summary-icon">💎</div>
              <div className="ai-summary-value">
                ₱{customerInsights?.avgLifetimeValue?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="ai-summary-label">Avg Customer Value</div>
              <div className="ai-summary-trend info">{customerInsights?.totalCustomers} total customers</div>
            </div>
            <div className="ai-summary-card">
              <div className="ai-summary-icon">🎯</div>
              <div className="ai-summary-value">{customerInsights?.retentionRate?.toFixed(0)}%</div>
              <div className="ai-summary-label">Customer Retention</div>
              <div className="ai-summary-trend success">{customerInsights?.activeCustomers} active customers</div>
            </div>
          </div>

          {/* Quick Insights Charts */}
          <div className="overview-charts-grid">
            {/* Revenue Forecast Mini Chart */}
            <div className="overview-chart-card">
              <h3>📈 7-Day Revenue Forecast</h3>
              <div className="chart-container-ai" style={{ height: '250px', marginTop: 'var(--spacing-md)' }}>
                {revenuePredictions.forecast && revenuePredictions.forecast.length > 0 && (
                  <Line
                    data={{
                      labels: revenuePredictions.forecast.map(f => format(f.date, 'MMM dd')),
                      datasets: [{
                        label: 'Predicted Revenue',
                        data: revenuePredictions.forecast.map(f => f.predicted),
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointBackgroundColor: '#8b5cf6',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          callbacks: {
                            label: function(context) {
                              const forecast = revenuePredictions.forecast[context.dataIndex];
                              return [
                                `Predicted: ₱${context.parsed.y.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                                `Confidence: ${forecast.confidence}%`
                              ];
                            }
                          }
                        }
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: {
                            callback: value => '₱' + (value / 1000).toFixed(0) + 'k'
                          }
                        }
                      }
                    }}
                  />
                )}
              </div>
            </div>

            {/* Top Services Performance */}
            <div className="overview-chart-card">
              <h3>⭐ Top Services by Revenue</h3>
              <div className="chart-container-ai" style={{ height: '250px', marginTop: 'var(--spacing-md)' }}>
                {servicePerformance.length > 0 && (
                  <Bar
                    data={{
                      labels: servicePerformance.slice(0, 5).map(s => s.name),
                      datasets: [{
                        label: 'Revenue',
                        data: servicePerformance.slice(0, 5).map(s => s.revenue),
                        backgroundColor: [
                          'rgba(139, 92, 246, 0.8)',
                          'rgba(99, 102, 241, 0.8)',
                          'rgba(59, 130, 246, 0.8)',
                          'rgba(14, 165, 233, 0.8)',
                          'rgba(6, 182, 212, 0.8)'
                        ],
                        borderColor: [
                          '#8b5cf6',
                          '#6366f1',
                          '#3b82f6',
                          '#0ea5e9',
                          '#06b6d4'
                        ],
                        borderWidth: 2
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      indexAxis: 'y',
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          callbacks: {
                            label: function(context) {
                              const service = servicePerformance[context.dataIndex];
                              return [
                                `Revenue: ₱${context.parsed.x.toLocaleString()}`,
                                `Bookings: ${service.bookings}`,
                                `Rating: ${service.avgRating.toFixed(1)}⭐`
                              ];
                            }
                          }
                        }
                      },
                      scales: {
                        x: {
                          beginAtZero: true,
                          ticks: {
                            callback: value => '₱' + (value / 1000).toFixed(0) + 'k'
                          }
                        }
                      }
                    }}
                  />
                )}
              </div>
            </div>

            {/* Stock Alert Distribution */}
            <div className="overview-chart-card">
              <h3>📦 Inventory Alert Status</h3>
              <div className="chart-container-ai" style={{ height: '250px', marginTop: 'var(--spacing-md)' }}>
                {inventoryPredictions.length > 0 && (
                  <Doughnut
                    data={{
                      labels: ['Critical', 'Warning', 'Healthy'],
                      datasets: [{
                        data: [
                          inventoryPredictions.filter(p => p.alert === 'HIGH').length,
                          inventoryPredictions.filter(p => p.alert === 'MEDIUM').length,
                          inventoryPredictions.filter(p => p.alert === 'LOW').length
                        ],
                        backgroundColor: [
                          'rgba(239, 68, 68, 0.8)',
                          'rgba(245, 158, 11, 0.8)',
                          'rgba(16, 185, 129, 0.8)'
                        ],
                        borderColor: [
                          '#ef4444',
                          '#f59e0b',
                          '#10b981'
                        ],
                        borderWidth: 2
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'bottom'
                        },
                        tooltip: {
                          callbacks: {
                            label: function(context) {
                              const total = inventoryPredictions.length;
                              const value = context.parsed;
                              const percentage = ((value / total) * 100).toFixed(1);
                              return `${context.label}: ${value} items (${percentage}%)`;
                            }
                          }
                        }
                      }
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="ai-section" style={{ marginTop: 'var(--spacing-xl)' }}>
            <h3>🚨 Immediate Actions Needed</h3>
            <div className="ai-alerts-list">
              {inventoryPredictions.filter(p => p.alert === 'HIGH').slice(0, 3).map((pred, idx) => (
                <div key={idx} className="ai-alert-card critical">
                  <div className="ai-alert-icon">⚠️</div>
                  <div className="ai-alert-content">
                    <h4>{pred.productName}</h4>
                    <p>Critical stock level - only {pred.daysUntilOut} days remaining at current usage rate</p>
                    <div className="ai-alert-stats">
                      <span>Current: {pred.currentStock} units</span>
                      <span>Daily usage: ~{pred.dailyUsage} units</span>
                      <span>Run out: {format(pred.runOutDate, 'MMM dd, yyyy')}</span>
                    </div>
                    <div className="ai-alert-action">
                      <strong>💡 Suggested Action:</strong> Order {pred.suggestedReorder} units immediately
                    </div>
                  </div>
                </div>
              ))}
              {inventoryPredictions.filter(p => p.alert === 'HIGH').length === 0 && (
                <div className="ai-alert-card success">
                  <div className="ai-alert-icon">✅</div>
                  <div className="ai-alert-content">
                    <h4>All Clear!</h4>
                    <p>No critical inventory issues detected. All stock levels are healthy.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Key Recommendations */}
          <div className="ai-section" style={{ marginTop: 'var(--spacing-xl)' }}>
            <h3>💡 AI-Powered Recommendations</h3>
            <div className="recommendations-grid">
              <div className="recommendation-card">
                <div className="recommendation-icon">🎯</div>
                <h4>Optimize Service Pricing</h4>
                <p>
                  {servicePerformance.length > 0 && servicePerformance[0].revenue > 20000
                    ? `${servicePerformance[0].name} is performing exceptionally well. Consider increasing price by 10-15% to maximize revenue.`
                    : 'Analyze service performance to identify pricing opportunities.'}
                </p>
              </div>
              <div className="recommendation-card">
                <div className="recommendation-icon">👥</div>
                <h4>Customer Retention Strategy</h4>
                <p>
                  {customerInsights?.retentionRate < 60
                    ? 'Retention rate is below target. Implement loyalty programs or follow-up campaigns to re-engage inactive customers.'
                    : 'Great retention rate! Continue current customer engagement strategies and consider referral programs.'}
                </p>
              </div>
              <div className="recommendation-card">
                <div className="recommendation-icon">📦</div>
                <h4>Inventory Optimization</h4>
                <p>
                  {inventoryPredictions.filter(p => p.alert === 'HIGH').length > 3
                    ? 'Multiple items need restocking. Consider bulk orders to reduce costs and establish automatic reorder points.'
                    : 'Inventory levels are well-managed. Review slow-moving items to optimize storage costs.'}
                </p>
              </div>
              <div className="recommendation-card">
                <div className="recommendation-icon">💰</div>
                <h4>Revenue Growth Opportunity</h4>
                <p>
                  Projected 7-day revenue is ₱{revenuePredictions.projected7Day?.toLocaleString(undefined, { maximumFractionDigits: 0 })}.
                  Focus on upselling and service bundles to increase average transaction value.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Usage Tab */}
      {activeTab === 'product-usage' && (
        <div className="ai-tab-content">
          {/* Summary Cards */}
          <div className="product-usage-summary">
            <div className="usage-summary-card critical">
              <div className="usage-summary-icon">⚠️</div>
              <div className="usage-summary-content">
                <div className="usage-summary-value">{productUsageAnalysis.filter(p => p.alert === 'HIGH').length}</div>
                <div className="usage-summary-label">Critical Items</div>
                <div className="usage-summary-desc">Need immediate restocking</div>
              </div>
            </div>
            <div className="usage-summary-card warning">
              <div className="usage-summary-icon">⚡</div>
              <div className="usage-summary-content">
                <div className="usage-summary-value">{productUsageAnalysis.filter(p => p.alert === 'MEDIUM').length}</div>
                <div className="usage-summary-label">Running Low</div>
                <div className="usage-summary-desc">Order within 2 weeks</div>
              </div>
            </div>
            <div className="usage-summary-card healthy">
              <div className="usage-summary-icon">✓</div>
              <div className="usage-summary-content">
                <div className="usage-summary-value">{productUsageAnalysis.filter(p => p.alert === 'LOW').length}</div>
                <div className="usage-summary-label">Well Stocked</div>
                <div className="usage-summary-desc">Adequate supply levels</div>
              </div>
            </div>
            <div className="usage-summary-card info">
              <div className="usage-summary-icon">📊</div>
              <div className="usage-summary-content">
                <div className="usage-summary-value">{productUsageAnalysis.reduce((sum, p) => sum + p.serviceCount, 0)}</div>
                <div className="usage-summary-label">Services Analyzed</div>
                <div className="usage-summary-desc">Data points collected</div>
              </div>
            </div>
          </div>

          <div className="ai-section">
            <h3>🧴 Detailed Product Usage Analysis</h3>
            <p className="ai-section-subtitle">
              Consumption patterns based on actual service history
            </p>

            <div className="usage-analysis-grid">
              {productUsageAnalysis.map((usage, idx) => (
                <div key={idx} className={`usage-card-enhanced ${usage.alert.toLowerCase()}-border`}>
                  <div className="usage-card-header">
                    <div className="usage-product-info">
                      <div className="usage-product-icon">
                        {usage.alert === 'HIGH' ? '⚠️' : usage.alert === 'MEDIUM' ? '⚡' : '✓'}
                      </div>
                      <div>
                        <h4 className="usage-product-name">{usage.productName}</h4>
                        <p className="usage-service-type">{usage.serviceName}</p>
                      </div>
                    </div>
                    <span className={`usage-alert-badge-enhanced ${usage.alert.toLowerCase()}`}>
                      {usage.alert}
                    </span>
                  </div>

                  <div className="usage-metrics-grid">
                    <div className="usage-metric-card">
                      <div className="usage-metric-icon">📏</div>
                      <div className="usage-metric-content">
                        <div className="usage-metric-label">Avg Usage</div>
                        <div className="usage-metric-value">
                          {usage.avgUsage} <span className="usage-metric-unit">{usage.unit}/service</span>
                        </div>
                      </div>
                    </div>
                    <div className="usage-metric-card">
                      <div className="usage-metric-icon">📦</div>
                      <div className="usage-metric-content">
                        <div className="usage-metric-label">Current Stock</div>
                        <div className="usage-metric-value">
                          {usage.currentStock} <span className="usage-metric-unit">{usage.unit}</span>
                        </div>
                      </div>
                    </div>
                    <div className="usage-metric-card">
                      <div className="usage-metric-icon">⏱️</div>
                      <div className="usage-metric-content">
                        <div className="usage-metric-label">Supply Duration</div>
                        <div className={`usage-metric-value ${usage.alert === 'HIGH' ? 'critical-text' : ''}`}>
                          {usage.estimatedDaysLeft} <span className="usage-metric-unit">days</span>
                        </div>
                      </div>
                    </div>
                    <div className="usage-metric-card">
                      <div className="usage-metric-icon">🔢</div>
                      <div className="usage-metric-content">
                        <div className="usage-metric-label">Data Points</div>
                        <div className="usage-metric-value">
                          {usage.serviceCount} <span className="usage-metric-unit">services</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Usage Progress Bar */}
                  <div className="usage-progress-section">
                    <div className="usage-progress-header">
                      <span className="usage-progress-label">Stock Depletion Timeline</span>
                      <span className="usage-progress-percentage">
                        {Math.min(100, ((usage.serviceCount / (usage.estimatedDaysLeft + 1)) * 10)).toFixed(0)}% burn rate
                      </span>
                    </div>
                    <div className="usage-progress-bar">
                      <div
                        className={`usage-progress-fill ${usage.alert.toLowerCase()}`}
                        style={{
                          width: `${Math.min(100, 100 - (usage.estimatedDaysLeft / 30 * 100))}%`
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className={`usage-recommendation-enhanced ${usage.alert.toLowerCase()}-bg`}>
                    <div className="usage-rec-icon">💡</div>
                    <div className="usage-rec-content">
                      <strong>AI Recommendation:</strong>
                      {usage.alert === 'HIGH' && (
                        <span> Critical! Order {Math.ceil(usage.avgUsage * 30)} {usage.unit} immediately to avoid service disruption.</span>
                      )}
                      {usage.alert === 'MEDIUM' && (
                        <span> Plan to restock within 2 weeks. Recommended order: {Math.ceil(usage.avgUsage * 30)} {usage.unit}.</span>
                      )}
                      {usage.alert === 'LOW' && (
                        <span> Stock levels healthy. Next order recommended in {Math.floor(usage.estimatedDaysLeft / 2)} days.</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Product Usage Chart */}
            {productUsageAnalysis.length > 0 && (
              <div className="ai-section" style={{ marginTop: 'var(--spacing-xl)' }}>
                <h3>📊 Product Consumption Overview</h3>
                <div className="chart-container-ai" style={{ height: '350px', marginTop: 'var(--spacing-lg)' }}>
                  <Bar
                    data={{
                      labels: productUsageAnalysis.map(p => p.productName),
                      datasets: [
                        {
                          label: 'Average Usage per Service',
                          data: productUsageAnalysis.map(p => p.avgUsage),
                          backgroundColor: productUsageAnalysis.map(p =>
                            p.alert === 'HIGH' ? 'rgba(239, 68, 68, 0.8)' :
                            p.alert === 'MEDIUM' ? 'rgba(245, 158, 11, 0.8)' :
                            'rgba(16, 185, 129, 0.8)'
                          ),
                          borderColor: productUsageAnalysis.map(p =>
                            p.alert === 'HIGH' ? '#ef4444' :
                            p.alert === 'MEDIUM' ? '#f59e0b' :
                            '#10b981'
                          ),
                          borderWidth: 2
                        },
                        {
                          label: 'Current Stock',
                          data: productUsageAnalysis.map(p => p.currentStock),
                          backgroundColor: 'rgba(139, 92, 246, 0.5)',
                          borderColor: '#8b5cf6',
                          borderWidth: 2
                        }
                      ]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: true,
                          position: 'top'
                        },
                        tooltip: {
                          callbacks: {
                            label: function(context) {
                              const usage = productUsageAnalysis[context.dataIndex];
                              if (context.datasetIndex === 0) {
                                return `Avg Usage: ${context.parsed.y} ${usage.unit} per service`;
                              } else {
                                return `Current Stock: ${context.parsed.y} ${usage.unit}`;
                              }
                            }
                          }
                        }
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          title: {
                            display: true,
                            text: 'Quantity (units/ml)'
                          }
                        },
                        x: {
                          ticks: {
                            maxRotation: 45,
                            minRotation: 45
                          }
                        }
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inventory Predictions Tab */}
      {activeTab === 'inventory' && (
        <div className="ai-tab-content">
          {/* Inventory Summary Cards */}
          <div className="inventory-summary-grid">
            <div className="inventory-summary-card critical-gradient">
              <div className="inv-summary-header">
                <div className="inv-summary-icon critical">⚠️</div>
                <span className="inv-summary-badge critical">URGENT</span>
              </div>
              <div className="inv-summary-value">{inventoryPredictions.filter(p => p.alert === 'HIGH').length}</div>
              <div className="inv-summary-label">Critical Stock Items</div>
              <div className="inv-summary-detail">Need immediate reorder</div>
            </div>

            <div className="inventory-summary-card warning-gradient">
              <div className="inv-summary-header">
                <div className="inv-summary-icon warning">⏰</div>
                <span className="inv-summary-badge warning">WATCH</span>
              </div>
              <div className="inv-summary-value">{inventoryPredictions.filter(p => p.alert === 'MEDIUM').length}</div>
              <div className="inv-summary-label">Running Low</div>
              <div className="inv-summary-detail">Order within 2 weeks</div>
            </div>

            <div className="inventory-summary-card success-gradient">
              <div className="inv-summary-header">
                <div className="inv-summary-icon success">✓</div>
                <span className="inv-summary-badge success">GOOD</span>
              </div>
              <div className="inv-summary-value">{inventoryPredictions.filter(p => p.alert === 'LOW').length}</div>
              <div className="inv-summary-label">Well Stocked</div>
              <div className="inv-summary-detail">Healthy inventory levels</div>
            </div>

            <div className="inventory-summary-card info-gradient">
              <div className="inv-summary-header">
                <div className="inv-summary-icon info">📊</div>
                <span className="inv-summary-badge info">TOTAL</span>
              </div>
              <div className="inv-summary-value">{inventoryPredictions.length}</div>
              <div className="inv-summary-label">Total Products</div>
              <div className="inv-summary-detail">Tracked in inventory</div>
            </div>
          </div>

          <div className="ai-section">
            <h3>📦 Stock Forecast Analysis</h3>
            <p className="ai-section-subtitle">AI-powered predictions based on historical usage patterns</p>

            <div className="inventory-predictions-grid">
              {inventoryPredictions.map((pred, idx) => (
                <div key={idx} className={`inventory-prediction-card ${pred.alert.toLowerCase()}-alert-border`}>
                  <div className="inv-pred-header">
                    <div className="inv-pred-title-section">
                      <div className={`inv-pred-icon ${pred.alert.toLowerCase()}`}>
                        {pred.alert === 'HIGH' ? '⚠️' : pred.alert === 'MEDIUM' ? '⏰' : '✓'}
                      </div>
                      <div>
                        <h4 className="inv-pred-product-name">{pred.productName}</h4>
                        <p className="inv-pred-subtitle">Stock Forecast</p>
                      </div>
                    </div>
                    <span className={`inv-pred-alert-badge ${pred.alert.toLowerCase()}`}>
                      {pred.alert}
                    </span>
                  </div>

                  <div className="inv-pred-metrics">
                    <div className="inv-pred-metric">
                      <div className="inv-metric-label">Current Stock</div>
                      <div className="inv-metric-value">{pred.currentStock} <span className="inv-metric-unit">units</span></div>
                    </div>
                    <div className="inv-pred-metric">
                      <div className="inv-metric-label">Daily Usage</div>
                      <div className="inv-metric-value">~{pred.dailyUsage} <span className="inv-metric-unit">units/day</span></div>
                    </div>
                    <div className="inv-pred-metric highlight">
                      <div className="inv-metric-label">Days Until Out</div>
                      <div className={`inv-metric-value ${pred.alert === 'HIGH' ? 'critical' : ''}`}>
                        {pred.daysUntilOut} <span className="inv-metric-unit">days</span>
                      </div>
                    </div>
                  </div>

                  <div className="inv-pred-timeline">
                    <div className="inv-timeline-header">
                      <span className="inv-timeline-label">Depletion Progress</span>
                      <span className="inv-timeline-date">{format(pred.runOutDate, 'MMM dd, yyyy')}</span>
                    </div>
                    <div className="inv-timeline-bar">
                      <div
                        className={`inv-timeline-fill ${pred.alert.toLowerCase()}`}
                        style={{ width: `${Math.min(100, (1 - (pred.daysUntilOut / 60)) * 100)}%` }}
                      >
                        <span className="inv-timeline-tooltip">{pred.daysUntilOut} days left</span>
                      </div>
                    </div>
                  </div>

                  <div className={`inv-pred-action ${pred.alert.toLowerCase()}-action`}>
                    <div className="inv-action-icon">📦</div>
                    <div className="inv-action-content">
                      <div className="inv-action-label">Suggested Reorder Quantity</div>
                      <div className="inv-action-value">{pred.suggestedReorder} units</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Inventory Depletion Timeline Chart */}
            {inventoryPredictions.length > 0 && (
              <div className="ai-section" style={{ marginTop: 'var(--spacing-xl)' }}>
                <h3>📉 Stock Depletion Timeline</h3>
                <p className="ai-section-subtitle">Days remaining until out of stock</p>
                <div className="chart-container-ai" style={{ height: '350px', marginTop: 'var(--spacing-lg)' }}>
                  <Bar
                    data={{
                      labels: inventoryPredictions.slice(0, 10).map(p => p.productName),
                      datasets: [{
                        label: 'Days Until Out of Stock',
                        data: inventoryPredictions.slice(0, 10).map(p => p.daysUntilOut),
                        backgroundColor: inventoryPredictions.slice(0, 10).map(p =>
                          p.alert === 'HIGH' ? 'rgba(239, 68, 68, 0.8)' :
                          p.alert === 'MEDIUM' ? 'rgba(245, 158, 11, 0.8)' :
                          'rgba(16, 185, 129, 0.8)'
                        ),
                        borderColor: inventoryPredictions.slice(0, 10).map(p =>
                          p.alert === 'HIGH' ? '#ef4444' :
                          p.alert === 'MEDIUM' ? '#f59e0b' :
                          '#10b981'
                        ),
                        borderWidth: 2
                      }]
                    }}
                    options={{
                      indexAxis: 'y',
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          callbacks: {
                            label: function(context) {
                              const pred = inventoryPredictions[context.dataIndex];
                              return [
                                `Days until out: ${context.parsed.x} days`,
                                `Run out date: ${format(pred.runOutDate, 'MMM dd, yyyy')}`,
                                `Current stock: ${pred.currentStock} units`,
                                `Daily usage: ~${pred.dailyUsage} units/day`
                              ];
                            }
                          }
                        }
                      },
                      scales: {
                        x: {
                          beginAtZero: true,
                          title: {
                            display: true,
                            text: 'Days Remaining'
                          },
                          grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                          }
                        },
                        y: {
                          ticks: {
                            autoSkip: false
                          }
                        }
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Revenue Forecast Tab */}
      {activeTab === 'revenue' && revenuePredictions.forecast && (
        <div className="ai-tab-content">
          {/* Revenue Summary Cards */}
          <div className="revenue-summary-grid">
            <div className="revenue-summary-card total-gradient">
              <div className="rev-summary-header">
                <div className="rev-summary-icon total">💰</div>
                <span className="rev-summary-badge total">7-DAY</span>
              </div>
              <div className="rev-summary-value">
                ₱{revenuePredictions.projected7Day?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="rev-summary-label">Projected Revenue</div>
              <div className="rev-summary-detail">Next 7 days forecast</div>
            </div>

            <div className="revenue-summary-card avg-gradient">
              <div className="rev-summary-header">
                <div className="rev-summary-icon avg">📊</div>
                <span className="rev-summary-badge avg">DAILY</span>
              </div>
              <div className="rev-summary-value">
                ₱{revenuePredictions.avgDaily?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="rev-summary-label">Average Daily</div>
              <div className="rev-summary-detail">Historical average</div>
            </div>

            <div className="revenue-summary-card confidence-gradient">
              <div className="rev-summary-header">
                <div className="rev-summary-icon confidence">🎯</div>
                <span className="rev-summary-badge confidence">ACCURACY</span>
              </div>
              <div className="rev-summary-value">
                {revenuePredictions.forecast && revenuePredictions.forecast.length > 0
                  ? Math.round(revenuePredictions.forecast.reduce((sum, f) => sum + f.confidence, 0) / revenuePredictions.forecast.length)
                  : 0}%
              </div>
              <div className="rev-summary-label">Avg Confidence</div>
              <div className="rev-summary-detail">Prediction accuracy</div>
            </div>

            <div className="revenue-summary-card growth-gradient">
              <div className="rev-summary-header">
                <div className="rev-summary-icon growth">📈</div>
                <span className="rev-summary-badge growth">TREND</span>
              </div>
              <div className="rev-summary-value">
                {revenuePredictions.projected7Day && revenuePredictions.avgDaily
                  ? ((revenuePredictions.projected7Day / (revenuePredictions.avgDaily * 7) - 1) * 100).toFixed(1)
                  : 0}%
              </div>
              <div className="rev-summary-label">vs Average</div>
              <div className="rev-summary-detail">Growth projection</div>
            </div>
          </div>

          <div className="ai-section">
            <h3>📈 7-Day Revenue Forecast</h3>
            <p className="ai-section-subtitle">
              AI-powered predictions based on historical trends and booking patterns
            </p>

            {/* Enhanced Chart */}
            <div className="revenue-chart-enhanced">
              <Line
                data={{
                  labels: revenuePredictions.forecast.map(f => format(f.date, 'EEE, MMM dd')),
                  datasets: [
                    {
                      label: 'Predicted Revenue',
                      data: revenuePredictions.forecast.map(f => f.predicted),
                      borderColor: '#10b981',
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      tension: 0.4,
                      fill: true,
                      pointRadius: 6,
                      pointBackgroundColor: '#10b981',
                      pointBorderColor: '#fff',
                      pointBorderWidth: 2,
                      pointHoverRadius: 8
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: true,
                      position: 'top'
                    },
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          const forecast = revenuePredictions.forecast[context.dataIndex];
                          return [
                            `Revenue: ₱${context.parsed.y.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                            `Confidence: ${forecast.confidence}%`
                          ];
                        }
                      }
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: value => '₱' + (value / 1000).toFixed(0) + 'k'
                      },
                      grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                      }
                    },
                    x: {
                      grid: {
                        display: false
                      }
                    }
                  }
                }}
              />
            </div>

            {/* Forecast Cards Grid */}
            <div className="forecast-cards-grid">
              {revenuePredictions.forecast.map((f, idx) => (
                <div key={idx} className="forecast-day-card">
                  <div className="forecast-card-header">
                    <div className="forecast-day-icon">
                      {idx === 0 ? '📅' : idx === 1 ? '📆' : '🗓️'}
                    </div>
                    <div className="forecast-day-info">
                      <div className="forecast-day-name">{format(f.date, 'EEEE')}</div>
                      <div className="forecast-day-date">{format(f.date, 'MMM dd, yyyy')}</div>
                    </div>
                  </div>

                  <div className="forecast-card-body">
                    <div className="forecast-revenue-section">
                      <div className="forecast-revenue-label">Predicted Revenue</div>
                      <div className="forecast-revenue-value">
                        ₱{f.predicted.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                    </div>

                    <div className="forecast-confidence-section">
                      <div className="forecast-confidence-header">
                        <span className="forecast-confidence-label">Confidence Level</span>
                        <span className="forecast-confidence-percentage">{f.confidence}%</span>
                      </div>
                      <div className="forecast-confidence-bar">
                        <div
                          className="forecast-confidence-fill"
                          style={{ width: `${f.confidence}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="forecast-variance-section">
                      <div className="forecast-variance-item">
                        <span className="forecast-variance-label">vs Daily Avg</span>
                        <span className={`forecast-variance-value ${f.predicted > revenuePredictions.avgDaily ? 'positive' : 'negative'}`}>
                          {f.predicted > revenuePredictions.avgDaily ? '+' : ''}
                          {((f.predicted / revenuePredictions.avgDaily - 1) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Customer Insights Tab */}
      {activeTab === 'customers' && customerInsights && (
        <div className="ai-tab-content">
          <div className="ai-section">
            <h3>👥 Customer Insights</h3>

            <div className="customer-insights-grid">
              <div className="insight-card">
                <h4>Customer Base</h4>
                <div className="insight-value">{customerInsights.totalCustomers}</div>
                <div className="insight-label">Total Customers</div>
              </div>
              <div className="insight-card">
                <h4>Active Customers</h4>
                <div className="insight-value">{customerInsights.activeCustomers}</div>
                <div className="insight-label">Visited in Last 30 Days</div>
              </div>
              <div className="insight-card">
                <h4>Retention Rate</h4>
                <div className="insight-value">{customerInsights.retentionRate.toFixed(0)}%</div>
                <div className="insight-label">Based on repeat visits within 30 days</div>
              </div>
            </div>

            {/* Customer Retention Donut Chart */}
            <div className="ai-section" style={{ marginTop: 'var(--spacing-xl)' }}>
              <h3>📊 Customer Activity Distribution</h3>
              <div className="customer-charts-grid">
                <div className="chart-container-ai" style={{ height: '300px' }}>
                  <Doughnut
                    data={{
                      labels: ['Active Customers', 'Inactive Customers'],
                      datasets: [{
                        data: [
                          customerInsights.activeCustomers,
                          customerInsights.totalCustomers - customerInsights.activeCustomers
                        ],
                        backgroundColor: [
                          'rgba(16, 185, 129, 0.8)',
                          'rgba(156, 163, 175, 0.5)'
                        ],
                        borderColor: [
                          '#10b981',
                          '#9ca3af'
                        ],
                        borderWidth: 2
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'bottom'
                        },
                        tooltip: {
                          callbacks: {
                            label: function(context) {
                              const total = customerInsights.totalCustomers;
                              const value = context.parsed;
                              const percentage = ((value / total) * 100).toFixed(1);
                              return `${context.label}: ${value} (${percentage}%)`;
                            }
                          }
                        }
                      }
                    }}
                  />
                </div>

                <div className="retention-stats">
                  <div className="stat-card success">
                    <div className="stat-icon">✓</div>
                    <div className="stat-value">{customerInsights.retentionRate.toFixed(0)}%</div>
                    <div className="stat-label">Retention Rate</div>
                  </div>
                  <div className="stat-card primary">
                    <div className="stat-icon">💎</div>
                    <div className="stat-value">
                      ₱{customerInsights.avgLifetimeValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <div className="stat-label">Avg Lifetime Value</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Customers Bar Chart */}
            <div className="ai-section" style={{ marginTop: 'var(--spacing-xl)' }}>
              <h3>🏆 Top Customers by Spending</h3>
              <div className="chart-container-ai" style={{ height: '300px', marginTop: 'var(--spacing-lg)' }}>
                <Bar
                  data={{
                    labels: customerInsights.topCustomers.map(c => c.name),
                    datasets: [{
                      label: 'Total Spending',
                      data: customerInsights.topCustomers.map(c => c.totalSpent),
                      backgroundColor: 'rgba(139, 92, 246, 0.8)',
                      borderColor: '#8b5cf6',
                      borderWidth: 2
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: function(context) {
                            const customer = customerInsights.topCustomers?.[context.dataIndex];
                            if (!customer) return [];
                            return [
                              `Total Spent: ₱${context.parsed.y.toLocaleString()}`,
                              `Visits: ${customer.visits || 0}`,
                              `Avg per visit: ₱${(customer.totalSpent / (customer.visits || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                            ];
                          }
                        }
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          callback: value => '₱' + value.toLocaleString()
                        }
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Performance Tab */}
      {activeTab === 'performance' && (
        <div className="ai-tab-content">
          <div className="ai-section">
            <h3>⭐ Service Performance Analysis</h3>
            <table className="performance-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Revenue</th>
                  <th>Bookings</th>
                  <th>Avg. Rating</th>
                  <th>Performance</th>
                </tr>
              </thead>
              <tbody>
                {servicePerformance.map((service, idx) => (
                  <tr key={idx}>
                    <td><strong>{service.name}</strong></td>
                    <td>₱{service.revenue.toLocaleString()}</td>
                    <td>{service.bookings}</td>
                    <td>
                      <span className="rating-badge">⭐ {service.avgRating.toFixed(1)}</span>
                    </td>
                    <td>
                      <span className={`performance-badge ${service.performance.toLowerCase()}`}>
                        {service.performance}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ai-section">
            <h3>👨‍💼 Employee Performance</h3>
            <table className="performance-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Position</th>
                  <th>Services</th>
                  <th>Revenue</th>
                  <th>Commission</th>
                </tr>
              </thead>
              <tbody>
                {employeePerformance.map((emp, idx) => (
                  <tr key={idx}>
                    <td><strong>{emp.name}</strong></td>
                    <td>{emp.position}</td>
                    <td>{emp.services}</td>
                    <td>₱{emp.revenue.toLocaleString()}</td>
                    <td>₱{emp.commission.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIInsights;
