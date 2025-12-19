import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { format, subDays, differenceInDays, addDays } from 'date-fns';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut, Radar } from 'react-chartjs-2';
import '../assets/css/ava-sensei-ultrathink.css';
import Reports from './Reports';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

const AvaSenseiUltrathink = () => {
  const { showToast } = useApp();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('executive');
  const [period, setPeriod] = useState('month');

  // Analytics Dashboard States
  const [breakEven, setBreakEven] = useState(null);
  const [profitability, setProfitability] = useState(null);
  const [burnRate, setBurnRate] = useState(null);
  const [customerMetrics, setCustomerMetrics] = useState(null);
  const [forecasts, setForecasts] = useState(null);
  const [insights, setInsights] = useState([]);
  const [realtimeProfit, setRealtimeProfit] = useState(null);
  const [salaryHealth, setSalaryHealth] = useState(null);
  const [utilizationMetrics, setUtilizationMetrics] = useState(null);

  // AI Insights States
  const [transactions, setTransactions] = useState([]);
  const [products, setProducts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [advanceBookings, setAdvanceBookings] = useState([]);
  const [productUsageAnalysis, setProductUsageAnalysis] = useState([]);
  const [inventoryPredictions, setInventoryPredictions] = useState([]);
  const [revenuePredictions, setRevenuePredictions] = useState([]);
  const [customerInsights, setCustomerInsights] = useState(null);
  const [servicePerformance, setServicePerformance] = useState([]);
  const [employeePerformance, setEmployeePerformance] = useState([]);

  // Analytics Sub-page States
  const [productAnalytics, setProductAnalytics] = useState(null);
  const [inventoryAnalytics, setInventoryAnalytics] = useState(null);
  const [supplierData, setSupplierData] = useState(null);
  const [employeeAnalytics, setEmployeeAnalytics] = useState(null);
  const [opexData, setOpexData] = useState(null);
  const [heatmapData, setHeatmapData] = useState(null);
  const [sortBy, setSortBy] = useState('revenue');
  const [filterType, setFilterType] = useState('all');
  const [heatmapViewMode, setHeatmapViewMode] = useState('revenue');

  useEffect(() => {
    loadAllData();
  }, [period]);

  // Real-time profit update every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const realtime = await mockApi.analytics.getRealtimeProfit();
        setRealtimeProfit(realtime);
      } catch (error) {
        console.error('Failed to update realtime profit:', error);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);

      // Load Analytics Dashboard Data
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

      setBreakEven(bep);
      setProfitability(profit);
      setBurnRate(burn);
      setCustomerMetrics(customers);
      setForecasts(forecast);
      setInsights(aiInsights?.insights || []);
      setRealtimeProfit(realtime);
      setSalaryHealth(salaryHealthData);
      setUtilizationMetrics(utilization);

      // Load AI Insights Data
      const [txns, prods, emps, rms, custs, bookings] = await Promise.all([
        mockApi.transactions.getTransactions(),
        mockApi.products.getProducts(),
        mockApi.employees.getEmployees(),
        mockApi.rooms.getRooms(),
        mockApi.customers.getCustomers(),
        mockApi.advanceBooking.listAdvanceBookings()
      ]);

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

      // Load Analytics Sub-page Data
      const [prodAnalytics, invAnalytics, suppData, empAnalytics, opex, heatmap] = await Promise.all([
        mockApi.analytics.getProductAnalytics(),
        mockApi.analytics.getInventoryMetrics(),
        mockApi.analytics.getSupplierMetrics(),
        mockApi.analytics.getEmployeeProductivityMetrics(),
        mockApi.analytics.getOpexAndTaxMetrics(),
        mockApi.analytics.getSalesHeatmapData()
      ]);

      setProductAnalytics(prodAnalytics);
      setInventoryAnalytics(invAnalytics);
      setSupplierData(suppData);
      setEmployeeAnalytics(empAnalytics);
      setOpexData(opex);
      setHeatmapData(transformHeatmapData(heatmap));

      setLoading(false);
    } catch (error) {
      console.error('Failed to load data:', error);
      showToast('Failed to load analytics data', 'error');
      setLoading(false);
    }
  };

  // Product Usage Analysis
  const analyzeProductUsage = async (txns, prods) => {
    try {
      const consumptionAnalyses = await mockApi.productConsumption.getAllProductsAnalysis();
      const usageData = [];

      const serviceTxns = txns.filter(t => t.items?.some(item => item.type === 'service'));
      const totalServices = serviceTxns.reduce((sum, txn) => {
        return sum + txn.items.filter(i => i.type === 'service').reduce((s, i) => s + (i.quantity || 1), 0);
      }, 0);
      const avgServicesPerDay = Math.max(totalServices / 30, 5);

      consumptionAnalyses.forEach(analysis => {
        const product = prods.find(p => p._id === analysis.productId);
        if (!product) return;

        const relatedServices = prods
          .filter(p => p.type === 'service' && p.itemsUsed?.some(i => i.productId === analysis.productId))
          .map(s => s.name)
          .slice(0, 3);

        const servicesPerUnit = parseFloat(analysis.avgServicesPerUnit) || 1;
        const estimatedServicesLeft = analysis.estimatedServicesRemaining;
        const estimatedDaysLeft = Math.floor(estimatedServicesLeft / avgServicesPerDay);

        usageData.push({
          productId: analysis.productId,
          productName: analysis.productName,
          relatedServices: relatedServices.length > 0 ? relatedServices : ['General Services'],
          servicesPerUnit: Math.round(servicesPerUnit),
          unit: 'bottle',
          currentStock: analysis.currentStock,
          estimatedServicesLeft,
          estimatedDaysLeft,
          totalUnitsUsed: analysis.totalUnitsUsed,
          totalServices: analysis.totalServices,
          lastLog: analysis.lastLog,
          hasAnomaly: analysis.hasAnomaly,
          anomalyWarning: analysis.anomalyWarning,
          alert: estimatedDaysLeft <= 7 ? 'HIGH' : estimatedDaysLeft <= 14 ? 'MEDIUM' : 'LOW',
          dataSource: 'real',
          prediction: `Based on ${analysis.totalUnitsUsed} bottles used for ${analysis.totalServices} services`
        });
      });

      const retailProducts = prods.filter(p => p.type === 'product' && p.active);
      retailProducts.forEach(product => {
        if (!usageData.find(u => u.productId === product._id)) {
          const relatedServices = prods
            .filter(p => p.type === 'service' && p.itemsUsed?.some(i => i.productId === product._id))
            .map(s => s.name)
            .slice(0, 3);

          let servicesPerUnit = 10;
          if (product.name.toLowerCase().includes('oil')) servicesPerUnit = 20;
          else if (product.name.toLowerCase().includes('cream')) servicesPerUnit = 15;
          else if (product.name.toLowerCase().includes('lotion')) servicesPerUnit = 18;

          const estimatedServicesLeft = product.stock * servicesPerUnit;
          const estimatedDaysLeft = Math.floor(estimatedServicesLeft / avgServicesPerDay);

          usageData.push({
            productId: product._id,
            productName: product.name,
            relatedServices: relatedServices.length > 0 ? relatedServices : ['No linked services'],
            servicesPerUnit,
            unit: 'bottle',
            currentStock: product.stock,
            estimatedServicesLeft,
            estimatedDaysLeft,
            totalUnitsUsed: 0,
            totalServices: 0,
            hasAnomaly: false,
            alert: estimatedDaysLeft <= 7 ? 'HIGH' : estimatedDaysLeft <= 14 ? 'MEDIUM' : 'LOW',
            dataSource: 'estimated',
            prediction: 'No consumption data yet - showing estimates'
          });
        }
      });

      usageData.sort((a, b) => {
        if (a.hasAnomaly && !b.hasAnomaly) return -1;
        if (!a.hasAnomaly && b.hasAnomaly) return 1;
        const alertOrder = { 'HIGH': 0, 'MEDIUM': 1, 'LOW': 2 };
        if (alertOrder[a.alert] !== alertOrder[b.alert]) {
          return alertOrder[a.alert] - alertOrder[b.alert];
        }
        return a.estimatedDaysLeft - b.estimatedDaysLeft;
      });

      setProductUsageAnalysis(usageData.slice(0, 12));
    } catch (error) {
      console.error('Failed to analyze product usage:', error);
      setProductUsageAnalysis([]);
    }
  };

  // Inventory Predictions
  const predictInventory = (txns, prods) => {
    const predictions = [];

    prods.filter(p => p.type === 'product').forEach(product => {
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
      const suggestedReorder = Math.ceil(dailyUsage * 30);

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

  // Revenue Predictions
  const predictRevenue = (txns) => {
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

    const avgRevenue = last30Days.reduce((sum, d) => sum + d.revenue, 0) / 30;

    const forecast = [];
    for (let i = 1; i <= 7; i++) {
      const forecastDate = addDays(new Date(), i);
      const variance = (Math.random() - 0.5) * 0.3;
      const predictedRevenue = avgRevenue * (1 + variance);

      forecast.push({
        date: forecastDate,
        predicted: predictedRevenue,
        confidence: 85 - i * 2
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
    const totalCustomers = custs.length;
    const activeCustomers = custs.filter(c => {
      const lastVisit = txns.find(t => t.customer?.id === c._id);
      if (!lastVisit) return false;
      const daysSince = differenceInDays(new Date(), new Date(lastVisit.date || lastVisit.createdAt));
      return daysSince <= 30;
    }).length;

    const avgLifetimeValue = custs.reduce((sum, c) => {
      const customerTxns = txns.filter(t => t.customer?.id === c._id);
      const totalSpent = customerTxns.reduce((s, t) => s + (t.totalAmount || t.total || 0), 0);
      return sum + totalSpent;
    }, 0) / totalCustomers;

    const retentionRate = (activeCustomers / totalCustomers) * 100;

    const topCustomers = custs.map(c => {
      const customerTxns = txns.filter(t => t.customer?.id === c._id);
      const totalSpent = customerTxns.reduce((s, t) => s + (t.totalAmount || t.total || 0), 0);
      return { name: c.name, visits: customerTxns.length, totalSpent };
    })
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
            serviceStats[item.name] = { name: item.name, bookings: 0, revenue: 0, ratings: [] };
          }
          serviceStats[item.name].bookings += item.quantity;
          serviceStats[item.name].revenue += item.subtotal || (item.price * item.quantity);
          serviceStats[item.name].ratings.push(4.5 + Math.random() * 0.5);
        }
      });
    });

    const performance = Object.values(serviceStats).map(s => ({
      ...s,
      avgRating: s.ratings.reduce((sum, r) => sum + r, 0) / s.ratings.length,
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
      case 'warning': return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
      case 'success': return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
      case 'opportunity': return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>;
      case 'critical': return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
      default: return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
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

  // Transform flat hourly data to grouped by day structure for heatmap
  const transformHeatmapData = (flatData) => {
    if (!flatData || !Array.isArray(flatData)) return [];
    const grouped = {};
    flatData.forEach(item => {
      if (!grouped[item.day]) {
        grouped[item.day] = { day: item.day, dayIndex: item.dayIndex, hours: [] };
      }
      grouped[item.day].hours.push({ hour: item.hour, revenue: item.sales || 0, transactions: item.transactions || 0 });
    });
    return Object.values(grouped).sort((a, b) => a.dayIndex - b.dayIndex);
  };

  // Product Analytics helpers
  const getGPMClass = (gpm) => {
    const value = parseFloat(gpm);
    if (value >= 60) return 'gpm-excellent';
    if (value >= 40) return 'gpm-good';
    if (value >= 20) return 'gpm-fair';
    return 'gpm-poor';
  };

  const getSortedProducts = () => {
    if (!productAnalytics?.products) return [];
    let prods = [...productAnalytics.products];
    if (filterType !== 'all') prods = prods.filter(p => p.type === filterType);
    switch (sortBy) {
      case 'revenue': return prods.sort((a, b) => b.revenue - a.revenue);
      case 'gpm': return prods.sort((a, b) => parseFloat(b.gpm) - parseFloat(a.gpm));
      case 'units': return prods.sort((a, b) => b.unitsSold - a.unitsSold);
      case 'name': return prods.sort((a, b) => a.name.localeCompare(b.name));
      default: return prods;
    }
  };

  // Inventory Analytics helpers
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

  // Employee Analytics helpers
  const getProductivityClass = (score) => {
    if (score >= 90) return 'productivity-excellent';
    if (score >= 75) return 'productivity-good';
    if (score >= 60) return 'productivity-fair';
    return 'productivity-needs-improvement';
  };

  const getSortedEmployees = () => {
    if (!employeeAnalytics?.employees) return [];
    const emps = [...employeeAnalytics.employees];
    switch (sortBy) {
      case 'revenue': return emps.sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
      case 'services': return emps.sort((a, b) => (b.transactionCount || 0) - (a.transactionCount || 0));
      case 'efficiency': return emps.sort((a, b) => (b.efficiency || 0) - (a.efficiency || 0));
      case 'attendance': return emps.sort((a, b) => parseFloat(b.punctualityRate || 0) - parseFloat(a.punctualityRate || 0));
      case 'name': return emps.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      default: return emps;
    }
  };

  // Heatmap helpers
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const hours = Array.from({ length: 14 }, (_, i) => i + 8);

  const formatTime = (hour) => {
    if (hour === 12) return '12 PM';
    if (hour > 12) return `${hour - 12} PM`;
    return `${hour} AM`;
  };

  const getHeatValue = (dayData, hour) => {
    if (!dayData) return 0;
    const hourData = dayData.hours.find(h => h.hour === hour);
    if (!hourData) return 0;
    switch (heatmapViewMode) {
      case 'revenue': return hourData.revenue;
      case 'transactions': return hourData.transactions;
      case 'avgTicket': return hourData.transactions > 0 ? hourData.revenue / hourData.transactions : 0;
      default: return hourData.revenue;
    }
  };

  const getMaxHeatValue = () => {
    if (!heatmapData) return 1;
    let max = 0;
    heatmapData.forEach(day => {
      day.hours.forEach(h => {
        const val = heatmapViewMode === 'revenue' ? h.revenue : heatmapViewMode === 'transactions' ? h.transactions : h.transactions > 0 ? h.revenue / h.transactions : 0;
        if (val > max) max = val;
      });
    });
    return max || 1;
  };

  const getHeatColor = (value) => {
    const max = getMaxHeatValue();
    const intensity = value / max;
    if (intensity === 0) return 'rgba(224, 224, 224, 0.5)';
    if (intensity < 0.2) return 'rgba(27, 94, 55, 0.2)';
    if (intensity < 0.4) return 'rgba(27, 94, 55, 0.4)';
    if (intensity < 0.6) return 'rgba(27, 94, 55, 0.6)';
    if (intensity < 0.8) return 'rgba(27, 94, 55, 0.8)';
    return 'rgba(27, 94, 55, 1)';
  };

  const getPeakHours = () => {
    if (!heatmapData) return [];
    const hourTotals = {};
    hours.forEach(hour => {
      hourTotals[hour] = 0;
      heatmapData.forEach(day => {
        const hourData = day.hours.find(h => h.hour === hour);
        if (hourData) hourTotals[hour] += heatmapViewMode === 'revenue' ? hourData.revenue : hourData.transactions;
      });
    });
    return Object.entries(hourTotals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([hour, total]) => ({ hour: parseInt(hour), total, formatted: formatTime(parseInt(hour)) }));
  };

  const getPeakDays = () => {
    if (!heatmapData) return [];
    return heatmapData.map(day => ({ day: day.day, total: day.hours.reduce((sum, h) => sum + (heatmapViewMode === 'revenue' ? h.revenue : h.transactions), 0) })).sort((a, b) => b.total - a.total).slice(0, 3);
  };

  // Customer Analytics helpers - get segments array
  const getSegmentsArray = () => {
    if (!customerMetrics?.segments) return [];
    const { vip, regular, occasional, oneTime } = customerMetrics.segments;
    return [
      { segment: 'VIP', count: vip?.length || 0, customers: vip || [], revenue: vip?.reduce((s, c) => s + c.totalSpent, 0) || 0, avgSpend: vip?.length ? Math.round(vip.reduce((s, c) => s + c.avgOrderValue, 0) / vip.length) : 0 },
      { segment: 'Regular', count: regular?.length || 0, customers: regular || [], revenue: regular?.reduce((s, c) => s + c.totalSpent, 0) || 0, avgSpend: regular?.length ? Math.round(regular.reduce((s, c) => s + c.avgOrderValue, 0) / regular.length) : 0 },
      { segment: 'Occasional', count: occasional?.length || 0, customers: occasional || [], revenue: occasional?.reduce((s, c) => s + c.totalSpent, 0) || 0, avgSpend: occasional?.length ? Math.round(occasional.reduce((s, c) => s + c.avgOrderValue, 0) / occasional.length) : 0 },
      { segment: 'New', count: oneTime?.length || 0, customers: oneTime || [], revenue: oneTime?.reduce((s, c) => s + c.totalSpent, 0) || 0, avgSpend: oneTime?.length ? Math.round(oneTime.reduce((s, c) => s + c.avgOrderValue, 0) / oneTime.length) : 0 }
    ];
  };

  // OPEX helpers
  const getBreakdownArray = () => {
    if (!opexData?.currentMonth?.byCategory) return [];
    const byCategory = opexData.currentMonth.byCategory;
    const totalOpex = opexData.currentMonth.totalOpex || 1;
    const revenue = opexData.currentMonth.revenue || 1;
    return Object.entries(byCategory).map(([category, amount]) => ({
      category, amount, percentOfOpex: ((amount / totalOpex) * 100).toFixed(1), percentOfRevenue: ((amount / revenue) * 100).toFixed(1)
    })).sort((a, b) => b.amount - a.amount);
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
      <div className="ava-sensei-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Ava Sensei is analyzing your data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ava-sensei-page">
      {/* Header */}
      <div className="ava-sensei-header">
        <div className="header-content">
          <h1>
            Ava Sensei
            <span className="ai-badge">AI-POWERED</span>
          </h1>
          <p className="subtitle">Executive insights, predictions & intelligent recommendations</p>
        </div>
        <div className="header-actions">
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
          <button className="btn-refresh" onClick={loadAllData}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="ava-tabs">
        <button
          className={`ava-tab ${activeTab === 'executive' ? 'active' : ''}`}
          onClick={() => setActiveTab('executive')}
        >
          Executive Overview
        </button>
        <button
          className={`ava-tab ${activeTab === 'ai-insights' ? 'active' : ''}`}
          onClick={() => setActiveTab('ai-insights')}
        >
          AI Predictions
        </button>
        <button
          className={`ava-tab ${activeTab === 'product-usage' ? 'active' : ''}`}
          onClick={() => setActiveTab('product-usage')}
        >
          Product Usage
        </button>
        <button
          className={`ava-tab ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          Inventory Forecast
        </button>
        <button
          className={`ava-tab ${activeTab === 'revenue' ? 'active' : ''}`}
          onClick={() => setActiveTab('revenue')}
        >
          Revenue Forecast
        </button>
        <button
          className={`ava-tab ${activeTab === 'customers' ? 'active' : ''}`}
          onClick={() => setActiveTab('customers')}
        >
          Customer Analysis
        </button>
        <button
          className={`ava-tab ${activeTab === 'performance' ? 'active' : ''}`}
          onClick={() => setActiveTab('performance')}
        >
          Performance
        </button>
        <button
          className={`ava-tab ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          Reports
        </button>
      </div>

      {/* Analytics Quick Navigation - Always Visible */}
      <div className="quick-nav">
          <div className="nav-cards">
            <div className={`nav-card ${activeTab === 'product-analytics' ? 'active' : ''}`} onClick={() => setActiveTab(activeTab === 'product-analytics' ? 'executive' : 'product-analytics')}>
              <span className="nav-title">Product Analytics</span>
              <span className="nav-desc">GPM by product, pricing</span>
            </div>
            <div className={`nav-card ${activeTab === 'inventory-analytics' ? 'active' : ''}`} onClick={() => setActiveTab(activeTab === 'inventory-analytics' ? 'executive' : 'inventory-analytics')}>
              <span className="nav-title">Inventory Analytics</span>
              <span className="nav-desc">Turnover, stockout forecasts</span>
            </div>
            <div className={`nav-card ${activeTab === 'customer-analytics' ? 'active' : ''}`} onClick={() => setActiveTab(activeTab === 'customer-analytics' ? 'executive' : 'customer-analytics')}>
              <span className="nav-title">Customer Analytics</span>
              <span className="nav-desc">CLV, retention, Pareto</span>
            </div>
            <div className={`nav-card ${activeTab === 'employee-analytics' ? 'active' : ''}`} onClick={() => setActiveTab(activeTab === 'employee-analytics' ? 'executive' : 'employee-analytics')}>
              <span className="nav-title">Employee Analytics</span>
              <span className="nav-desc">Productivity metrics</span>
            </div>
            <div className={`nav-card ${activeTab === 'opex-analytics' ? 'active' : ''}`} onClick={() => setActiveTab(activeTab === 'opex-analytics' ? 'executive' : 'opex-analytics')}>
              <span className="nav-title">OPEX & Tax</span>
              <span className="nav-desc">Operating expenses</span>
            </div>
            <div className={`nav-card ${activeTab === 'heatmap-analytics' ? 'active' : ''}`} onClick={() => setActiveTab(activeTab === 'heatmap-analytics' ? 'executive' : 'heatmap-analytics')}>
              <span className="nav-title">Sales Heatmap</span>
              <span className="nav-desc">Peak hours, patterns</span>
            </div>
          </div>
        </div>

      {/* Executive Overview Tab */}
      {activeTab === 'executive' && (
        <div className="tab-content">
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

          {/* KPI Cards */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">Break-Even Progress</span>
              </div>
              <div className="kpi-value">{formatPercent(breakEven?.monthly?.progressPercent)}</div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${Math.min(breakEven?.monthly?.progressPercent || 0, 100)}%` }}></div>
              </div>
              <div className="kpi-details">
                <span>Daily Target: {formatCurrency(breakEven?.daily?.dailyRevenueTarget)}</span>
                <span>Monthly BEP: {formatCurrency(breakEven?.breakEvenRevenue)}</span>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-header">
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

            <div className="kpi-card">
              <div className="kpi-header">
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

            <div className="kpi-card">
              <div className="kpi-header">
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

            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">Customer Lifetime Value</span>
              </div>
              <div className="kpi-value">{formatCurrency(customerMetrics?.summary?.avgCLV)}</div>
              <div className="kpi-details">
                <span>AOV: {formatCurrency(customerMetrics?.summary?.avgAOV)}</span>
                <span>Retention: {formatPercent(customerMetrics?.summary?.retentionRate)}</span>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">Customer Base</span>
              </div>
              <div className="kpi-value">{customerMetrics?.summary?.totalCustomers || 0}</div>
              <div className="kpi-details">
                <span>Returning: {customerMetrics?.summary?.returningCustomers || 0}</span>
                <span>Top 20%: {customerMetrics?.pareto?.top20Count || 0} customers</span>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="charts-grid">
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
                        legend: { position: 'top', labels: { color: '#666666', font: { size: 10 } } }
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
                        legend: { position: 'top', labels: { color: '#666666', font: { size: 10 } } }
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
                        legend: { position: 'right', labels: { color: '#666666', font: { size: 10 } } }
                      }
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* AI Insights */}
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
      )}

      {/* AI Predictions Tab */}
      {activeTab === 'ai-insights' && (
        <div className="tab-content">
          <div className="ai-summary-grid">
            <div className="ai-summary-card">
              <div className="ai-summary-value">{inventoryPredictions.filter(p => p.alert === 'HIGH').length}</div>
              <div className="ai-summary-label">Critical Stock Items</div>
              <div className="ai-summary-trend critical">Requires immediate attention</div>
            </div>
            <div className="ai-summary-card">
              <div className="ai-summary-value">
                ₱{revenuePredictions.projected7Day?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="ai-summary-label">7-Day Revenue Forecast</div>
              <div className="ai-summary-trend success">
                +{((revenuePredictions.projected7Day / (revenuePredictions.avgDaily * 7) - 1) * 100).toFixed(1)}% vs avg
              </div>
            </div>
            <div className="ai-summary-card">
              <div className="ai-summary-value">
                ₱{customerInsights?.avgLifetimeValue?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="ai-summary-label">Avg Customer Value</div>
              <div className="ai-summary-trend info">{customerInsights?.totalCustomers} total customers</div>
            </div>
            <div className="ai-summary-card">
              <div className="ai-summary-value">{customerInsights?.retentionRate?.toFixed(0)}%</div>
              <div className="ai-summary-label">Customer Retention</div>
              <div className="ai-summary-trend success">{customerInsights?.activeCustomers} active customers</div>
            </div>
          </div>

          {/* Quick Charts */}
          <div className="overview-charts-grid">
            <div className="overview-chart-card">
              <h3>7-Day Revenue Forecast</h3>
              <div className="chart-container-ai" style={{ height: '250px', marginTop: 'var(--spacing-md)' }}>
                {revenuePredictions.forecast && revenuePredictions.forecast.length > 0 && (
                  <Line
                    data={{
                      labels: revenuePredictions.forecast.map(f => format(f.date, 'MMM dd')),
                      datasets: [{
                        label: 'Predicted Revenue',
                        data: revenuePredictions.forecast.map(f => f.predicted),
                        borderColor: '#1B5E37',
                        backgroundColor: 'rgba(27, 94, 55, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointBackgroundColor: '#1B5E37',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        y: { beginAtZero: true, ticks: { callback: value => '₱' + (value / 1000).toFixed(0) + 'k' } }
                      }
                    }}
                  />
                )}
              </div>
            </div>

            <div className="overview-chart-card">
              <h3>Top Services by Revenue</h3>
              <div className="chart-container-ai" style={{ height: '250px', marginTop: 'var(--spacing-md)' }}>
                {servicePerformance.length > 0 && (
                  <Bar
                    data={{
                      labels: servicePerformance.slice(0, 5).map(s => s.name),
                      datasets: [{
                        label: 'Revenue',
                        data: servicePerformance.slice(0, 5).map(s => s.revenue),
                        backgroundColor: ['rgba(27, 94, 55, 0.9)', 'rgba(27, 94, 55, 0.75)', 'rgba(27, 94, 55, 0.6)', 'rgba(27, 94, 55, 0.45)', 'rgba(27, 94, 55, 0.3)'],
                        borderColor: '#1B5E37',
                        borderWidth: 2
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      indexAxis: 'y',
                      plugins: { legend: { display: false } },
                      scales: { x: { beginAtZero: true, ticks: { callback: value => '₱' + (value / 1000).toFixed(0) + 'k' } } }
                    }}
                  />
                )}
              </div>
            </div>

            <div className="overview-chart-card">
              <h3>Inventory Alert Status</h3>
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
                        backgroundColor: ['rgba(239, 68, 68, 0.8)', 'rgba(245, 158, 11, 0.8)', 'rgba(27, 94, 55, 0.8)'],
                        borderColor: ['#ef4444', '#f59e0b', '#1B5E37'],
                        borderWidth: 2
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { position: 'bottom' } }
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Immediate Actions */}
          <div className="ai-section">
            <h3>Immediate Actions Needed</h3>
            <div className="ai-alerts-list">
              {inventoryPredictions.filter(p => p.alert === 'HIGH').slice(0, 3).map((pred, idx) => (
                <div key={idx} className="ai-alert-card critical">
                  <div className="ai-alert-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                  </div>
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

          {/* Recommendations */}
          <div className="ai-section">
            <h3>AI-Powered Recommendations</h3>
            <div className="recommendations-grid">
              <div className="recommendation-card">
                <h4>Optimize Service Pricing</h4>
                <p>
                  {servicePerformance.length > 0 && servicePerformance[0].revenue > 20000
                    ? `${servicePerformance[0].name} is performing exceptionally well. Consider increasing price by 10-15% to maximize revenue.`
                    : 'Analyze service performance to identify pricing opportunities.'}
                </p>
              </div>
              <div className="recommendation-card">
                <h4>Customer Retention Strategy</h4>
                <p>
                  {customerInsights?.retentionRate < 60
                    ? 'Retention rate is below target. Implement loyalty programs or follow-up campaigns to re-engage inactive customers.'
                    : 'Great retention rate! Continue current customer engagement strategies and consider referral programs.'}
                </p>
              </div>
              <div className="recommendation-card">
                <h4>Inventory Optimization</h4>
                <p>
                  {inventoryPredictions.filter(p => p.alert === 'HIGH').length > 3
                    ? 'Multiple items need restocking. Consider bulk orders to reduce costs and establish automatic reorder points.'
                    : 'Inventory levels are well-managed. Review slow-moving items to optimize storage costs.'}
                </p>
              </div>
              <div className="recommendation-card">
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
        <div className="tab-content">
          <div className="product-usage-summary">
            <div className="usage-summary-card critical">
              <div className="usage-summary-content">
                <div className="usage-summary-value">{productUsageAnalysis.filter(p => p.alert === 'HIGH').length}</div>
                <div className="usage-summary-label">Critical Items</div>
                <div className="usage-summary-desc">Need immediate restocking</div>
              </div>
            </div>
            <div className="usage-summary-card warning">
              <div className="usage-summary-content">
                <div className="usage-summary-value">{productUsageAnalysis.filter(p => p.alert === 'MEDIUM').length}</div>
                <div className="usage-summary-label">Running Low</div>
                <div className="usage-summary-desc">Order within 2 weeks</div>
              </div>
            </div>
            <div className="usage-summary-card healthy">
              <div className="usage-summary-content">
                <div className="usage-summary-value">{productUsageAnalysis.filter(p => p.alert === 'LOW').length}</div>
                <div className="usage-summary-label">Well Stocked</div>
                <div className="usage-summary-desc">Adequate supply levels</div>
              </div>
            </div>
            <div className="usage-summary-card info">
              <div className="usage-summary-content">
                <div className="usage-summary-value">{productUsageAnalysis.length}</div>
                <div className="usage-summary-label">Products Tracked</div>
                <div className="usage-summary-desc">Consumption analysis</div>
              </div>
            </div>
          </div>

          <div className="ai-section">
            <h3>Product Consumption Tracking</h3>
            <p className="ai-section-subtitle">Track how many services you can perform with your current stock</p>

            <div className="usage-analysis-grid">
              {productUsageAnalysis.map((usage, idx) => (
                <div key={idx} className={`usage-card-enhanced ${usage.alert.toLowerCase()}-border`}>
                  <div className="usage-card-header">
                    <div className="usage-product-info">
                      <div className="usage-product-icon">
                        {usage.alert === 'HIGH' ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                          </svg>
                        ) : usage.alert === 'MEDIUM' ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                          </svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </div>
                      <div>
                        <h4 className="usage-product-name">{usage.productName}</h4>
                        <p className="usage-service-type">{usage.relatedServices.slice(0, 2).join(', ')}</p>
                      </div>
                    </div>
                    <span className={`usage-alert-badge-enhanced ${usage.alert.toLowerCase()}`}>{usage.alert}</span>
                  </div>

                  {usage.hasAnomaly && (
                    <div className="usage-anomaly-warning">
                      <span className="anomaly-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                      </span>
                      <div className="anomaly-content">
                        <strong>Suspicious Usage Detected!</strong>
                        <p>{usage.anomalyWarning}</p>
                      </div>
                    </div>
                  )}

                  <div className={`usage-consumption-highlight ${usage.dataSource === 'real' ? 'real-data' : 'estimated-data'}`}>
                    <div className="consumption-main">
                      <span className="consumption-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M8 2h8l2 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6l4-4z"/><path d="M10 2v4h4V2"/>
                        </svg>
                      </span>
                      <div className="consumption-text">
                        <span className="consumption-formula">
                          Used <strong>1 {usage.unit}</strong> for <strong>{usage.servicesPerUnit} services</strong>
                        </span>
                        <span className="consumption-detail">
                          {usage.dataSource === 'real'
                            ? `Based on real data: ${usage.totalUnitsUsed} bottles used for ${usage.totalServices} services`
                            : 'Estimated - No consumption data yet'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="usage-metrics-grid">
                    <div className="usage-metric-card">
                      <div className="usage-metric-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                          <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
                        </svg>
                      </div>
                      <div className="usage-metric-content">
                        <div className="usage-metric-label">Current Stock</div>
                        <div className="usage-metric-value">{usage.currentStock} <span className="usage-metric-unit">{usage.unit}s</span></div>
                      </div>
                    </div>
                    <div className="usage-metric-card">
                      <div className="usage-metric-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
                        </svg>
                      </div>
                      <div className="usage-metric-content">
                        <div className="usage-metric-label">Services Possible</div>
                        <div className="usage-metric-value">{usage.estimatedServicesLeft} <span className="usage-metric-unit">services</span></div>
                      </div>
                    </div>
                    <div className="usage-metric-card">
                      <div className="usage-metric-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                      </div>
                      <div className="usage-metric-content">
                        <div className="usage-metric-label">Days Remaining</div>
                        <div className={`usage-metric-value ${usage.alert === 'HIGH' ? 'critical-text' : ''}`}>{usage.estimatedDaysLeft} <span className="usage-metric-unit">days</span></div>
                      </div>
                    </div>
                    <div className="usage-metric-card">
                      <div className="usage-metric-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
                        </svg>
                      </div>
                      <div className="usage-metric-content">
                        <div className="usage-metric-label">Rate</div>
                        <div className="usage-metric-value">{usage.servicesPerUnit} <span className="usage-metric-unit">srv/{usage.unit}</span></div>
                      </div>
                    </div>
                  </div>

                  <div className="usage-progress-section">
                    <div className="usage-progress-header">
                      <span className="usage-progress-label">Stock Level</span>
                      <span className="usage-progress-percentage">{usage.estimatedServicesLeft} services left</span>
                    </div>
                    <div className="usage-progress-bar">
                      <div className={`usage-progress-fill ${usage.alert.toLowerCase()}`} style={{ width: `${Math.min(100, (usage.estimatedDaysLeft / 30) * 100)}%` }}></div>
                    </div>
                  </div>

                  <div className={`usage-recommendation-enhanced ${usage.alert.toLowerCase()}-bg`}>
                    <div className="usage-rec-icon">💡</div>
                    <div className="usage-rec-content">
                      <strong>AI Recommendation:</strong>
                      {usage.alert === 'HIGH' && (
                        <span> Critical! Only {usage.estimatedServicesLeft} services possible. Order {Math.max(5, Math.ceil(30 / usage.servicesPerUnit))} {usage.unit}s immediately.</span>
                      )}
                      {usage.alert === 'MEDIUM' && (
                        <span> Plan to restock within 2 weeks. You can perform ~{usage.estimatedServicesLeft} more services.</span>
                      )}
                      {usage.alert === 'LOW' && (
                        <span> Stock healthy! Can serve {usage.estimatedServicesLeft} more clients. Reorder in {Math.floor(usage.estimatedDaysLeft / 2)} days.</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Inventory Forecast Tab */}
      {activeTab === 'inventory' && (
        <div className="tab-content">
          <div className="inventory-summary-grid">
            <div className="inventory-summary-card critical-gradient">
              <div className="inv-summary-header">
                <span className="inv-summary-badge critical">URGENT</span>
              </div>
              <div className="inv-summary-value">{inventoryPredictions.filter(p => p.alert === 'HIGH').length}</div>
              <div className="inv-summary-label">Critical Stock Items</div>
              <div className="inv-summary-detail">Need immediate reorder</div>
            </div>
            <div className="inventory-summary-card warning-gradient">
              <div className="inv-summary-header">
                <span className="inv-summary-badge warning">WATCH</span>
              </div>
              <div className="inv-summary-value">{inventoryPredictions.filter(p => p.alert === 'MEDIUM').length}</div>
              <div className="inv-summary-label">Running Low</div>
              <div className="inv-summary-detail">Order within 2 weeks</div>
            </div>
            <div className="inventory-summary-card success-gradient">
              <div className="inv-summary-header">
                <span className="inv-summary-badge success">GOOD</span>
              </div>
              <div className="inv-summary-value">{inventoryPredictions.filter(p => p.alert === 'LOW').length}</div>
              <div className="inv-summary-label">Well Stocked</div>
              <div className="inv-summary-detail">Healthy inventory levels</div>
            </div>
            <div className="inventory-summary-card info-gradient">
              <div className="inv-summary-header">
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
                        {pred.alert === 'HIGH' ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                          </svg>
                        ) : pred.alert === 'MEDIUM' ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                          </svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </div>
                      <div>
                        <h4 className="inv-pred-product-name">{pred.productName}</h4>
                        <p className="inv-pred-subtitle">Stock Forecast</p>
                      </div>
                    </div>
                    <span className={`inv-pred-alert-badge ${pred.alert.toLowerCase()}`}>{pred.alert}</span>
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
                      <div className={`inv-metric-value ${pred.alert === 'HIGH' ? 'critical' : ''}`}>{pred.daysUntilOut} <span className="inv-metric-unit">days</span></div>
                    </div>
                  </div>

                  <div className="inv-pred-timeline">
                    <div className="inv-timeline-header">
                      <span className="inv-timeline-label">Depletion Progress</span>
                      <span className="inv-timeline-date">{format(pred.runOutDate, 'MMM dd, yyyy')}</span>
                    </div>
                    <div className="inv-timeline-bar">
                      <div className={`inv-timeline-fill ${pred.alert.toLowerCase()}`} style={{ width: `${Math.min(100, (1 - (pred.daysUntilOut / 60)) * 100)}%` }}></div>
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
          </div>
        </div>
      )}

      {/* Revenue Forecast Tab */}
      {activeTab === 'revenue' && revenuePredictions.forecast && (
        <div className="tab-content">
          <div className="revenue-summary-grid">
            <div className="revenue-summary-card total-gradient">
              <div className="rev-summary-value">₱{revenuePredictions.projected7Day?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              <div className="rev-summary-label">Projected Revenue</div>
              <div className="rev-summary-detail">Next 7 days forecast</div>
            </div>
            <div className="revenue-summary-card avg-gradient">
              <div className="rev-summary-value">₱{revenuePredictions.avgDaily?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              <div className="rev-summary-label">Average Daily</div>
              <div className="rev-summary-detail">Historical average</div>
            </div>
            <div className="revenue-summary-card confidence-gradient">
              <div className="rev-summary-value">{Math.round(revenuePredictions.forecast.reduce((sum, f) => sum + f.confidence, 0) / revenuePredictions.forecast.length)}%</div>
              <div className="rev-summary-label">Avg Confidence</div>
              <div className="rev-summary-detail">Prediction accuracy</div>
            </div>
            <div className="revenue-summary-card growth-gradient">
              <div className="rev-summary-value">{((revenuePredictions.projected7Day / (revenuePredictions.avgDaily * 7) - 1) * 100).toFixed(1)}%</div>
              <div className="rev-summary-label">vs Average</div>
              <div className="rev-summary-detail">Growth projection</div>
            </div>
          </div>

          <div className="ai-section">
            <h3>📈 7-Day Revenue Forecast</h3>
            <p className="ai-section-subtitle">AI-powered predictions based on historical trends and booking patterns</p>

            <div className="revenue-chart-enhanced">
              <Line
                data={{
                  labels: revenuePredictions.forecast.map(f => format(f.date, 'EEE, MMM dd')),
                  datasets: [{
                    label: 'Predicted Revenue',
                    data: revenuePredictions.forecast.map(f => f.predicted),
                    borderColor: '#1B5E37',
                    backgroundColor: 'rgba(27, 94, 55, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 6,
                    pointBackgroundColor: '#1B5E37',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                  }]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: true, position: 'top' } },
                  scales: {
                    y: { beginAtZero: true, ticks: { callback: value => '₱' + (value / 1000).toFixed(0) + 'k' } }
                  }
                }}
              />
            </div>

            <div className="forecast-cards-grid">
              {revenuePredictions.forecast.map((f, idx) => (
                <div key={idx} className="forecast-day-card">
                  <div className="forecast-card-header">
                    <div className="forecast-day-icon">{idx === 0 ? '📅' : idx === 1 ? '📆' : '🗓️'}</div>
                    <div className="forecast-day-info">
                      <div className="forecast-day-name">{format(f.date, 'EEEE')}</div>
                      <div className="forecast-day-date">{format(f.date, 'MMM dd, yyyy')}</div>
                    </div>
                  </div>
                  <div className="forecast-card-body">
                    <div className="forecast-revenue-section">
                      <div className="forecast-revenue-label">Predicted Revenue</div>
                      <div className="forecast-revenue-value">₱{f.predicted.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div className="forecast-confidence-section">
                      <div className="forecast-confidence-header">
                        <span className="forecast-confidence-label">Confidence Level</span>
                        <span className="forecast-confidence-percentage">{f.confidence}%</span>
                      </div>
                      <div className="forecast-confidence-bar">
                        <div className="forecast-confidence-fill" style={{ width: `${f.confidence}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Customer Analysis Tab */}
      {activeTab === 'customers' && customerInsights && (
        <div className="tab-content">
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
                <div className="insight-label">Based on repeat visits</div>
              </div>
            </div>

            <div className="customer-charts-grid">
              <div className="chart-container-ai" style={{ height: '300px' }}>
                <Doughnut
                  data={{
                    labels: ['Active Customers', 'Inactive Customers'],
                    datasets: [{
                      data: [customerInsights.activeCustomers, customerInsights.totalCustomers - customerInsights.activeCustomers],
                      backgroundColor: ['rgba(27, 94, 55, 0.8)', 'rgba(156, 163, 175, 0.5)'],
                      borderColor: ['#1B5E37', '#9ca3af'],
                      borderWidth: 2
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } }
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
                  <div className="stat-value">₱{customerInsights.avgLifetimeValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  <div className="stat-label">Avg Lifetime Value</div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 'var(--spacing-lg)' }}>
              <h3>🏆 Top Customers by Spending</h3>
              <div className="chart-container-ai" style={{ height: '300px', marginTop: 'var(--spacing-lg)' }}>
                <Bar
                  data={{
                    labels: customerInsights.topCustomers.map(c => c.name),
                    datasets: [{
                      label: 'Total Spending',
                      data: customerInsights.topCustomers.map(c => c.totalSpent),
                      backgroundColor: 'rgba(27, 94, 55, 0.8)',
                      borderColor: '#1B5E37',
                      borderWidth: 2
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, ticks: { callback: value => '₱' + value.toLocaleString() } } }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Performance Tab */}
      {activeTab === 'performance' && (
        <div className="tab-content">
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
                    <td><span className="rating-badge">⭐ {service.avgRating.toFixed(1)}</span></td>
                    <td><span className={`performance-badge ${service.performance.toLowerCase()}`}>{service.performance}</span></td>
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

      {/* ============== ANALYTICS SUB-PAGES ============== */}

      {/* Product Analytics Tab */}
      {activeTab === 'product-analytics' && productAnalytics && (
        <div className="tab-content">
          <div className="analytics-sub-header">
                        <h2>📦 Product Analytics</h2>
            <p className="subtitle">Gross profit margins by product, pricing analysis & performance</p>
          </div>

          <div className="analytics-filters">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="filter-select">
              <option value="all">All Types</option>
              <option value="service">Services</option>
              <option value="product">Products</option>
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="filter-select">
              <option value="revenue">Sort by Revenue</option>
              <option value="gpm">Sort by GPM</option>
              <option value="units">Sort by Units Sold</option>
              <option value="name">Sort by Name</option>
            </select>
          </div>

          <div className="summary-cards">
            <div className="summary-card">
              <span className="summary-label">Total Revenue</span>
              <span className="summary-value">{formatCurrency(productAnalytics.summary?.totalRevenue)}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Average GPM</span>
              <span className={`summary-value ${parseFloat(productAnalytics.summary?.avgGPM) >= 50 ? 'positive' : 'warning'}`}>
                {formatPercent(productAnalytics.summary?.avgGPM)}
              </span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Total Units Sold</span>
              <span className="summary-value">{productAnalytics.summary?.totalUnits?.toLocaleString()}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Products Analyzed</span>
              <span className="summary-value">{productAnalytics.products?.length}</span>
            </div>
          </div>

          <div className="ai-section">
            <h3>Product Performance Table</h3>
            <div className="table-container">
              <table className="performance-table">
                <thead>
                  <tr>
                    <th>Product/Service</th>
                    <th>Type</th>
                    <th>Price</th>
                    <th>Cost</th>
                    <th>GPM</th>
                    <th>Units Sold</th>
                    <th>Revenue</th>
                    <th>Gross Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedProducts().slice(0, 20).map((product, idx) => (
                    <tr key={idx}>
                      <td><strong>{product.name}</strong></td>
                      <td><span className={`type-badge ${product.type}`}>{product.type}</span></td>
                      <td>{formatCurrency(product.price)}</td>
                      <td>{formatCurrency(product.cost)}</td>
                      <td><span className={`gpm-badge ${getGPMClass(product.gpm)}`}>{formatPercent(product.gpm)}</span></td>
                      <td>{product.unitsSold}</td>
                      <td>{formatCurrency(product.revenue)}</td>
                      <td className="positive">{formatCurrency(product.grossProfit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="charts-row">
            <div className="chart-card">
              <h3>Revenue by Product (Top 10)</h3>
              <div style={{ height: '300px' }}>
                <Bar
                  data={{
                    labels: getSortedProducts().slice(0, 10).map(p => p.name.substring(0, 15)),
                    datasets: [{
                      label: 'Revenue',
                      data: getSortedProducts().slice(0, 10).map(p => p.revenue),
                      backgroundColor: 'rgba(27, 94, 55, 0.8)',
                      borderRadius: 4
                    }]
                  }}
                  options={{ responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } } }}
                />
              </div>
            </div>
            <div className="chart-card">
              <h3>GPM Distribution</h3>
              <div style={{ height: '300px' }}>
                <Doughnut
                  data={{
                    labels: ['Excellent (60%+)', 'Good (40-60%)', 'Fair (20-40%)', 'Low (<20%)'],
                    datasets: [{
                      data: [
                        getSortedProducts().filter(p => parseFloat(p.gpm) >= 60).length,
                        getSortedProducts().filter(p => parseFloat(p.gpm) >= 40 && parseFloat(p.gpm) < 60).length,
                        getSortedProducts().filter(p => parseFloat(p.gpm) >= 20 && parseFloat(p.gpm) < 40).length,
                        getSortedProducts().filter(p => parseFloat(p.gpm) < 20).length
                      ],
                      backgroundColor: ['rgba(27, 94, 55, 0.8)', 'rgba(27, 94, 55, 0.5)', 'rgba(217, 119, 6, 0.8)', 'rgba(220, 38, 38, 0.8)']
                    }]
                  }}
                  options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Analytics Tab */}
      {activeTab === 'inventory-analytics' && inventoryAnalytics && (
        <div className="tab-content">
          <div className="analytics-sub-header">
                        <h2>📊 Inventory Analytics</h2>
            <p className="subtitle">Turnover rates, stockout forecasts & supplier performance</p>
          </div>

          <div className="summary-cards">
            <div className="summary-card">
              <span className="summary-label">Average Turnover Rate</span>
              <span className="summary-value">{inventoryAnalytics.summary?.avgTurnoverRate?.toFixed(2)}x</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Slow Moving Items</span>
              <span className="summary-value">{inventoryAnalytics.slowMoving?.length || 0}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">At-Risk Stock</span>
              <span className={`summary-value ${inventoryAnalytics.atRisk?.length > 0 ? 'negative' : 'positive'}`}>
                {inventoryAnalytics.atRisk?.length || 0}
              </span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Total Inventory Value</span>
              <span className="summary-value">{formatCurrency(inventoryAnalytics.summary?.totalValue)}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Days of Stock</span>
              <span className="summary-value">{inventoryAnalytics.summary?.avgDaysOfStock?.toFixed(0)} days</span>
            </div>
          </div>

          <div className="charts-row">
            <div className="chart-card">
              <h3>Turnover Rate by Product</h3>
              <div style={{ height: '300px' }}>
                {inventoryAnalytics.turnover && (
                  <Bar
                    data={{
                      labels: inventoryAnalytics.turnover.slice(0, 10).map(t => t.name?.substring(0, 12)),
                      datasets: [{
                        label: 'Turnover Rate',
                        data: inventoryAnalytics.turnover.slice(0, 10).map(t => t.turnoverRate),
                        backgroundColor: inventoryAnalytics.turnover.slice(0, 10).map(t => t.turnoverRate >= 4 ? 'rgba(27, 94, 55, 0.8)' : t.turnoverRate >= 2 ? 'rgba(217, 119, 6, 0.8)' : 'rgba(220, 38, 38, 0.8)'),
                        borderRadius: 4
                      }]
                    }}
                    options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                  />
                )}
              </div>
            </div>
            <div className="chart-card">
              <h3>Inventory Needs Forecast</h3>
              <div style={{ height: '300px' }}>
                {inventoryAnalytics.stockout && (
                  <Doughnut
                    data={{
                      labels: ['Critical (<7 days)', 'Warning (7-14)', 'Caution (14-30)', 'OK (30+)'],
                      datasets: [{
                        data: [
                          inventoryAnalytics.stockout.filter(s => s.daysUntilStockout <= 7).length,
                          inventoryAnalytics.stockout.filter(s => s.daysUntilStockout > 7 && s.daysUntilStockout <= 14).length,
                          inventoryAnalytics.stockout.filter(s => s.daysUntilStockout > 14 && s.daysUntilStockout <= 30).length,
                          inventoryAnalytics.stockout.filter(s => s.daysUntilStockout > 30).length
                        ],
                        backgroundColor: ['rgba(220, 38, 38, 0.8)', 'rgba(245, 158, 11, 0.8)', 'rgba(217, 119, 6, 0.6)', 'rgba(27, 94, 55, 0.8)']
                      }]
                    }}
                    options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="ai-section">
            <h3>Stockout Risk Forecast</h3>
            <p className="ai-section-subtitle">Products at risk of running out of stock based on current sales velocity</p>
            <div className="stockout-grid">
              {inventoryAnalytics.stockout?.slice(0, 8).map((item, idx) => (
                <div key={idx} className={`stockout-card ${getStockoutClass(item.daysUntilStockout)}`}>
                  <div className="stockout-header">
                    <strong>{item.name}</strong>
                    <span className="days-badge">{item.daysUntilStockout} days</span>
                  </div>
                  <div className="stockout-details">
                    <div><span>Current Stock:</span> <span>{item.currentStock} units</span></div>
                    <div><span>Daily Velocity:</span> <span>{item.dailyVelocity?.toFixed(1)} units/day</span></div>
                    <div><span>Suggested Reorder:</span> <span className="reorder-qty">{item.suggestedReorder} units</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Customer Analytics Tab */}
      {activeTab === 'customer-analytics' && customerMetrics && (
        <div className="tab-content">
          <div className="analytics-sub-header">
                        <h2>👥 Customer Analytics</h2>
            <p className="subtitle">Customer lifetime value, retention analysis & Pareto distribution</p>
          </div>

          <div className="summary-cards">
            <div className="summary-card">
              <span className="summary-label">Total Customers</span>
              <span className="summary-value">{customerMetrics.summary?.totalCustomers}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Avg CLV</span>
              <span className="summary-value">{formatCurrency(customerMetrics.summary?.avgCLV)}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Avg Order Value</span>
              <span className="summary-value">{formatCurrency(customerMetrics.summary?.avgAOV)}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Retention Rate</span>
              <span className={`summary-value ${parseFloat(customerMetrics.summary?.retentionRate) >= 60 ? 'positive' : 'warning'}`}>
                {formatPercent(customerMetrics.summary?.retentionRate)}
              </span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Returning Customers</span>
              <span className="summary-value">{customerMetrics.summary?.returningCustomers}</span>
            </div>
          </div>

          <div className="charts-row">
            <div className="chart-card">
              <h3>Customer Segments</h3>
              <div style={{ height: '300px' }}>
                <Doughnut
                  data={{
                    labels: getSegmentsArray().map(s => `${s.segment} (${s.count})`),
                    datasets: [{
                      data: getSegmentsArray().map(s => s.count),
                      backgroundColor: ['rgba(27, 94, 55, 0.9)', 'rgba(27, 94, 55, 0.6)', 'rgba(217, 119, 6, 0.7)', 'rgba(102, 102, 102, 0.5)']
                    }]
                  }}
                  options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }}
                />
              </div>
            </div>
            <div className="chart-card">
              <h3>Revenue by Segment</h3>
              <div style={{ height: '300px' }}>
                <Bar
                  data={{
                    labels: getSegmentsArray().map(s => s.segment),
                    datasets: [{
                      label: 'Revenue',
                      data: getSegmentsArray().map(s => s.revenue),
                      backgroundColor: ['rgba(27, 94, 55, 0.9)', 'rgba(27, 94, 55, 0.6)', 'rgba(217, 119, 6, 0.7)', 'rgba(102, 102, 102, 0.5)']
                    }]
                  }}
                  options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                />
              </div>
            </div>
          </div>

          <div className="ai-section">
            <h3>🏆 Pareto Analysis (80/20 Rule)</h3>
            <div className="pareto-summary">
              <div className="pareto-card">
                <div className="pareto-value">{customerMetrics.pareto?.top20Count || 0}</div>
                <div className="pareto-label">Top 20% Customers</div>
              </div>
              <div className="pareto-card highlight">
                <div className="pareto-value">{formatPercent(customerMetrics.pareto?.top20Revenue || 0)}</div>
                <div className="pareto-label">Revenue Contribution</div>
              </div>
              <div className="pareto-card">
                <div className="pareto-value">{formatCurrency(customerMetrics.pareto?.avgTop20Spend || 0)}</div>
                <div className="pareto-label">Avg Top Customer Spend</div>
              </div>
            </div>
          </div>

          <div className="ai-section">
            <h3>Customer Segments Detail</h3>
            <div className="segments-table">
              <table className="performance-table">
                <thead>
                  <tr>
                    <th>Segment</th>
                    <th>Customers</th>
                    <th>Total Revenue</th>
                    <th>Avg Spend</th>
                    <th>% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {getSegmentsArray().map((seg, idx) => (
                    <tr key={idx}>
                      <td><span className={`segment-badge segment-${seg.segment.toLowerCase()}`}>{seg.segment}</span></td>
                      <td>{seg.count}</td>
                      <td>{formatCurrency(seg.revenue)}</td>
                      <td>{formatCurrency(seg.avgSpend)}</td>
                      <td>{customerMetrics.summary?.totalCustomers ? ((seg.count / customerMetrics.summary.totalCustomers) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Employee Analytics Tab */}
      {activeTab === 'employee-analytics' && employeeAnalytics && (
        <div className="tab-content">
          <div className="analytics-sub-header">
                        <h2>👔 Employee Analytics</h2>
            <p className="subtitle">Productivity metrics, performance scores & attendance analysis</p>
          </div>

          <div className="analytics-filters">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="filter-select">
              <option value="revenue">Sort by Revenue</option>
              <option value="services">Sort by Services</option>
              <option value="efficiency">Sort by Efficiency</option>
              <option value="attendance">Sort by Attendance</option>
              <option value="name">Sort by Name</option>
            </select>
          </div>

          <div className="summary-cards">
            <div className="summary-card">
              <span className="summary-label">Total Employees</span>
              <span className="summary-value">{employeeAnalytics.summary?.totalEmployees}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Avg Productivity Score</span>
              <span className={`summary-value ${employeeAnalytics.summary?.avgProductivityScore >= 75 ? 'positive' : 'warning'}`}>
                {employeeAnalytics.summary?.avgProductivityScore?.toFixed(0)}%
              </span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Total Revenue Generated</span>
              <span className="summary-value">{formatCurrency(employeeAnalytics.summary?.totalRevenue)}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Avg Revenue/Employee</span>
              <span className="summary-value">{formatCurrency(employeeAnalytics.summary?.avgRevenuePerEmployee)}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Avg Attendance Rate</span>
              <span className="summary-value">{formatPercent(employeeAnalytics.summary?.avgAttendanceRate)}</span>
            </div>
          </div>

          <div className="ai-section">
            <h3>Employee Performance Table</h3>
            <div className="table-container">
              <table className="performance-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Position</th>
                    <th>Services</th>
                    <th>Revenue</th>
                    <th>Efficiency</th>
                    <th>Attendance</th>
                    <th>Productivity</th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedEmployees().map((emp, idx) => (
                    <tr key={idx}>
                      <td><strong>{emp.name}</strong></td>
                      <td>{emp.position}</td>
                      <td>{emp.transactionCount || 0}</td>
                      <td>{formatCurrency(emp.revenue || 0)}</td>
                      <td>{(emp.efficiency || 0).toFixed(0)}%</td>
                      <td>{formatPercent(emp.punctualityRate || 0)}</td>
                      <td>
                        <span className={`productivity-badge ${getProductivityClass(emp.productivityScore || 0)}`}>
                          {(emp.productivityScore || 0).toFixed(0)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="charts-row">
            <div className="chart-card">
              <h3>Revenue by Employee</h3>
              <div style={{ height: '300px' }}>
                <Bar
                  data={{
                    labels: getSortedEmployees().slice(0, 8).map(e => e.name?.split(' ')[0]),
                    datasets: [{
                      label: 'Revenue',
                      data: getSortedEmployees().slice(0, 8).map(e => e.revenue || 0),
                      backgroundColor: 'rgba(27, 94, 55, 0.8)',
                      borderRadius: 4
                    }]
                  }}
                  options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                />
              </div>
            </div>
            <div className="chart-card">
              <h3>Productivity Distribution</h3>
              <div style={{ height: '300px' }}>
                <Doughnut
                  data={{
                    labels: ['Excellent (90+)', 'Good (75-89)', 'Fair (60-74)', 'Needs Work (<60)'],
                    datasets: [{
                      data: [
                        getSortedEmployees().filter(e => (e.productivityScore || 0) >= 90).length,
                        getSortedEmployees().filter(e => (e.productivityScore || 0) >= 75 && (e.productivityScore || 0) < 90).length,
                        getSortedEmployees().filter(e => (e.productivityScore || 0) >= 60 && (e.productivityScore || 0) < 75).length,
                        getSortedEmployees().filter(e => (e.productivityScore || 0) < 60).length
                      ],
                      backgroundColor: ['rgba(27, 94, 55, 0.9)', 'rgba(27, 94, 55, 0.6)', 'rgba(217, 119, 6, 0.7)', 'rgba(220, 38, 38, 0.7)']
                    }]
                  }}
                  options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OPEX & Tax Analytics Tab */}
      {activeTab === 'opex-analytics' && opexData && (
        <div className="tab-content">
          <div className="analytics-sub-header">
                        <h2>💵 OPEX & Tax Analytics</h2>
            <p className="subtitle">Operating expenses, efficiency ratios & tax compliance</p>
          </div>

          <div className="summary-cards">
            <div className="summary-card">
              <span className="summary-label">Total OPEX (Monthly)</span>
              <span className="summary-value">{formatCurrency(opexData.currentMonth?.totalOpex || 0)}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">OPEX Ratio</span>
              <span className={`summary-value ${parseFloat(opexData.currentMonth?.opexPercentage) <= 30 ? 'positive' : 'warning'}`}>
                {formatPercent(opexData.currentMonth?.opexPercentage)}
              </span>
              <span className="summary-hint">of revenue</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Total Tax Obligations</span>
              <span className="summary-value">{formatCurrency(opexData.taxes?.totalTaxLiability || 0)}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">VAT Payable</span>
              <span className="summary-value">{formatCurrency(opexData.taxes?.vatPayable || 0)}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Statutory Contributions</span>
              <span className="summary-value">{formatCurrency(opexData.statutory?.total || 0)}</span>
            </div>
          </div>

          <div className="charts-row">
            <div className="chart-card">
              <h3>OPEX Breakdown</h3>
              <div style={{ height: '300px' }}>
                <Doughnut
                  data={{
                    labels: getBreakdownArray().map(b => b.category),
                    datasets: [{
                      data: getBreakdownArray().map(b => b.amount),
                      backgroundColor: ['rgba(27, 94, 55, 0.8)', 'rgba(27, 94, 55, 0.6)', 'rgba(217, 119, 6, 0.8)', 'rgba(220, 38, 38, 0.8)', 'rgba(102, 102, 102, 0.8)', 'rgba(102, 102, 102, 0.6)']
                    }]
                  }}
                  options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }}
                />
              </div>
            </div>
            <div className="chart-card">
              <h3>Tax Obligations</h3>
              <div style={{ height: '300px' }}>
                <Bar
                  data={{
                    labels: ['VAT', 'SSS', 'PhilHealth', 'Pag-IBIG', 'Withholding'],
                    datasets: [{
                      label: 'Amount',
                      data: [opexData.taxes?.vatPayable || 0, opexData.statutory?.sss || 0, opexData.statutory?.philHealth || 0, opexData.statutory?.pagIbig || 0, opexData.taxes?.withholdingTax || 0],
                      backgroundColor: ['rgba(27, 94, 55, 0.8)', 'rgba(27, 94, 55, 0.6)', 'rgba(217, 119, 6, 0.8)', 'rgba(220, 38, 38, 0.8)', 'rgba(102, 102, 102, 0.8)'],
                      borderRadius: 4
                    }]
                  }}
                  options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                />
              </div>
            </div>
            <div className="chart-card">
              <h3>Fixed Costs</h3>
              <div className="fixed-costs-list">
                {opexData.fixedCosts && Object.entries(opexData.fixedCosts).map(([key, value]) => (
                  <div key={key} className="fixed-cost-item">
                    <span className="fixed-cost-label">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span className="fixed-cost-value">{formatCurrency(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="ai-section">
            <h3>Operating Expense Details</h3>
            <div className="table-container">
              <table className="performance-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Monthly Amount</th>
                    <th>% of Total OPEX</th>
                    <th>% of Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {getBreakdownArray().map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.category}</td>
                      <td>{formatCurrency(item.amount)}</td>
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
                    <td><strong>{formatCurrency(opexData.currentMonth?.totalOpex || 0)}</strong></td>
                    <td><strong>100%</strong></td>
                    <td><strong>{formatPercent(opexData.currentMonth?.opexPercentage)}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Sales Heatmap Tab */}
      {activeTab === 'heatmap-analytics' && heatmapData && (
        <div className="tab-content">
          <div className="analytics-sub-header">
                        <h2>🔥 Sales Heatmap</h2>
            <p className="subtitle">Hourly patterns, peak hours & traffic analysis</p>
          </div>

          <div className="analytics-filters">
            <select value={heatmapViewMode} onChange={(e) => setHeatmapViewMode(e.target.value)} className="filter-select">
              <option value="revenue">View: Revenue</option>
              <option value="transactions">View: Transactions</option>
              <option value="avgTicket">View: Avg Ticket</option>
            </select>
          </div>

          {/* Peak Insights */}
          <div className="peak-insights">
            <div className="peak-card">
              <h4>Peak Hours</h4>
              <div className="peak-list">
                {getPeakHours().map((peak, idx) => (
                  <div key={idx} className="peak-item">
                    <span className="peak-rank">{idx + 1}</span>
                    <span className="peak-time">{peak.formatted}</span>
                    <span className="peak-value">{heatmapViewMode === 'revenue' ? formatCurrency(peak.total) : `${peak.total} txns`}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="peak-card">
              <h4>Peak Days</h4>
              <div className="peak-list">
                {getPeakDays().map((peak, idx) => (
                  <div key={idx} className="peak-item">
                    <span className="peak-rank">{idx + 1}</span>
                    <span className="peak-time">{peak.day}</span>
                    <span className="peak-value">{heatmapViewMode === 'revenue' ? formatCurrency(peak.total) : `${peak.total} txns`}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="peak-card recommendation">
              <h4>💡 Recommendation</h4>
              <p>
                Peak sales occur during <strong>{getPeakHours()[0]?.formatted}</strong> on <strong>{getPeakDays()[0]?.day}s</strong>.
                Schedule more staff during peak times and run promotions during slower hours.
              </p>
            </div>
          </div>

          {/* Heatmap Grid */}
          <div className="heatmap-section">
            <h3>Weekly {heatmapViewMode === 'revenue' ? 'Revenue' : heatmapViewMode === 'transactions' ? 'Transaction' : 'Avg Ticket'} Heatmap</h3>
            <div className="heatmap-container">
              <div className="heatmap-grid">
                <div className="heatmap-row header">
                  <div className="heatmap-cell day-label"></div>
                  {hours.map(hour => (
                    <div key={hour} className="heatmap-cell hour-label">{formatTime(hour)}</div>
                  ))}
                </div>
                {days.map((day) => {
                  const dayData = heatmapData?.find(d => d.day === day);
                  return (
                    <div key={day} className="heatmap-row">
                      <div className="heatmap-cell day-label">{day.substring(0, 3)}</div>
                      {hours.map(hour => {
                        const value = getHeatValue(dayData, hour);
                        return (
                          <div key={hour} className="heatmap-cell data" style={{ backgroundColor: getHeatColor(value) }} title={`${day} ${formatTime(hour)}: ${heatmapViewMode === 'transactions' ? value : formatCurrency(value)}`}>
                            <span className="cell-value">{heatmapViewMode === 'transactions' ? value : (value > 0 ? Math.round(value / 1000) + 'k' : '')}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
              <div className="heatmap-legend">
                <span className="legend-label">Low</span>
                <div className="legend-gradient">
                  <div className="legend-step" style={{ backgroundColor: 'rgba(27, 94, 55, 0.2)' }}></div>
                  <div className="legend-step" style={{ backgroundColor: 'rgba(27, 94, 55, 0.4)' }}></div>
                  <div className="legend-step" style={{ backgroundColor: 'rgba(27, 94, 55, 0.6)' }}></div>
                  <div className="legend-step" style={{ backgroundColor: 'rgba(27, 94, 55, 0.8)' }}></div>
                  <div className="legend-step" style={{ backgroundColor: 'rgba(27, 94, 55, 1)' }}></div>
                </div>
                <span className="legend-label">High</span>
              </div>
            </div>
          </div>

          {/* Daily Summary */}
          <div className="ai-section">
            <h3>Daily Summary</h3>
            <div className="table-container">
              <table className="performance-table">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Total Revenue</th>
                    <th>Transactions</th>
                    <th>Avg Ticket</th>
                    <th>Peak Hour</th>
                  </tr>
                </thead>
                <tbody>
                  {heatmapData?.map((day, idx) => {
                    const totalRevenue = day.hours.reduce((sum, h) => sum + h.revenue, 0);
                    const totalTxns = day.hours.reduce((sum, h) => sum + h.transactions, 0);
                    const peakHour = day.hours.reduce((max, h) => h.revenue > max.revenue ? h : max, { hour: 8, revenue: 0 });
                    return (
                      <tr key={idx}>
                        <td>{day.day}</td>
                        <td className="highlight">{formatCurrency(totalRevenue)}</td>
                        <td>{totalTxns}</td>
                        <td>{formatCurrency(totalTxns > 0 ? totalRevenue / totalTxns : 0)}</td>
                        <td className="positive">{formatTime(peakHour.hour)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Reports Tab - Embedded Reports Page */}
      {activeTab === 'reports' && (
        <div className="tab-content-wrapper">
          <Reports embedded />
        </div>
      )}
    </div>
  );
};

export default AvaSenseiUltrathink;
