import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { format, parseISO, subDays, startOfDay, endOfDay } from 'date-fns';

const ActivityLogs = () => {
  const { showToast } = useApp();
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
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mock activity logs
      const mockLogs = [
        {
          id: 1,
          type: 'login',
          action: 'User Login',
          description: 'Maria Santos logged into the system',
          user: { firstName: 'Maria', lastName: 'Santos', role: 'Cashier' },
          timestamp: new Date().toISOString(),
          severity: 'info',
          ipAddress: '192.168.1.100',
          details: { method: 'Email/Password', device: 'Chrome on Windows' }
        },
        {
          id: 2,
          type: 'create',
          action: 'Customer Created',
          description: 'New customer "John Smith" added to the system',
          user: { firstName: 'Anna', lastName: 'Cruz', role: 'Receptionist' },
          timestamp: subDays(new Date(), 0).toISOString(),
          severity: 'success',
          ipAddress: '192.168.1.101',
          details: { customerId: 'CUST-1234', customerName: 'John Smith', email: 'john@example.com' }
        },
        {
          id: 3,
          type: 'update',
          action: 'Product Price Updated',
          description: 'Updated price for "Swedish Massage (60 min)" from ₱800 to ₱850',
          user: { firstName: 'Admin', lastName: 'User', role: 'Administrator' },
          timestamp: subDays(new Date(), 0).toISOString(),
          severity: 'info',
          ipAddress: '192.168.1.1',
          details: { productId: 'PROD-101', oldPrice: 800, newPrice: 850 }
        },
        {
          id: 4,
          type: 'delete',
          action: 'Appointment Cancelled',
          description: 'Appointment #APT-5678 cancelled by customer request',
          user: { firstName: 'Maria', lastName: 'Santos', role: 'Cashier' },
          timestamp: subDays(new Date(), 0).toISOString(),
          severity: 'warning',
          ipAddress: '192.168.1.100',
          details: { appointmentId: 'APT-5678', reason: 'Customer requested cancellation', refundAmount: 500 }
        },
        {
          id: 5,
          type: 'transaction',
          action: 'Sale Completed',
          description: 'Sale transaction of ₱2,450 completed at POS',
          user: { firstName: 'Maria', lastName: 'Santos', role: 'Cashier' },
          timestamp: subDays(new Date(), 1).toISOString(),
          severity: 'success',
          ipAddress: '192.168.1.100',
          details: { transactionId: 'TXN-9012', amount: 2450, items: 3, paymentMethod: 'Cash' }
        },
        {
          id: 6,
          type: 'update',
          action: 'Employee Attendance Updated',
          description: 'Clock-out time adjusted for John Doe',
          user: { firstName: 'Admin', lastName: 'User', role: 'Administrator' },
          timestamp: subDays(new Date(), 1).toISOString(),
          severity: 'info',
          ipAddress: '192.168.1.1',
          details: { employeeId: 'EMP-003', date: '2025-01-20', oldClockOut: '17:00', newClockOut: '17:15', reason: 'Overtime adjustment' }
        },
        {
          id: 7,
          type: 'system',
          action: 'System Backup Completed',
          description: 'Automated daily backup completed successfully',
          user: { firstName: 'System', lastName: 'Automation', role: 'System' },
          timestamp: subDays(new Date(), 1).toISOString(),
          severity: 'success',
          ipAddress: 'localhost',
          details: { backupSize: '245 MB', duration: '3.5 minutes', location: '/backups/2025-01-20.zip' }
        },
        {
          id: 8,
          type: 'error',
          action: 'Payment Processing Failed',
          description: 'Credit card payment failed - insufficient funds',
          user: { firstName: 'Maria', lastName: 'Santos', role: 'Cashier' },
          timestamp: subDays(new Date(), 2).toISOString(),
          severity: 'critical',
          ipAddress: '192.168.1.100',
          details: { transactionId: 'TXN-9013', amount: 1200, errorCode: 'INSUFFICIENT_FUNDS', cardLast4: '4242' }
        },
        {
          id: 9,
          type: 'logout',
          action: 'User Logout',
          description: 'John Doe logged out of the system',
          user: { firstName: 'John', lastName: 'Doe', role: 'Therapist' },
          timestamp: subDays(new Date(), 2).toISOString(),
          severity: 'info',
          ipAddress: '192.168.1.102',
          details: { sessionDuration: '8 hours 15 minutes' }
        },
        {
          id: 10,
          type: 'create',
          action: 'Expense Recorded',
          description: 'New expense "Office Supplies" recorded for ₱1,500',
          user: { firstName: 'Admin', lastName: 'User', role: 'Administrator' },
          timestamp: subDays(new Date(), 3).toISOString(),
          severity: 'info',
          ipAddress: '192.168.1.1',
          details: { expenseId: 'EXP-456', category: 'Office Supplies', amount: 1500, vendor: 'ABC Office Mart' }
        },
        {
          id: 11,
          type: 'security',
          action: 'Failed Login Attempt',
          description: 'Multiple failed login attempts detected from IP 203.45.67.89',
          user: { firstName: 'Unknown', lastName: 'User', role: 'N/A' },
          timestamp: subDays(new Date(), 3).toISOString(),
          severity: 'critical',
          ipAddress: '203.45.67.89',
          details: { attempts: 5, username: 'admin', action: 'Account temporarily locked' }
        },
        {
          id: 12,
          type: 'update',
          action: 'Room Status Changed',
          description: 'Room 3 status changed from "Occupied" to "Available"',
          user: { firstName: 'Anna', lastName: 'Cruz', role: 'Receptionist' },
          timestamp: subDays(new Date(), 4).toISOString(),
          severity: 'info',
          ipAddress: '192.168.1.101',
          details: { roomId: 'ROOM-003', oldStatus: 'Occupied', newStatus: 'Available' }
        }
      ];

      setLogs(mockLogs);
    } catch (error) {
      showToast('Failed to load activity logs', 'error');
    } finally {
      setLoading(false);
    }
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
        `${log.user.firstName} ${log.user.lastName}`.toLowerCase().includes(filterUser.toLowerCase())
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
        `${log.user.firstName} ${log.user.lastName}`.toLowerCase().includes(query)
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
      exportData += `Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm:ss')}\n`;
      exportData += `Total Logs: ${filteredLogs.length}\n\n`;
      exportData += '='.repeat(80) + '\n\n';

      filteredLogs.forEach((log, index) => {
        exportData += `${index + 1}. ${log.action}\n`;
        exportData += `   Time: ${format(parseISO(log.timestamp), 'MMM dd, yyyy HH:mm:ss')}\n`;
        exportData += `   User: ${log.user.firstName} ${log.user.lastName} (${log.user.role})\n`;
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
        exportData += `${log.id},"${log.action}","${log.description}","${log.user.firstName} ${log.user.lastName}","${log.user.role}","${format(parseISO(log.timestamp), 'yyyy-MM-dd HH:mm:ss')}","${log.severity}","${log.ipAddress}"\n`;
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
    uniqueUsers: new Set(logs.map(log => `${log.user.firstName} ${log.user.lastName}`)).size,
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
      security: '🛡️'
    };
    return icons[type] || '📝';
  };

  return (
    <div className="activity-logs-page">
      <div className="page-header">
        <div>
          <h1>Activity Logs</h1>
          <p>Monitor system activities and user actions</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowExportModal(true)}>
          📥 Export Logs
        </button>
      </div>

      {/* Summary Cards */}
      <div className="activity-summary-grid">
        <div className="activity-summary-card total">
          <div className="activity-summary-icon">📊</div>
          <div className="activity-summary-value">{summary.total}</div>
          <div className="activity-summary-label">Total Logs</div>
        </div>
        <div className="activity-summary-card today">
          <div className="activity-summary-icon">📅</div>
          <div className="activity-summary-value">{summary.today}</div>
          <div className="activity-summary-label">Today's Activities</div>
        </div>
        <div className="activity-summary-card users">
          <div className="activity-summary-icon">👥</div>
          <div className="activity-summary-value">{summary.uniqueUsers}</div>
          <div className="activity-summary-label">Active Users</div>
        </div>
        <div className="activity-summary-card critical">
          <div className="activity-summary-icon">⚠️</div>
          <div className="activity-summary-value">{summary.critical}</div>
          <div className="activity-summary-label">Critical Events</div>
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
          <h2>Activity Timeline</h2>
          <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>
            Showing {indexOfFirstLog + 1}-{Math.min(indexOfLastLog, filteredLogs.length)} of {filteredLogs.length} logs
          </div>
        </div>

        {loading ? (
          <div className="loading-logs">
            <div className="spinner" style={{ margin: '0 auto' }}></div>
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
                        <div className="log-time">{format(parseISO(log.timestamp), 'HH:mm:ss')}</div>
                        <div className="log-date">{format(parseISO(log.timestamp), 'MMM dd, yyyy')}</div>
                        <span className={`log-severity-badge ${log.severity}`}>{log.severity}</span>
                      </div>
                    </div>
                    <div className="log-meta">
                      <div className="log-meta-item">
                        <span className="log-meta-icon">👤</span>
                        <span>{log.user.firstName} {log.user.lastName} ({log.user.role})</span>
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
                            {JSON.stringify(log.details, null, 2)}
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
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="modal-content export-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Export Activity Logs</h2>
            <p>Select export format:</p>
            <div className="export-options">
              <div
                className={`export-option ${exportFormat === 'txt' ? 'selected' : ''}`}
                onClick={() => setExportFormat('txt')}
              >
                <div className="export-option-icon">📄</div>
                <div className="export-option-info">
                  <div className="export-option-title">Text File (.txt)</div>
                  <div className="export-option-desc">Human-readable text format with full details</div>
                </div>
              </div>
              <div
                className={`export-option ${exportFormat === 'csv' ? 'selected' : ''}`}
                onClick={() => setExportFormat('csv')}
              >
                <div className="export-option-icon">📊</div>
                <div className="export-option-info">
                  <div className="export-option-title">CSV File (.csv)</div>
                  <div className="export-option-desc">Spreadsheet format for Excel or Google Sheets</div>
                </div>
              </div>
              <div
                className={`export-option ${exportFormat === 'json' ? 'selected' : ''}`}
                onClick={() => setExportFormat('json')}
              >
                <div className="export-option-icon">🔧</div>
                <div className="export-option-info">
                  <div className="export-option-title">JSON File (.json)</div>
                  <div className="export-option-desc">Structured data format for technical analysis</div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end', marginTop: 'var(--spacing-lg)' }}>
              <button className="btn btn-secondary" onClick={() => setShowExportModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleExport}>
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
