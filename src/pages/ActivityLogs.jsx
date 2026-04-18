import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { format, parseISO, subDays, startOfDay, endOfDay } from 'date-fns';

const ActivityLogs = () => {
  const { showToast, getEffectiveBranchId } = useApp();
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState(new Set());
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('txt');

  // Filters
  const [filterType, setFilterType] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const logsPerPage = 20;

  useEffect(() => {
    fetchActivityLogs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [logs, filterType, filterSeverity, filterUser, filterStartDate, filterEndDate, searchQuery, quickFilter]);

  const fetchActivityLogs = async () => {
    setLoading(true);
    try {
      let apiLogs = await mockApi.activityLogs.getLogs();

      // Filter logs by branch
      const effectiveBranchId = getEffectiveBranchId();
      if (effectiveBranchId) {
        apiLogs = apiLogs.filter(item => !item.branchId || item.branchId === effectiveBranchId);
      }

      setLogs(apiLogs.map((l, i) => ({ ...l, id: l._id || i + 1 })));
    } catch (error) {
      showToast('Failed to load activity logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Helper to safely get user display name from log (handles both old and new formats)
  const getUserDisplayName = (log) => {
    if (log.user && log.user.firstName) {
      return `${log.user.firstName} ${log.user.lastName || ''}`.trim();
    }
    return log.userName || 'Unknown';
  };

  // Helper to safely get user role from log
  const getUserRole = (log) => {
    if (log.user && log.user.role) {
      return log.user.role;
    }
    return 'Unknown';
  };

  const applyFilters = () => {
    let filtered = [...logs];

    // Quick filter
    if (quickFilter !== 'all') {
      const today = startOfDay(new Date());
      switch (quickFilter) {
        case 'today':
          filtered = filtered.filter(log => {
            const logDate = startOfDay(parseISO(log.timestamp));
            return logDate.getTime() === today.getTime();
          });
          break;
        case 'week':
          const weekAgo = subDays(today, 7);
          filtered = filtered.filter(log => {
            const logDate = parseISO(log.timestamp);
            return logDate >= weekAgo;
          });
          break;
        case 'critical':
          filtered = filtered.filter(log => log.severity === 'critical');
          break;
      }
    }

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(log => log.type === filterType);
    }

    // Severity filter
    if (filterSeverity !== 'all') {
      filtered = filtered.filter(log => log.severity === filterSeverity);
    }

    // User filter
    if (filterUser !== 'all') {
      filtered = filtered.filter(log =>
        getUserDisplayName(log).toLowerCase().includes(filterUser.toLowerCase())
      );
    }

    // Date range filter
    if (filterStartDate) {
      const startDate = startOfDay(parseISO(filterStartDate));
      filtered = filtered.filter(log => parseISO(log.timestamp) >= startDate);
    }
    if (filterEndDate) {
      const endDate = endOfDay(parseISO(filterEndDate));
      filtered = filtered.filter(log => parseISO(log.timestamp) <= endDate);
    }

    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(log =>
        log.action.toLowerCase().includes(query) ||
        log.description.toLowerCase().includes(query) ||
        getUserDisplayName(log).toLowerCase().includes(query)
      );
    }

    setFilteredLogs(filtered);
    setCurrentPage(1);
  };

  const toggleLogDetails = (logId) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  const handleClearFilters = () => {
    setFilterType('all');
    setFilterSeverity('all');
    setFilterUser('all');
    setFilterStartDate('');
    setFilterEndDate('');
    setSearchQuery('');
    setQuickFilter('all');
  };

  const handleExport = () => {
    let exportData = '';

    if (exportFormat === 'txt') {
      exportData = 'ACTIVITY LOGS REPORT\n\n';
      exportData += `Generated: ${format(new Date(), 'MMMM dd, yyyy h:mm:ss a')}\n`;
      exportData += `Total Logs: ${filteredLogs.length}\n\n`;
      exportData += '='.repeat(80) + '\n\n';

      filteredLogs.forEach((log, index) => {
        exportData += `${index + 1}. ${log.action}\n`;
        exportData += `   Time: ${format(parseISO(log.timestamp), 'MMM dd, yyyy h:mm:ss a')}\n`;
        exportData += `   User: ${getUserDisplayName(log)} (${getUserRole(log)})\n`;
        exportData += `   Description: ${log.description}\n`;
        exportData += `   Severity: ${log.severity.toUpperCase()}\n`;
        exportData += `   IP: ${log.ipAddress}\n`;
        if (log.details) {
          exportData += `   Details: ${JSON.stringify(log.details, null, 2)}\n`;
        }
        exportData += '\n' + '-'.repeat(80) + '\n\n';
      });
    } else if (exportFormat === 'csv') {
      exportData = 'ID,Action,Description,User,Role,Timestamp,Severity,IP Address\n';
      filteredLogs.forEach(log => {
        exportData += `${log.id},"${log.action}","${log.description}","${getUserDisplayName(log)}","${getUserRole(log)}","${format(parseISO(log.timestamp), 'yyyy-MM-dd h:mm:ss a')}","${log.severity}","${log.ipAddress}"\n`;
      });
    } else if (exportFormat === 'json') {
      exportData = JSON.stringify(filteredLogs, null, 2);
    }

    const blob = new Blob([exportData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-logs-${format(new Date(), 'yyyy-MM-dd')}.${exportFormat}`;
    a.click();
    URL.revokeObjectURL(url);

    setShowExportModal(false);
    showToast('Activity logs exported successfully!', 'success');
  };

  // Calculate summary
  const summary = {
    total: logs.length,
    today: logs.filter(log => {
      const logDate = startOfDay(parseISO(log.timestamp));
      const today = startOfDay(new Date());
      return logDate.getTime() === today.getTime();
    }).length,
    uniqueUsers: new Set(logs.map(log => getUserDisplayName(log))).size,
    critical: logs.filter(log => log.severity === 'critical').length
  };

  // Pagination
  const indexOfLastLog = currentPage * logsPerPage;
  const indexOfFirstLog = indexOfLastLog - logsPerPage;
  const currentLogs = filteredLogs.slice(indexOfFirstLog, indexOfLastLog);
  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);

  const getLogIcon = (type) => {
    const icons = {
      login: '🔓',
      logout: '🔒',
      create: '✨',
      update: '✏️',
      delete: '🗑️',
      transaction: '💳',
      system: '⚙️',
      error: '❌',
      security: '🛡️',
      service: '💆'
    };
    return icons[type] || '📝';
  };

  return (
    <div className="activity-logs-page">
      <div className="page-header">
        <div className="header-left">
          <h1>Activity Logs</h1>
          <p className="subtitle">Monitor system activities and user actions</p>
        </div>
        <div className="header-right">
          <button className="btn-refresh" onClick={fetchActivityLogs}>
            ↻ Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setShowExportModal(true)}>
            Export Logs
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="activity-summary-grid">
        <div className="activity-summary-card total">
          <div className="activity-summary-icon">📊</div>
          <div className="activity-summary-info">
            <div className="activity-summary-value">{summary.total}</div>
            <div className="activity-summary-label">Total Logs</div>
          </div>
        </div>
        <div className="activity-summary-card today">
          <div className="activity-summary-icon">📅</div>
          <div className="activity-summary-info">
            <div className="activity-summary-value">{summary.today}</div>
            <div className="activity-summary-label">Today's Activities</div>
          </div>
        </div>
        <div className="activity-summary-card users">
          <div className="activity-summary-icon">👥</div>
          <div className="activity-summary-info">
            <div className="activity-summary-value">{summary.uniqueUsers}</div>
            <div className="activity-summary-label">Active Users</div>
          </div>
        </div>
        <div className="activity-summary-card critical">
          <div className="activity-summary-icon">⚠️</div>
          <div className="activity-summary-info">
            <div className="activity-summary-value">{summary.critical}</div>
            <div className="activity-summary-label">Critical Events</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="activity-filters">
        <div className="quick-filters">
          <button
            className={`quick-filter-btn ${quickFilter === 'all' ? 'active' : ''}`}
            onClick={() => setQuickFilter('all')}
          >
            All Logs
          </button>
          <button
            className={`quick-filter-btn ${quickFilter === 'today' ? 'active' : ''}`}
            onClick={() => setQuickFilter('today')}
          >
            Today
          </button>
          <button
            className={`quick-filter-btn ${quickFilter === 'week' ? 'active' : ''}`}
            onClick={() => setQuickFilter('week')}
          >
            Last 7 Days
          </button>
          <button
            className={`quick-filter-btn ${quickFilter === 'critical' ? 'active' : ''}`}
            onClick={() => setQuickFilter('critical')}
          >
            Critical Only
          </button>
        </div>

        <div className="filters-row">
          <div className="filter-group">
            <label>Search</label>
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>Type</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="all">All Types</option>
              <option value="service">Service History</option>
              <option value="login">Login</option>
              <option value="logout">Logout</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="transaction">Transaction</option>
              <option value="system">System</option>
              <option value="error">Error</option>
              <option value="security">Security</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Severity</label>
            <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}>
              <option value="all">All Severities</option>
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Start Date</label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>End Date</label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="filter-actions">
          <button className="btn btn-sm btn-secondary" onClick={handleClearFilters}>
            Clear Filters
          </button>
        </div>
      </div>

      {/* Activity Logs List */}
      <div className="activity-logs-section">
        <div className="logs-header">
          <h2>Activity Timeline ({filteredLogs.length} logs)</h2>
          <button className="export-btn" onClick={() => setShowExportModal(true)}>
            📥 Export
          </button>
        </div>

        {loading ? (
          <div className="loading-logs">
            <div className="loading-spinner"></div>
            <p>Loading activity logs...</p>
          </div>
        ) : currentLogs.length === 0 ? (
          <div className="empty-activity-logs">
            <div className="empty-activity-icon">📭</div>
            <h3>No Activity Logs Found</h3>
            <p>No logs match your current filters.</p>
          </div>
        ) : (
          <>
            <div className="logs-list">
              {currentLogs.map(log => (
                <div key={log.id} className={`log-item ${log.severity}`}>
                  <div className={`log-icon ${log.type}`}>
                    {getLogIcon(log.type)}
                  </div>
                  <div className="log-content">
                    <div className="log-header-row">
                      <div className="log-title">
                        <div className="log-action">{log.action}</div>
                        <div className="log-description">{log.description}</div>
                      </div>
                      <div className="log-timestamp">
                        <div className="log-time">{format(parseISO(log.timestamp), 'h:mm:ss a')}</div>
                        <div className="log-date">{format(parseISO(log.timestamp), 'MMM dd, yyyy')}</div>
                        <span className={`log-severity-badge ${log.severity}`}>{log.severity}</span>
                      </div>
                    </div>
                    <div className="log-meta">
                      <div className="log-meta-item">
                        <span className="log-meta-icon">👤</span>
                        <span>{getUserDisplayName(log)} ({getUserRole(log)})</span>
                      </div>
                      <div className="log-meta-item">
                        <span className="log-meta-icon">🌐</span>
                        <span>{log.ipAddress}</span>
                      </div>
                      <div className="log-meta-item">
                        <span className="log-meta-icon">🏷️</span>
                        <span>{log.type}</span>
                      </div>
                    </div>
                    {log.details && (
                      <>
                        <div
                          className="log-details-toggle"
                          onClick={() => toggleLogDetails(log.id)}
                        >
                          {expandedLogs.has(log.id) ? '▼ Hide Details' : '▶ Show Details'}
                        </div>
                        {expandedLogs.has(log.id) && (
                          <div className="log-details-content">
                            {log.type === 'service' ? (
                              <div className="service-log-details">
                                <div className="service-detail-row">
                                  <span className="service-detail-label">Room:</span>
                                  <span>{log.details.roomName || 'N/A'}</span>
                                </div>
                                <div className="service-detail-row">
                                  <span className="service-detail-label">Therapist:</span>
                                  <span>{log.details.therapistName || 'N/A'}</span>
                                </div>
                                <div className="service-detail-row">
                                  <span className="service-detail-label">Customer:</span>
                                  <span>{log.details.customerName || 'N/A'}</span>
                                </div>
                                {log.details.customerPhone && (
                                  <div className="service-detail-row">
                                    <span className="service-detail-label">Phone:</span>
                                    <span>{log.details.customerPhone}</span>
                                  </div>
                                )}
                                <div className="service-detail-row">
                                  <span className="service-detail-label">Service(s):</span>
                                  <span>{log.details.serviceNames?.join(', ') || 'N/A'}</span>
                                </div>
                                <div className="service-detail-row">
                                  <span className="service-detail-label">Planned Duration:</span>
                                  <span>{log.details.plannedDuration || 0} min</span>
                                </div>
                                {log.details.actualDuration !== undefined && (
                                  <div className="service-detail-row">
                                    <span className="service-detail-label">Actual Duration:</span>
                                    <span>{log.details.actualDuration} min</span>
                                  </div>
                                )}
                                <div className="service-detail-row">
                                  <span className="service-detail-label">Status:</span>
                                  <span className={`service-status-badge ${log.details.status}`}>
                                    {log.details.status === 'started' && '▶️ Started'}
                                    {log.details.status === 'completed' && '✅ Completed'}
                                    {log.details.status === 'ended_early' && '⏹️ Ended Early'}
                                    {log.details.status === 'cancelled' && '❌ Cancelled'}
                                  </span>
                                </div>
                                {log.details.reason && (
                                  <div className="service-detail-row reason">
                                    <span className="service-detail-label">Reason:</span>
                                    <span>{log.details.reason}</span>
                                  </div>
                                )}
                                {log.details.startTime && (
                                  <div className="service-detail-row">
                                    <span className="service-detail-label">Start Time:</span>
                                    <span>{format(parseISO(log.details.startTime), 'h:mm:ss a')}</span>
                                  </div>
                                )}
                                {log.details.endTime && (
                                  <div className="service-detail-row">
                                    <span className="service-detail-label">End Time:</span>
                                    <span>{format(parseISO(log.details.endTime), 'h:mm:ss a')}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <pre>{JSON.stringify(log.details, null, 2)}</pre>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="logs-pagination">
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  ← Previous
                </button>
                <div className="pagination-info">
                  Page {currentPage} of {totalPages}
                </div>
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="export-modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="export-modal" onClick={(e) => e.stopPropagation()}>
            <div className="export-modal-header">
              <h3>Export Activity Logs</h3>
              <button className="export-modal-close" onClick={() => setShowExportModal(false)}>×</button>
            </div>
            <div className="export-modal-body">
              <div className="export-options">
                <div
                  className={`export-option ${exportFormat === 'txt' ? 'selected' : ''}`}
                  onClick={() => setExportFormat('txt')}
                >
                  <div className="export-option-icon">📄</div>
                  <div className="export-option-info">
                    <div className="export-option-title">Text File (.txt)</div>
                    <div className="export-option-desc">Human-readable text format</div>
                  </div>
                  <div className="export-option-check">{exportFormat === 'txt' && '✓'}</div>
                </div>
                <div
                  className={`export-option ${exportFormat === 'csv' ? 'selected' : ''}`}
                  onClick={() => setExportFormat('csv')}
                >
                  <div className="export-option-icon">📊</div>
                  <div className="export-option-info">
                    <div className="export-option-title">CSV File (.csv)</div>
                    <div className="export-option-desc">Spreadsheet compatible format</div>
                  </div>
                  <div className="export-option-check">{exportFormat === 'csv' && '✓'}</div>
                </div>
                <div
                  className={`export-option ${exportFormat === 'json' ? 'selected' : ''}`}
                  onClick={() => setExportFormat('json')}
                >
                  <div className="export-option-icon">🔧</div>
                  <div className="export-option-info">
                    <div className="export-option-title">JSON File (.json)</div>
                    <div className="export-option-desc">Structured data format</div>
                  </div>
                  <div className="export-option-check">{exportFormat === 'json' && '✓'}</div>
                </div>
              </div>
            </div>
            <div className="export-modal-footer">
              <button className="btn btn-cancel" onClick={() => setShowExportModal(false)}>
                Cancel
              </button>
              <button className="btn btn-export" onClick={handleExport}>
                Export {filteredLogs.length} Logs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityLogs;
