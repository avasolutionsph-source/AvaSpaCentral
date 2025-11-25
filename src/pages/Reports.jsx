import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi/mockApi';
import { format, subDays, startOfMonth, endOfMonth, differenceInDays, parseISO, isSameDay, startOfWeek, endOfWeek } from 'date-fns';
import { Line, Bar, Doughnut, Pie } from 'react-chartjs-2';

const Reports = () => {
  const { showToast, user, isTherapist, canViewAll } = useApp();

  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  // Real data state
  const [transactions, setTransactions] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [products, setProducts] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [advanceBookings, setAdvanceBookings] = useState([]);

  // Computed report data
  const [reportData, setReportData] = useState(null);

  const reportCategories = [
    {
      id: 'financial',
      title: 'Financial Reports',
      icon: '💰',
      description: 'Revenue, expenses, profit & loss statements',
      count: 4
    },
    {
      id: 'operations',
      title: 'Operations Reports',
      icon: '📊',
      description: 'Services, appointments, and room utilization',
      count: 5
    },
    {
      id: 'employee',
      title: 'Employee Reports',
      icon: '👥',
      description: 'Performance, attendance, and payroll reports',
      count: 6
    },
    {
      id: 'customer',
      title: 'Customer Reports',
      icon: '👤',
      description: 'Customer insights, retention, and loyalty',
      count: 3
    }
  ];

  const reports = {
    financial: [
      { id: 'pl', name: 'Profit & Loss Statement', icon: '📈' },
      { id: 'revenue', name: 'Revenue Analysis', icon: '💵' },
      { id: 'expenses', name: 'Expense Breakdown', icon: '💸' },
      { id: 'cashflow', name: 'Cash Flow Report', icon: '💰' }
    ],
    operations: [
      { id: 'services', name: 'Service Performance', icon: '🛍️' },
      { id: 'appointments', name: 'Appointment Analytics', icon: '📅' },
      { id: 'rooms', name: 'Room Utilization', icon: '🚪' },
      { id: 'inventory', name: 'Inventory Turnover', icon: '📦' },
      { id: 'daily', name: 'Daily Operations Summary', icon: '📋' }
    ],
    employee: [
      { id: 'performance', name: 'Employee Performance', icon: '⭐' },
      { id: 'attendance', name: 'Attendance Report', icon: '⏰' },
      { id: 'payroll', name: 'Payroll Summary', icon: '💰' },
      { id: 'commission', name: 'Commission Report', icon: '💵' },
      { id: 'schedule', name: 'Schedule Analysis', icon: '📆' },
      { id: 'productivity', name: 'Productivity Metrics', icon: '📊' }
    ],
    customer: [
      { id: 'insights', name: 'Customer Insights', icon: '🔍' },
      { id: 'retention', name: 'Retention Analysis', icon: '🔄' },
      { id: 'loyalty', name: 'Loyalty Program Report', icon: '🎁' }
    ]
  };

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (selectedReport && selectedCategory) {
      generateReportData();
    }
  }, [selectedReport, selectedCategory, startDate, endDate, transactions, employees, attendance, products, rooms, customers, appointments, advanceBookings]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [txns, emps, attn, prods, rms, custs, appts, advBookings] = await Promise.all([
        mockApi.transactions.getTransactions(),
        mockApi.employees.getEmployees(),
        mockApi.attendance.getAttendance(),
        mockApi.products.getProducts(),
        mockApi.rooms.getRooms(),
        mockApi.customers.getCustomers(),
        mockApi.appointments.getAppointments(),
        mockApi.advanceBooking.listAdvanceBookings()
      ]);

      setTransactions(txns);
      setEmployees(emps);
      setAttendance(attn);
      setProducts(prods);
      setRooms(rms);
      setCustomers(custs);
      setAppointments(appts);
      setAdvanceBookings(advBookings);
      setLoading(false);
    } catch (error) {
      showToast('Failed to load report data', 'error');
      setLoading(false);
    }
  };

  const filterByDateRange = (items, dateField = 'createdAt') => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return items.filter(item => {
      const itemDate = new Date(item[dateField]);
      return itemDate >= start && itemDate <= end;
    });
  };

  const generateReportData = () => {
    const filteredTransactions = filterByDateRange(transactions, 'createdAt');
    const filteredAttendance = filterByDateRange(attendance, 'date');
    const filteredAppointments = filterByDateRange(appointments, 'dateTime');
    const filteredAdvanceBookings = filterByDateRange(advanceBookings, 'bookingDateTime');

    let data = {};

    switch (selectedCategory) {
      case 'financial':
        data = generateFinancialData(filteredTransactions);
        break;
      case 'operations':
        data = generateOperationsData(filteredTransactions, filteredAppointments, filteredAdvanceBookings);
        break;
      case 'employee':
        data = generateEmployeeData(filteredTransactions, filteredAttendance);
        break;
      case 'customer':
        data = generateCustomerData(filteredTransactions);
        break;
    }

    setReportData(data);
  };

  const generateFinancialData = (txns) => {
    const totalRevenue = txns.reduce((sum, t) => sum + (t.total || 0), 0);
    const totalExpenses = 180000; // Mock - would come from expenses API
    const profit = totalRevenue - totalExpenses;
    const margin = totalRevenue > 0 ? ((profit / totalRevenue) * 100) : 0;

    const revenueByDay = {};
    txns.forEach(t => {
      const day = format(new Date(t.createdAt), 'yyyy-MM-dd');
      revenueByDay[day] = (revenueByDay[day] || 0) + t.total;
    });

    const revenueByPaymentMethod = {};
    txns.forEach(t => {
      revenueByPaymentMethod[t.paymentMethod] = (revenueByPaymentMethod[t.paymentMethod] || 0) + t.total;
    });

    return {
      totalRevenue,
      totalExpenses,
      profit,
      margin: margin.toFixed(2),
      avgTransaction: txns.length > 0 ? (totalRevenue / txns.length) : 0,
      transactionCount: txns.length,
      revenueByDay,
      revenueByPaymentMethod,
      topServices: calculateTopServices(txns),
      revenueBreakdown: {
        services: totalRevenue * 0.85,
        products: totalRevenue * 0.10,
        giftCertificates: totalRevenue * 0.05
      },
      expenseBreakdown: {
        payroll: totalExpenses * 0.63,
        supplies: totalExpenses * 0.16,
        utilities: totalExpenses * 0.09,
        rent: totalExpenses * 0.11,
        other: totalExpenses * 0.01
      }
    };
  };

  const generateOperationsData = (txns, appts, advBookings) => {
    const services = products.filter(p => p.type === 'service');
    const servicePerformance = {};

    txns.forEach(t => {
      t.items?.forEach(item => {
        if (!servicePerformance[item.name]) {
          servicePerformance[item.name] = {
            name: item.name,
            count: 0,
            revenue: 0
          };
        }
        servicePerformance[item.name].count += item.quantity;
        servicePerformance[item.name].revenue += item.price * item.quantity;
      });
    });

    const roomUtilization = {};
    rooms.forEach(room => {
      const roomBookings = advBookings.filter(b => b.roomId === room._id);
      roomUtilization[room.name] = {
        name: room.name,
        bookings: roomBookings.length,
        utilization: Math.min(100, (roomBookings.length / differenceInDays(new Date(endDate), new Date(startDate))) * 10)
      };
    });

    return {
      totalAppointments: appts.length + advBookings.length,
      completedServices: txns.reduce((sum, t) => sum + (t.items?.length || 0), 0),
      servicePerformance: Object.values(servicePerformance).sort((a, b) => b.revenue - a.revenue),
      roomUtilization: Object.values(roomUtilization),
      avgServiceDuration: 75, // Mock
      appointmentsByDay: calculateAppointmentsByDay(appts, advBookings),
      bookingSourceBreakdown: calculateBookingSourceBreakdown(appts)
    };
  };

  const generateEmployeeData = (txns, attn) => {
    const employeePerformance = {};

    employees.forEach(emp => {
      employeePerformance[emp._id] = {
        id: emp._id,
        name: `${emp.firstName} ${emp.lastName}`,
        role: emp.position,
        services: 0,
        revenue: 0,
        commission: 0,
        rating: 4.5 + Math.random() * 0.5,
        attendance: 0,
        totalDays: 0,
        hoursWorked: 0
      };
    });

    txns.forEach(t => {
      t.items?.forEach(item => {
        if (item.employee && employeePerformance[item.employee]) {
          employeePerformance[item.employee].services += item.quantity;
          employeePerformance[item.employee].revenue += item.price * item.quantity;
          employeePerformance[item.employee].commission += (item.price * item.quantity) * 0.10;
        }
      });
    });

    attn.forEach(a => {
      if (employeePerformance[a.employee]) {
        employeePerformance[a.employee].totalDays++;
        if (a.clockIn) {
          employeePerformance[a.employee].attendance++;
          if (a.clockIn && a.clockOut) {
            const clockIn = new Date(`${a.date}T${a.clockIn}`);
            const clockOut = new Date(`${a.date}T${a.clockOut}`);
            const hours = (clockOut - clockIn) / (1000 * 60 * 60);
            employeePerformance[a.employee].hoursWorked += hours;
          }
        }
      }
    });

    Object.values(employeePerformance).forEach(emp => {
      emp.attendance = emp.totalDays > 0 ? Math.round((emp.attendance / emp.totalDays) * 100) : 0;
    });

    return {
      employeePerformance: Object.values(employeePerformance).sort((a, b) => b.revenue - a.revenue),
      totalEmployees: employees.length,
      activeEmployees: employees.filter(e => e.active).length,
      avgAttendanceRate: Object.values(employeePerformance).reduce((sum, e) => sum + e.attendance, 0) / employees.length,
      topPerformer: Object.values(employeePerformance).sort((a, b) => b.revenue - a.revenue)[0]
    };
  };

  const generateCustomerData = (txns) => {
    const customerStats = {};

    txns.forEach(t => {
      if (t.customer?.name) {
        if (!customerStats[t.customer.name]) {
          customerStats[t.customer.name] = {
            name: t.customer.name,
            phone: t.customer.phone,
            visits: 0,
            spent: 0,
            lastVisit: t.createdAt,
            firstVisit: t.createdAt
          };
        }
        customerStats[t.customer.name].visits++;
        customerStats[t.customer.name].spent += t.total;
        if (new Date(t.createdAt) > new Date(customerStats[t.customer.name].lastVisit)) {
          customerStats[t.customer.name].lastVisit = t.createdAt;
        }
        if (new Date(t.createdAt) < new Date(customerStats[t.customer.name].firstVisit)) {
          customerStats[t.customer.name].firstVisit = t.createdAt;
        }
      }
    });

    const uniqueCustomers = Object.keys(customerStats).length;
    const returningCustomers = Object.values(customerStats).filter(c => c.visits > 1).length;
    const newCustomers = uniqueCustomers - returningCustomers;
    const totalSpent = Object.values(customerStats).reduce((sum, c) => sum + c.spent, 0);
    const avgSpend = uniqueCustomers > 0 ? (totalSpent / uniqueCustomers) : 0;

    return {
      totalCustomers: uniqueCustomers,
      newCustomers,
      returningCustomers,
      avgSpend,
      retentionRate: uniqueCustomers > 0 ? Math.round((returningCustomers / uniqueCustomers) * 100) : 0,
      topCustomers: Object.values(customerStats).sort((a, b) => b.spent - a.spent).slice(0, 10),
      customersByVisits: Object.values(customerStats).reduce((acc, c) => {
        const visits = c.visits;
        acc[visits] = (acc[visits] || 0) + 1;
        return acc;
      }, {})
    };
  };

  const calculateTopServices = (txns) => {
    const services = {};
    txns.forEach(t => {
      t.items?.forEach(item => {
        if (!services[item.name]) {
          services[item.name] = { name: item.name, revenue: 0, count: 0 };
        }
        services[item.name].revenue += item.price * item.quantity;
        services[item.name].count += item.quantity;
      });
    });
    return Object.values(services).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  };

  const calculateAppointmentsByDay = (appts, advBookings) => {
    const byDay = {};
    [...appts, ...advBookings].forEach(a => {
      const day = format(new Date(a.dateTime || a.bookingDateTime), 'yyyy-MM-dd');
      byDay[day] = (byDay[day] || 0) + 1;
    });
    return byDay;
  };

  const calculateBookingSourceBreakdown = (appts) => {
    const sources = {};
    appts.forEach(a => {
      sources[a.bookingSource || 'walk-in'] = (sources[a.bookingSource || 'walk-in'] || 0) + 1;
    });
    return sources;
  };

  const setDateRange = (range) => {
    const today = new Date();
    switch (range) {
      case 'today':
        setStartDate(format(today, 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case 'week':
        setStartDate(format(subDays(today, 7), 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case 'month':
        setStartDate(format(startOfMonth(today), 'yyyy-MM-dd'));
        setEndDate(format(endOfMonth(today), 'yyyy-MM-dd'));
        break;
      case 'quarter':
        setStartDate(format(subDays(today, 90), 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case 'year':
        setStartDate(format(subDays(today, 365), 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
    }
  };

  const handleExportPDF = () => {
    showToast('PDF export feature coming soon!', 'info');
  };

  const handleExportCSV = () => {
    if (!reportData) {
      showToast('Please generate a report first', 'error');
      return;
    }

    let csv = '';
    const reportName = selectedReport ? reports[selectedCategory].find(r => r.id === selectedReport)?.name : 'Report';

    csv += `${reportName}\nPeriod: ${startDate} to ${endDate}\n\n`;

    if (selectedCategory === 'financial' && selectedReport === 'pl') {
      csv += 'Category,Amount\n';
      csv += `Total Revenue,₱${reportData.totalRevenue.toLocaleString()}\n`;
      csv += `Total Expenses,₱${reportData.totalExpenses.toLocaleString()}\n`;
      csv += `Net Profit,₱${reportData.profit.toLocaleString()}\n`;
      csv += `Profit Margin,${reportData.margin}%\n`;
    } else if (selectedCategory === 'employee' && selectedReport === 'performance') {
      csv += 'Employee,Role,Services,Revenue,Commission,Rating,Attendance\n';
      reportData.employeePerformance.forEach(emp => {
        csv += `"${emp.name}","${emp.role}",${emp.services},₱${emp.revenue.toLocaleString()},₱${emp.commission.toLocaleString()},${emp.rating.toFixed(1)},${emp.attendance}%\n`;
      });
    } else if (selectedCategory === 'customer' && selectedReport === 'insights') {
      csv += 'Customer,Visits,Total Spent,Last Visit\n';
      reportData.topCustomers.forEach(c => {
        csv += `"${c.name}",${c.visits},₱${c.spent.toLocaleString()},"${format(new Date(c.lastVisit), 'yyyy-MM-dd')}"\n`;
      });
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportName.toLowerCase().replace(/ /g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('Report exported successfully!', 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  const renderFinancialReport = () => {
    if (!reportData) return <div className="empty-report"><p>Generating report...</p></div>;

    if (selectedReport === 'pl') {
      return (
        <div className="report-content">
          <div className="pl-statement">
            <div className="pl-section">
              <h3 className="pl-section-title">Revenue</h3>
              <div className="pl-line">
                <span className="pl-label">Service Revenue</span>
                <span className="pl-value">₱{reportData.revenueBreakdown.services.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="pl-line">
                <span className="pl-label">Product Sales</span>
                <span className="pl-value">₱{reportData.revenueBreakdown.products.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="pl-line">
                <span className="pl-label">Gift Certificates</span>
                <span className="pl-value">₱{reportData.revenueBreakdown.giftCertificates.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="pl-line total">
                <span className="pl-label">Total Revenue</span>
                <span className="pl-value positive">₱{reportData.totalRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="pl-section">
              <h3 className="pl-section-title">Expenses</h3>
              <div className="pl-line">
                <span className="pl-label">Payroll & Benefits</span>
                <span className="pl-value">₱{reportData.expenseBreakdown.payroll.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="pl-line">
                <span className="pl-label">Supplies & Materials</span>
                <span className="pl-value">₱{reportData.expenseBreakdown.supplies.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="pl-line">
                <span className="pl-label">Utilities</span>
                <span className="pl-value">₱{reportData.expenseBreakdown.utilities.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="pl-line">
                <span className="pl-label">Rent</span>
                <span className="pl-value">₱{reportData.expenseBreakdown.rent.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="pl-line">
                <span className="pl-label">Other Expenses</span>
                <span className="pl-value">₱{reportData.expenseBreakdown.other.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="pl-line total">
                <span className="pl-label">Total Expenses</span>
                <span className="pl-value negative">₱{reportData.totalExpenses.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="pl-line grand-total">
              <span className="pl-label">Net Profit</span>
              <span className="pl-value positive">₱{reportData.profit.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="pl-line">
              <span className="pl-label">Profit Margin</span>
              <span className="pl-value">{reportData.margin}%</span>
            </div>
          </div>

          <div className="charts-section">
            <div className="chart-card">
              <h3>Revenue by Payment Method</h3>
              <div className="chart-container-small">
                {reportData.revenueByPaymentMethod && (
                  <Doughnut
                    data={{
                      labels: Object.keys(reportData.revenueByPaymentMethod),
                      datasets: [{
                        data: Object.values(reportData.revenueByPaymentMethod),
                        backgroundColor: ['#8b5cf6', '#10b981', '#f59e0b', '#3b82f6']
                      }]
                    }}
                    options={{ responsive: true, maintainAspectRatio: true }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      );
    } else if (selectedReport === 'revenue') {
      const revenueChartData = {
        labels: Object.keys(reportData.revenueByDay || {}).slice(-30),
        datasets: [{
          label: 'Daily Revenue',
          data: Object.values(reportData.revenueByDay || {}).slice(-30),
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          tension: 0.4
        }]
      };

      return (
        <div className="report-content">
          <div className="financial-summary">
            <div className="financial-card revenue">
              <div className="financial-label">Total Revenue</div>
              <div className="financial-value positive">₱{reportData.totalRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
              <div className="financial-meta">
                {reportData.transactionCount} transactions
              </div>
            </div>
            <div className="financial-card">
              <div className="financial-label">Average Transaction</div>
              <div className="financial-value">₱{reportData.avgTransaction.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="financial-card">
              <div className="financial-label">Daily Average</div>
              <div className="financial-value">₱{(reportData.totalRevenue / differenceInDays(new Date(endDate), new Date(startDate))).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>

          <div className="chart-card">
            <h3>Revenue Trend</h3>
            <div className="chart-container">
              <Line data={revenueChartData} options={{ responsive: true, maintainAspectRatio: false }} />
            </div>
          </div>

          <div className="top-performers">
            <h3>Top Services by Revenue</h3>
            <table className="performers-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Service</th>
                  <th className="right">Count</th>
                  <th className="right">Revenue</th>
                  <th className="right">Avg Price</th>
                </tr>
              </thead>
              <tbody>
                {reportData.topServices?.map((service, index) => (
                  <tr key={index}>
                    <td>
                      <span className={`rank-badge ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : 'default'}`}>
                        {index + 1}
                      </span>
                    </td>
                    <td>{service.name}</td>
                    <td className="right">{service.count}</td>
                    <td className="right">₱{service.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    <td className="right">₱{(service.revenue / service.count).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    return (
      <div className="report-content">
        <div className="financial-summary">
          <div className="financial-card revenue">
            <div className="financial-label">Total Revenue</div>
            <div className="financial-value positive">₱{reportData.totalRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="financial-card expenses">
            <div className="financial-label">Total Expenses</div>
            <div className="financial-value negative">₱{reportData.totalExpenses.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="financial-card profit">
            <div className="financial-label">Net Profit</div>
            <div className="financial-value positive">₱{reportData.profit.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="financial-card margin">
            <div className="financial-label">Profit Margin</div>
            <div className="financial-value">{reportData.margin}%</div>
          </div>
        </div>
      </div>
    );
  };

  const renderOperationsReport = () => {
    if (!reportData) return <div className="empty-report"><p>Generating report...</p></div>;

    if (selectedReport === 'services') {
      const serviceChartData = {
        labels: reportData.servicePerformance?.slice(0, 10).map(s => s.name) || [],
        datasets: [{
          label: 'Revenue',
          data: reportData.servicePerformance?.slice(0, 10).map(s => s.revenue) || [],
          backgroundColor: '#8b5cf6'
        }]
      };

      return (
        <div className="report-content">
          <div className="operations-summary">
            <div className="ops-card">
              <div className="ops-icon">📊</div>
              <div className="ops-value">{reportData.completedServices}</div>
              <div className="ops-label">Total Services</div>
            </div>
            <div className="ops-card">
              <div className="ops-icon">⏱️</div>
              <div className="ops-value">{reportData.avgServiceDuration}m</div>
              <div className="ops-label">Avg Duration</div>
            </div>
          </div>

          <div className="chart-card">
            <h3>Top Services by Revenue</h3>
            <div className="chart-container">
              <Bar
                data={serviceChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  indexAxis: 'y'
                }}
              />
            </div>
          </div>

          <div className="top-performers">
            <h3>Service Performance Details</h3>
            <table className="performers-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th className="right">Count</th>
                  <th className="right">Revenue</th>
                  <th className="right">Avg Price</th>
                </tr>
              </thead>
              <tbody>
                {reportData.servicePerformance?.map((service, index) => (
                  <tr key={index}>
                    <td>{service.name}</td>
                    <td className="right">{service.count}</td>
                    <td className="right">₱{service.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    <td className="right">₱{(service.revenue / service.count).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    } else if (selectedReport === 'rooms') {
      return (
        <div className="report-content">
          <div className="top-performers">
            <h3>Room Utilization Report</h3>
            <table className="performers-table">
              <thead>
                <tr>
                  <th>Room</th>
                  <th className="right">Bookings</th>
                  <th className="right">Utilization</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {reportData.roomUtilization?.map((room, index) => (
                  <tr key={index}>
                    <td>{room.name}</td>
                    <td className="right">{room.bookings}</td>
                    <td className="right">{room.utilization.toFixed(1)}%</td>
                    <td>
                      <span className={`utilization-badge ${room.utilization > 80 ? 'high' : room.utilization > 50 ? 'medium' : 'low'}`}>
                        {room.utilization > 80 ? 'High' : room.utilization > 50 ? 'Medium' : 'Low'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    return (
      <div className="report-content">
        <div className="operations-summary">
          <div className="ops-card">
            <div className="ops-icon">📅</div>
            <div className="ops-value">{reportData.totalAppointments}</div>
            <div className="ops-label">Total Appointments</div>
          </div>
          <div className="ops-card">
            <div className="ops-icon">✅</div>
            <div className="ops-value">{reportData.completedServices}</div>
            <div className="ops-label">Completed Services</div>
          </div>
        </div>
      </div>
    );
  };

  const renderEmployeeReport = () => {
    if (!reportData) return <div className="empty-report"><p>Generating report...</p></div>;

    if (selectedReport === 'performance') {
      return (
        <div className="report-content">
          <div className="employee-summary">
            <div className="employee-summary-card">
              <div className="summary-icon">👥</div>
              <div className="summary-value">{reportData.totalEmployees}</div>
              <div className="summary-label">Total Employees</div>
            </div>
            <div className="employee-summary-card">
              <div className="summary-icon">✅</div>
              <div className="summary-value">{reportData.activeEmployees}</div>
              <div className="summary-label">Active Employees</div>
            </div>
            <div className="employee-summary-card">
              <div className="summary-icon">⏰</div>
              <div className="summary-value">{reportData.avgAttendanceRate.toFixed(1)}%</div>
              <div className="summary-label">Avg Attendance</div>
            </div>
            <div className="employee-summary-card">
              <div className="summary-icon">⭐</div>
              <div className="summary-value">{reportData.topPerformer?.name.split(' ')[0]}</div>
              <div className="summary-label">Top Performer</div>
            </div>
          </div>

          <div className="top-performers">
            <h3>Employee Performance Rankings</h3>
            <table className="performers-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Employee</th>
                  <th>Role</th>
                  <th className="right">Services</th>
                  <th className="right">Revenue</th>
                  <th className="right">Commission</th>
                  <th className="right">Hours</th>
                  <th className="right">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {reportData.employeePerformance?.map((emp, index) => (
                  <tr key={emp.id}>
                    <td>
                      <span className={`rank-badge ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : 'default'}`}>
                        {index + 1}
                      </span>
                    </td>
                    <td>{emp.name}</td>
                    <td>{emp.role}</td>
                    <td className="right">{emp.services}</td>
                    <td className="right">₱{emp.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    <td className="right">₱{emp.commission.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    <td className="right">{emp.hoursWorked.toFixed(1)}h</td>
                    <td className="right">{emp.attendance}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    return (
      <div className="report-content">
        <div className="employee-performance-grid">
          {reportData.employeePerformance?.slice(0, 6).map((emp, index) => (
            <div key={emp.id} className="employee-performance-card">
              <div className="employee-header">
                <div className="employee-avatar">
                  {emp.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="employee-info">
                  <div className="employee-name">{emp.name}</div>
                  <div className="employee-role">{emp.role}</div>
                </div>
              </div>
              <div className="employee-stats">
                <div className="stat-row">
                  <span className="stat-label">Services</span>
                  <span className="stat-value">{emp.services}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Revenue</span>
                  <span className="stat-value">₱{emp.revenue.toLocaleString()}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Commission</span>
                  <span className="stat-value">₱{emp.commission.toLocaleString()}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Attendance</span>
                  <span className="stat-value">{emp.attendance}%</span>
                </div>
                <div className="performance-bar">
                  <div
                    className="performance-bar-fill"
                    style={{ width: `${emp.attendance}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCustomerReport = () => {
    if (!reportData) return <div className="empty-report"><p>Generating report...</p></div>;

    return (
      <div className="report-content">
        <div className="customer-insights">
          <div className="insight-card">
            <div className="insight-icon">👥</div>
            <div className="insight-value">{reportData.totalCustomers}</div>
            <div className="insight-label">Total Customers</div>
          </div>
          <div className="insight-card">
            <div className="insight-icon">✨</div>
            <div className="insight-value">{reportData.newCustomers}</div>
            <div className="insight-label">New Customers</div>
          </div>
          <div className="insight-card">
            <div className="insight-icon">🔄</div>
            <div className="insight-value">{reportData.returningCustomers}</div>
            <div className="insight-label">Returning</div>
          </div>
          <div className="insight-card">
            <div className="insight-icon">💰</div>
            <div className="insight-value">₱{reportData.avgSpend.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
            <div className="insight-label">Avg Spend</div>
          </div>
          <div className="insight-card">
            <div className="insight-icon">📈</div>
            <div className="insight-value">{reportData.retentionRate}%</div>
            <div className="insight-label">Retention Rate</div>
          </div>
        </div>

        <div className="top-performers">
          <h3>Top Customers by Spend</h3>
          <table className="performers-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Customer</th>
                <th className="right">Visits</th>
                <th className="right">Total Spent</th>
                <th className="right">Avg per Visit</th>
                <th>Last Visit</th>
              </tr>
            </thead>
            <tbody>
              {reportData.topCustomers?.map((customer, index) => (
                <tr key={index}>
                  <td>
                    <span className={`rank-badge ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : 'default'}`}>
                      {index + 1}
                    </span>
                  </td>
                  <td>
                    <div className="customer-info">
                      <div className="customer-name">{customer.name}</div>
                      {customer.phone && <div className="customer-phone">{customer.phone}</div>}
                    </div>
                  </td>
                  <td className="right">{customer.visits}</td>
                  <td className="right">₱{customer.spent.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                  <td className="right">₱{(customer.spent / customer.visits).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                  <td>{format(new Date(customer.lastVisit), 'MMM dd, yyyy')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderReportContent = () => {
    if (!selectedReport) {
      return (
        <div className="empty-report">
          <div className="empty-report-icon">📊</div>
          <h3>Select a Report Type</h3>
          <p>Choose a report from the dropdown above to view detailed analytics</p>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="empty-report">
          <div className="spinner"></div>
          <p>Loading report data...</p>
        </div>
      );
    }

    switch (selectedCategory) {
      case 'financial':
        return renderFinancialReport();
      case 'operations':
        return renderOperationsReport();
      case 'employee':
        return renderEmployeeReport();
      case 'customer':
        return renderCustomerReport();
      default:
        return (
          <div className="empty-report">
            <div className="empty-report-icon">📊</div>
            <h3>Report Preview</h3>
            <p>Select a report type to view detailed analytics</p>
          </div>
        );
    }
  };

  if (!selectedCategory) {
    return (
      <div className="reports-page">
        <div className="page-header">
          <div>
            <h1>Reports & Analytics</h1>
            <p>Comprehensive business intelligence and performance insights</p>
          </div>
        </div>

        <div className="report-categories">
          {reportCategories.map(category => (
            <div
              key={category.id}
              className={`report-category-card ${category.id}`}
              onClick={() => setSelectedCategory(category.id)}
            >
              <div className="category-icon">{category.icon}</div>
              <h3 className="category-title">{category.title}</h3>
              <p className="category-description">{category.description}</p>
              <span className="category-count">{category.count} reports</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const currentCategory = reportCategories.find(c => c.id === selectedCategory);

  return (
    <div className="reports-page">
      <div className="report-viewer">
        <div className="report-header">
          <div className="report-header-left">
            <button className="back-btn" onClick={() => {
              setSelectedCategory(null);
              setSelectedReport(null);
            }}>
              <span>←</span>
              <span>Back to Categories</span>
            </button>
            <h1 className="report-title">{currentCategory?.title}</h1>
          </div>
          <div className="report-actions">
            <button className="btn btn-secondary" onClick={handlePrint}>
              🖨️ Print
            </button>
            <button className="btn btn-secondary" onClick={handleExportCSV}>
              📊 Export CSV
            </button>
            <button className="btn btn-primary" onClick={handleExportPDF}>
              📄 Export PDF
            </button>
          </div>
        </div>

        {/* Report Type Selector */}
        <div className="report-filters">
          <div className="filter-group">
            <label>Report Type</label>
            <select
              value={selectedReport || ''}
              onChange={(e) => setSelectedReport(e.target.value)}
            >
              <option value="">Select a report...</option>
              {reports[selectedCategory]?.map(report => (
                <option key={report.id} value={report.id}>
                  {report.icon} {report.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Quick Select</label>
            <div className="date-range-quick-select">
              <button className="date-quick-btn" onClick={() => setDateRange('week')}>Week</button>
              <button className="date-quick-btn active" onClick={() => setDateRange('month')}>Month</button>
              <button className="date-quick-btn" onClick={() => setDateRange('quarter')}>Quarter</button>
              <button className="date-quick-btn" onClick={() => setDateRange('year')}>Year</button>
            </div>
          </div>
        </div>

        {/* Report Content */}
        {renderReportContent()}
      </div>
    </div>
  );
};

export default Reports;
