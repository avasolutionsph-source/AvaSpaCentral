import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';

const SalesHeatmap = () => {
  const navigate = useNavigate();
  const { showToast, getUserBranchId } = useApp();

  const [loading, setLoading] = useState(true);
  const [heatmapData, setHeatmapData] = useState(null);
  const [realtimeProfit, setRealtimeProfit] = useState(null);
  const [viewMode, setViewMode] = useState('revenue'); // revenue, transactions, avgTicket

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const hours = Array.from({ length: 14 }, (_, i) => i + 8); // 8 AM to 9 PM

  useEffect(() => {
    loadHeatmapData();
  }, []);

  // Real-time profit update
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

  // Transform flat hourly data to grouped by day structure
  const transformHeatmapData = (flatData) => {
    if (!flatData || !Array.isArray(flatData)) return [];

    const grouped = {};
    flatData.forEach(item => {
      if (!grouped[item.day]) {
        grouped[item.day] = {
          day: item.day,
          dayIndex: item.dayIndex,
          hours: []
        };
      }
      grouped[item.day].hours.push({
        hour: item.hour,
        revenue: item.sales || 0,
        transactions: item.transactions || 0
      });
    });

    // Sort by dayIndex and return as array
    return Object.values(grouped).sort((a, b) => a.dayIndex - b.dayIndex);
  };

  const loadHeatmapData = async () => {
    try {
      setLoading(true);
      const [heatmap, realtime] = await Promise.all([
        mockApi.analytics.getSalesHeatmapData(),
        mockApi.analytics.getRealtimeProfit()
      ]);
      // Filter heatmap data by branch
      const userBranchId = getUserBranchId();
      let filteredHeatmap = heatmap;
      if (userBranchId && Array.isArray(heatmap)) {
        filteredHeatmap = heatmap.filter(item => !item.branchId || item.branchId === userBranchId);
      }

      setHeatmapData(transformHeatmapData(filteredHeatmap));
      setRealtimeProfit(realtime);
      setLoading(false);
    } catch (error) {
      showToast('Failed to load heatmap data', 'error');
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

  const formatTime = (hour) => {
    if (hour === 12) return '12 PM';
    if (hour > 12) return `${hour - 12} PM`;
    return `${hour} AM`;
  };

  const getHeatValue = (dayData, hour) => {
    if (!dayData) return 0;
    const hourData = dayData.hours.find(h => h.hour === hour);
    if (!hourData) return 0;

    switch (viewMode) {
      case 'revenue':
        return hourData.revenue;
      case 'transactions':
        return hourData.transactions;
      case 'avgTicket':
        return hourData.transactions > 0 ? hourData.revenue / hourData.transactions : 0;
      default:
        return hourData.revenue;
    }
  };

  const getMaxValue = () => {
    if (!heatmapData) return 1;
    let max = 0;
    heatmapData.forEach(day => {
      day.hours.forEach(h => {
        const val = viewMode === 'revenue' ? h.revenue :
                   viewMode === 'transactions' ? h.transactions :
                   h.transactions > 0 ? h.revenue / h.transactions : 0;
        if (val > max) max = val;
      });
    });
    return max || 1;
  };

  const getHeatColor = (value) => {
    const max = getMaxValue();
    const intensity = value / max;

    if (intensity === 0) return 'rgba(224, 224, 224, 0.5)';
    if (intensity < 0.2) return 'rgba(27, 94, 55, 0.2)';
    if (intensity < 0.4) return 'rgba(27, 94, 55, 0.4)';
    if (intensity < 0.6) return 'rgba(27, 94, 55, 0.6)';
    if (intensity < 0.8) return 'rgba(27, 94, 55, 0.8)';
    return 'rgba(27, 94, 55, 1)';
  };

  const formatCellValue = (value) => {
    switch (viewMode) {
      case 'revenue':
        return formatCurrency(value);
      case 'transactions':
        return value;
      case 'avgTicket':
        return formatCurrency(value);
      default:
        return value;
    }
  };

  const getPeakHours = () => {
    if (!heatmapData) return [];
    const hourTotals = {};

    hours.forEach(hour => {
      hourTotals[hour] = 0;
      heatmapData.forEach(day => {
        const hourData = day.hours.find(h => h.hour === hour);
        if (hourData) {
          hourTotals[hour] += viewMode === 'revenue' ? hourData.revenue : hourData.transactions;
        }
      });
    });

    return Object.entries(hourTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([hour, total]) => ({
        hour: parseInt(hour),
        total,
        formatted: formatTime(parseInt(hour))
      }));
  };

  const getPeakDays = () => {
    if (!heatmapData) return [];
    return heatmapData
      .map(day => ({
        day: day.day,
        total: day.hours.reduce((sum, h) =>
          sum + (viewMode === 'revenue' ? h.revenue : h.transactions), 0
        )
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);
  };

  if (loading) {
    return (
      <div className="analytics-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading sales heatmap...</p>
        </div>
      </div>
    );
  }

  const peakHours = getPeakHours();
  const peakDays = getPeakDays();

  return (
    <div className="analytics-page heatmap-analytics">
      {/* Header */}
      <div className="analytics-header">
        <div className="header-left">
          <button className="btn-back" onClick={() => navigate('/analytics')}>
            ← Back
          </button>
          <div>
            <h1>Sales Heatmap</h1>
            <p className="subtitle">Hourly patterns, peak hours & real-time profitability</p>
          </div>
        </div>
        <div className="header-right">
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            className="view-select"
          >
            <option value="revenue">Revenue</option>
            <option value="transactions">Transactions</option>
            <option value="avgTicket">Avg Ticket</option>
          </select>
          <button onClick={loadHeatmapData} className="btn-refresh">
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Real-time Profit Banner */}
      {realtimeProfit?.today && (
        <div className={`realtime-banner ${(realtimeProfit.today.netProfit || 0) >= 0 ? 'positive' : 'negative'}`}>
          <div className="realtime-content">
            <span className="realtime-label">Today's Live Profit</span>
            <span className="realtime-value">{formatCurrency(realtimeProfit.today.netProfit || 0)}</span>
            <span className="realtime-details">
              Revenue: {formatCurrency(realtimeProfit.today.revenue || 0)} |
              Costs: {formatCurrency((realtimeProfit.today.cogs || 0) + (realtimeProfit.today.laborCost || 0) + (realtimeProfit.today.dailyFixedCost || 0))} |
              Transactions: {realtimeProfit.today.transactionCount || 0}
            </span>
          </div>
          <div className="realtime-indicator">
            <span className="pulse"></span> LIVE
          </div>
        </div>
      )}

      {/* Peak Insights */}
      <div className="peak-insights">
        <div className="peak-card">
          <h4>Peak Hours</h4>
          <div className="peak-list">
            {peakHours.map((peak, index) => (
              <div key={index} className="peak-item">
                <span className="peak-rank">{index + 1}</span>
                <span className="peak-time">{peak.formatted}</span>
                <span className="peak-value">
                  {viewMode === 'revenue' ? formatCurrency(peak.total) : `${peak.total} txns`}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="peak-card">
          <h4>Peak Days</h4>
          <div className="peak-list">
            {peakDays.map((peak, index) => (
              <div key={index} className="peak-item">
                <span className="peak-rank">{index + 1}</span>
                <span className="peak-time">{peak.day}</span>
                <span className="peak-value">
                  {viewMode === 'revenue' ? formatCurrency(peak.total) : `${peak.total} txns`}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="peak-card recommendation">
          <h4>Recommendation</h4>
          <p>
            Peak sales occur during <strong>{peakHours[0]?.formatted}</strong> on <strong>{peakDays[0]?.day}s</strong>.
            Consider scheduling more staff during these times and running promotions during slower hours
            ({formatTime(hours.find(h => !peakHours.slice(0, 3).find(p => p.hour === h)) || 8)})
            to balance traffic.
          </p>
        </div>
      </div>

      {/* Heatmap */}
      <div className="heatmap-section">
        <h3>
          Weekly {viewMode === 'revenue' ? 'Revenue' : viewMode === 'transactions' ? 'Transaction' : 'Avg Ticket'} Heatmap
        </h3>
        <div className="heatmap-container">
          <div className="heatmap-grid">
            {/* Header row */}
            <div className="heatmap-row header">
              <div className="heatmap-cell day-label"></div>
              {hours.map(hour => (
                <div key={hour} className="heatmap-cell hour-label">
                  {formatTime(hour)}
                </div>
              ))}
            </div>

            {/* Data rows */}
            {days.map((day, dayIndex) => {
              const dayData = heatmapData?.find(d => d.day === day);
              return (
                <div key={day} className="heatmap-row">
                  <div className="heatmap-cell day-label">{day.substring(0, 3)}</div>
                  {hours.map(hour => {
                    const value = getHeatValue(dayData, hour);
                    return (
                      <div
                        key={hour}
                        className="heatmap-cell data"
                        style={{ backgroundColor: getHeatColor(value) }}
                        title={`${day} ${formatTime(hour)}: ${formatCellValue(value)}`}
                      >
                        <span className="cell-value">
                          {viewMode === 'transactions' ? value : (value > 0 ? Math.round(value / 1000) + 'k' : '')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Legend */}
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

      {/* Daily Summary Table */}
      <div className="table-section">
        <h3>Daily Summary</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Day</th>
                <th>Total Revenue</th>
                <th>Transactions</th>
                <th>Avg Ticket</th>
                <th>Peak Hour</th>
                <th>Slowest Hour</th>
              </tr>
            </thead>
            <tbody>
              {heatmapData?.map((day, index) => {
                const totalRevenue = day.hours.reduce((sum, h) => sum + h.revenue, 0);
                const totalTxns = day.hours.reduce((sum, h) => sum + h.transactions, 0);
                const peakHour = day.hours.reduce((max, h) => h.revenue > max.revenue ? h : max, { hour: 8, revenue: 0 });
                const slowestHour = day.hours.reduce((min, h) => h.revenue < min.revenue ? h : min, { hour: 8, revenue: Infinity });

                return (
                  <tr key={index}>
                    <td>{day.day}</td>
                    <td className="highlight">{formatCurrency(totalRevenue)}</td>
                    <td>{totalTxns}</td>
                    <td>{formatCurrency(totalTxns > 0 ? totalRevenue / totalTxns : 0)}</td>
                    <td className="positive">{formatTime(peakHour.hour)}</td>
                    <td className="warning">{formatTime(slowestHour.hour)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insights */}
      <div className="insights-section compact">
        <h3>Heatmap Insights</h3>
        <div className="insight-cards">
          <div className="insight-card">
            <div className="insight-content">
              <strong>Staffing Optimization</strong>
              <p>
                Consider reducing staff during slow hours ({formatTime(hours[hours.length - 3])} onwards)
                and increasing coverage during peak hours ({peakHours[0]?.formatted} - {peakHours[1]?.formatted}).
              </p>
            </div>
          </div>
          <div className="insight-card">
            <div className="insight-content">
              <strong>Revenue Opportunity</strong>
              <p>
                {peakDays[0]?.day}s generate the highest revenue. Consider special promotions on slower days
                like {days.find(d => !peakDays.find(p => p.day === d))} to boost traffic.
              </p>
            </div>
          </div>
          <div className="insight-card">
            <div className="insight-content">
              <strong>Happy Hour Strategy</strong>
              <p>
                Implement happy hour discounts during slow periods
                ({formatTime(hours[0])} - {formatTime(hours[2])}) to increase morning traffic.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesHeatmap;
