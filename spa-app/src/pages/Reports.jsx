import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { format, subDays, addDays, startOfMonth, endOfMonth, differenceInDays, parseISO, isSameDay, startOfWeek, endOfWeek } from 'date-fns';
import { Line, Bar, Doughnut, Pie } from 'react-chartjs-2';
import { aggregateEmployeePerformance } from '../utils/reports/commission';
// jsPDF is loaded dynamically in handleExportPDF to reduce initial bundle size

const Reports = ({ embedded = false }) => {
  const { showToast, user, isTherapist, canViewAll, getEffectiveBranchId } = useApp();

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
  const [expenses, setExpenses] = useState([]);
  const [cashSessions, setCashSessions] = useState([]);

  // Computed report data
  const [reportData, setReportData] = useState(null);

  const reportCategories = [
    {
      id: 'financial',
      title: 'Financial Reports',
      description: 'Revenue, expenses, profit & loss statements',
      count: 4
    },
    {
      id: 'operations',
      title: 'Operations Reports',
      description: 'Services, appointments, and room utilization',
      count: 5
    },
    {
      id: 'employee',
      title: 'Employee Reports',
      description: 'Performance, attendance, and payroll reports',
      count: 6
    },
    {
      id: 'customer',
      title: 'Customer Reports',
      description: 'Customer insights, retention, and loyalty',
      count: 3
    }
  ];

  const reports = {
    financial: [
      { id: 'pl', name: 'Profit & Loss Statement' },
      { id: 'revenue', name: 'Revenue Analysis' },
      { id: 'expenses', name: 'Expense Breakdown' },
      { id: 'cashflow', name: 'Cash Flow Report' }
    ],
    operations: [
      { id: 'services', name: 'Service Performance' },
      { id: 'appointments', name: 'Appointment Analytics' },
      { id: 'rooms', name: 'Room Utilization' },
      { id: 'inventory', name: 'Inventory Turnover' },
      { id: 'daily', name: 'Daily Operations Summary' }
    ],
    employee: [
      { id: 'performance', name: 'Employee Performance' },
      { id: 'attendance', name: 'Attendance Report' },
      { id: 'payroll', name: 'Payroll Summary' },
      { id: 'commission', name: 'Commission Report' },
      { id: 'schedule', name: 'Schedule Analysis' },
      { id: 'productivity', name: 'Productivity Metrics' }
    ],
    customer: [
      { id: 'insights', name: 'Customer Insights' },
      { id: 'retention', name: 'Retention Analysis' },
      { id: 'loyalty', name: 'Loyalty Program Report' }
    ]
  };

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (selectedReport && selectedCategory) {
      generateReportData();
    }
  }, [selectedReport, selectedCategory, startDate, endDate, transactions, employees, attendance, products, rooms, customers, appointments, advanceBookings, expenses, cashSessions]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      let [txns, emps, attn, prods, rms, custs, appts, advBookings, exps, sessions] = await Promise.all([
        mockApi.transactions.getTransactions(),
        mockApi.employees.getEmployees(),
        mockApi.attendance.getAttendance(),
        mockApi.products.getProducts(),
        mockApi.rooms.getRooms(),
        mockApi.customers.getCustomers(),
        mockApi.appointments.getAppointments(),
        mockApi.advanceBooking.listAdvanceBookings(),
        mockApi.expenses.getExpenses(),
        mockApi.cashDrawer.getSessions()
      ]);

      // Filter data by branch
      const effectiveBranchId = getEffectiveBranchId();
      if (effectiveBranchId) {
        txns = txns.filter(item => item.branchId === effectiveBranchId);
        emps = emps.filter(item => item.branchId === effectiveBranchId);
        attn = attn.filter(item => item.branchId === effectiveBranchId);
        prods = prods.filter(item => item.branchId === effectiveBranchId);
        rms = rms.filter(item => item.branchId === effectiveBranchId);
        custs = custs.filter(item => item.branchId === effectiveBranchId);
        appts = appts.filter(item => item.branchId === effectiveBranchId);
        advBookings = advBookings.filter(item => item.branchId === effectiveBranchId);
        exps = exps.filter(item => item.branchId === effectiveBranchId);
        sessions = sessions.filter(item => item.branchId === effectiveBranchId);
      }

      setTransactions(txns);
      setEmployees(emps);
      setAttendance(attn);
      setProducts(prods);
      setRooms(rms);
      setCustomers(custs);
      setAppointments(appts);
      setAdvanceBookings(advBookings);
      setExpenses(exps);
      setCashSessions(sessions || []);
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

  // Billable = counts toward revenue + commission. Voided is a manual void
  // (refund); cancelled is a service that never happened. Both are excluded
  // here so revenue totals match Service History's billable view. under_time
  // (therapist stopped before scheduled duration) IS billable — customer
  // paid and therapist worked, just shorter than planned.
  const isBillable = (t) => t.status !== 'voided' && t.status !== 'cancelled';

  const generateReportData = () => {
    const filteredTransactions = filterByDateRange(transactions, 'createdAt').filter(isBillable);
    const filteredAttendance = filterByDateRange(attendance, 'date');
    const filteredAppointments = filterByDateRange(appointments, 'dateTime');
    const filteredAdvanceBookings = filterByDateRange(advanceBookings, 'bookingDateTime');
    const filteredExpenses = filterByDateRange(expenses, 'date');

    let data = {};

    switch (selectedCategory) {
      case 'financial':
        data = generateFinancialData(filteredTransactions, filteredExpenses);
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

  const generateFinancialData = (txns, exps) => {
    const totalRevenue = txns.reduce((sum, t) => sum + (t.totalAmount || t.total || 0), 0);

    // Calculate real expenses by category from API data
    const expensesByCategory = {};
    let totalExpenses = 0;
    exps.forEach(exp => {
      const category = exp.category || 'Other';
      expensesByCategory[category] = (expensesByCategory[category] || 0) + (exp.amount || 0);
      totalExpenses += (exp.amount || 0);
    });

    // If no real expenses, use default demo values
    if (totalExpenses === 0) {
      totalExpenses = 180000;
      expensesByCategory['Payroll'] = 113400;
      expensesByCategory['Supplies'] = 28800;
      expensesByCategory['Utilities'] = 16200;
      expensesByCategory['Rent'] = 19800;
      expensesByCategory['Other'] = 1800;
    }

    const profit = (totalRevenue || 0) - (totalExpenses || 0);
    const margin = totalRevenue > 0 ? ((profit / totalRevenue) * 100) : 0;
    const safeMargin = isNaN(margin) ? 0 : margin;

    const revenueByDay = {};
    txns.forEach(t => {
      const day = format(new Date(t.createdAt || t.date), 'yyyy-MM-dd');
      revenueByDay[day] = (revenueByDay[day] || 0) + (t.totalAmount || t.total || 0);
    });

    const revenueByPaymentMethod = {};
    txns.forEach(t => {
      revenueByPaymentMethod[t.paymentMethod] = (revenueByPaymentMethod[t.paymentMethod] || 0) + (t.totalAmount || t.total || 0);
    });

    // Calculate actual revenue breakdown from transaction items
    let serviceRevenue = 0;
    let productRevenue = 0;
    let gcRevenue = 0;
    txns.forEach(t => {
      t.items?.forEach(item => {
        // GC sale items are tagged explicitly; fall back to a name heuristic for
        // legacy rows that predate the typed flag.
        const isGC = item.type === 'gift_certificate'
          || item.name?.toLowerCase().includes('gift certificate');
        const isProduct = !isGC && (item.type === 'product'
          || item.name?.toLowerCase().includes('product')
          || item.name?.toLowerCase().includes('oil')
          || item.name?.toLowerCase().includes('candle'));
        if (isGC) {
          gcRevenue += item.price * item.quantity;
        } else if (isProduct) {
          productRevenue += item.price * item.quantity;
        } else {
          serviceRevenue += item.price * item.quantity;
        }
      });
    });

    // If no item-level breakdown data is available, show zeros instead of fake estimates
    // (revenue breakdown will be empty until transactions have item.type data)

    // Guests served — sum of paxCount per transaction (defaults to 1 for legacy
     // single-pax rows). Distinct from transactionCount: a 3-pax booking is
     // 1 transaction but 3 guests.
    const guestCount = txns.reduce((s, t) => s + (t.paxCount || 1), 0);

    return {
      totalRevenue,
      totalExpenses,
      profit,
      margin: safeMargin.toFixed(2),
      avgTransaction: txns.length > 0 ? (totalRevenue / txns.length) : 0,
      transactionCount: txns.length,
      guestCount,
      revenueByDay,
      revenueByPaymentMethod,
      topServices: calculateTopServices(txns),
      revenueBreakdown: {
        services: serviceRevenue,
        products: productRevenue,
        giftCertificates: gcRevenue
      },
      expenseBreakdown: {
        payroll: expensesByCategory['Payroll'] || expensesByCategory['payroll'] || totalExpenses * 0.63,
        supplies: expensesByCategory['Supplies'] || expensesByCategory['supplies'] || totalExpenses * 0.16,
        utilities: expensesByCategory['Utilities'] || expensesByCategory['utilities'] || totalExpenses * 0.09,
        rent: expensesByCategory['Rent'] || expensesByCategory['rent'] || totalExpenses * 0.11,
        other: expensesByCategory['Other'] || expensesByCategory['other'] || totalExpenses * 0.01
      },
      expensesByCategory
    };
  };

  const generateOperationsData = (txns, appts, advBookings) => {
    const services = products.filter(p => p.type === 'service');
    const servicePerformance = {};

    txns.forEach(t => {
      t.items?.forEach(item => {
        // GC sales are tracked separately under Revenue Analysis; don't pollute
        // Service Performance with one row per certificate code.
        if (item.type === 'gift_certificate') return;
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
      // Seat-minutes: each booking occupies the room for estimatedDuration
      // minutes per guest. A 3-pax 60-min booking is 180 seat-minutes (3 chairs
      // for 60 min), not 60. Falls back to 60 min when duration is missing.
      const seatMinutes = roomBookings.reduce(
        (s, b) => s + ((b.estimatedDuration || 60) * (b.paxCount || 1)),
        0,
      );
      roomUtilization[room.name] = {
        name: room.name,
        bookings: roomBookings.length,
        seatMinutes,
        utilization: Math.min(100, (roomBookings.length / Math.max(1, differenceInDays(new Date(endDate), new Date(startDate)))) * 10)
      };
    });

    // Total guests across the period — counts paxCount on transactions plus
    // paxCount on advance bookings that haven't yet been rung up at POS.
    const txnGuests = txns.reduce((s, t) => s + (t.paxCount || 1), 0);
    const bookingGuests = advBookings.reduce((s, b) => s + (b.paxCount || 1), 0);

    return {
      totalAppointments: appts.length + advBookings.length,
      totalGuests: txnGuests + bookingGuests,
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
        hourlyRate: emp.hourlyRate || 150,
        commissionRate: emp.commission?.value || 10,
        services: 0,
        revenue: 0,
        commission: 0,
        rating: 4.5 + Math.random() * 0.5,
        attendance: 0,
        totalDays: 0,
        hoursWorked: 0
      };
    });

    // Aggregate revenue/commission per item.employeeId so multi-pax bookings
    // (each guest with their own therapist) attribute correctly. Falls back to
    // transaction-level employeeId for legacy / single-pax data.
    const perItem = aggregateEmployeePerformance(txns);
    Object.values(perItem).forEach(row => {
      const empPerf = employeePerformance[row.employeeId];
      if (!empPerf) return; // unknown / inactive employee — skip
      empPerf.services += row.services;
      empPerf.revenue += row.revenue;
      empPerf.commission += row.commission;
    });

    // Aggregate attendance data - uses employeeId field
    attn.forEach(a => {
      const empId = a.employeeId || a.employee;
      if (empId && employeePerformance[empId]) {
        employeePerformance[empId].totalDays++;
        if (a.clockIn) {
          employeePerformance[empId].attendance++;
          if (a.clockIn && a.clockOut) {
            // Handle both HH:MM format and full datetime
            const clockIn = a.clockIn.includes('T')
              ? new Date(a.clockIn)
              : new Date(`${a.date}T${a.clockIn}`);
            const clockOut = a.clockOut.includes('T')
              ? new Date(a.clockOut)
              : new Date(`${a.date}T${a.clockOut}`);
            const hours = (clockOut - clockIn) / (1000 * 60 * 60);
            if (hours > 0 && hours < 24) {
              employeePerformance[empId].hoursWorked += hours;
            }
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
      activeEmployees: employees.filter(e => e.status === 'active').length,
      avgAttendanceRate: employees.length > 0 ? Object.values(employeePerformance).reduce((sum, e) => sum + e.attendance, 0) / employees.length : 0,
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
        customerStats[t.customer.name].spent += (t.totalAmount || t.total || 0);
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
        if (item.type === 'gift_certificate') return;
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

  const handleExportPDF = async () => {
    if (!reportData) {
      showToast('Please generate a report first', 'error');
      return;
    }

    // Dynamically load jsPDF only when user exports (saves ~300KB from initial load)
    showToast('Preparing PDF...', 'info');
    const { default: jsPDF } = await import('jspdf');
    await import('jspdf-autotable');

    const doc = new jsPDF();
    const reportName = selectedReport ? reports[selectedCategory].find(r => r.id === selectedReport)?.name : 'Report';
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(139, 92, 246); // Purple
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('AVA Spa Central', 14, 18);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Business Management System', 14, 28);

    doc.setFontSize(14);
    doc.text(reportName, pageWidth - 14, 18, { align: 'right' });
    doc.setFontSize(10);
    doc.text(`Period: ${format(new Date(startDate), 'MMM d, yyyy')} - ${format(new Date(endDate), 'MMM d, yyyy')}`, pageWidth - 14, 28, { align: 'right' });

    // Reset text color
    doc.setTextColor(0, 0, 0);

    let yPos = 55;

    // Generate report based on type
    if (selectedCategory === 'financial' && selectedReport === 'pl') {
      // Profit & Loss Statement
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Profit & Loss Statement', 14, yPos);
      yPos += 15;

      // Revenue Section
      doc.setFillColor(240, 253, 244);
      doc.rect(14, yPos - 6, pageWidth - 28, 50, 'F');

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(22, 163, 74);
      doc.text('REVENUE', 20, yPos);
      yPos += 10;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);

      const revenueItems = [
        ['Service Revenue', `₱${(reportData.revenueBreakdown?.services || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`],
        ['Product Sales', `₱${(reportData.revenueBreakdown?.products || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`],
        ['Gift Certificates', `₱${(reportData.revenueBreakdown?.giftCertificates || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`]
      ];

      revenueItems.forEach(([label, value]) => {
        doc.text(label, 24, yPos);
        doc.text(value, pageWidth - 24, yPos, { align: 'right' });
        yPos += 8;
      });

      doc.setFont('helvetica', 'bold');
      doc.text('Total Revenue', 24, yPos);
      doc.setTextColor(22, 163, 74);
      doc.text(`₱${(reportData.totalRevenue || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, pageWidth - 24, yPos, { align: 'right' });
      yPos += 20;

      // Expenses Section
      doc.setTextColor(0, 0, 0);
      doc.setFillColor(254, 242, 242);
      doc.rect(14, yPos - 6, pageWidth - 28, 60, 'F');

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(220, 38, 38);
      doc.text('EXPENSES', 20, yPos);
      yPos += 10;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);

      const expenseItems = [
        ['Payroll & Benefits', `₱${(reportData.expenseBreakdown?.payroll || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`],
        ['Supplies & Materials', `₱${(reportData.expenseBreakdown?.supplies || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`],
        ['Utilities', `₱${(reportData.expenseBreakdown?.utilities || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`],
        ['Rent', `₱${(reportData.expenseBreakdown?.rent || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`],
        ['Other Expenses', `₱${(reportData.expenseBreakdown?.other || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`]
      ];

      expenseItems.forEach(([label, value]) => {
        doc.text(label, 24, yPos);
        doc.text(value, pageWidth - 24, yPos, { align: 'right' });
        yPos += 8;
      });

      doc.setFont('helvetica', 'bold');
      doc.text('Total Expenses', 24, yPos);
      doc.setTextColor(220, 38, 38);
      doc.text(`₱${(reportData.totalExpenses || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, pageWidth - 24, yPos, { align: 'right' });
      yPos += 20;

      // Net Profit Section
      doc.setTextColor(0, 0, 0);
      const profitColor = (reportData.profit || 0) >= 0 ? [22, 163, 74] : [220, 38, 38];
      doc.setFillColor(profitColor[0], profitColor[1], profitColor[2]);
      doc.rect(14, yPos - 6, pageWidth - 28, 20, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('NET PROFIT', 20, yPos + 4);
      doc.text(`₱${(reportData.profit || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })} (${reportData.margin || 0}%)`, pageWidth - 24, yPos + 4, { align: 'right' });

    } else if (selectedCategory === 'employee' && selectedReport === 'performance') {
      // Employee Performance Report
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Employee Performance Report', 14, yPos);
      yPos += 10;

      // Summary cards
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Total Employees: ${reportData.totalEmployees} | Active: ${reportData.activeEmployees} | Avg Attendance: ${reportData.avgAttendanceRate?.toFixed(1) || 0}%`, 14, yPos);
      yPos += 10;

      // Performance table
      doc.autoTable({
        startY: yPos,
        head: [['Employee', 'Role', 'Services', 'Revenue', 'Commission', 'Rating', 'Attendance']],
        body: reportData.employeePerformance.map(emp => [
          emp.name,
          emp.role,
          emp.services,
          `₱${(emp.revenue || 0).toLocaleString()}`,
          `₱${(emp.commission || 0).toLocaleString()}`,
          `${(emp.rating || 0).toFixed(1)}/5`,
          `${emp.attendance}%`
        ]),
        theme: 'striped',
        headStyles: { fillColor: [139, 92, 246] },
        styles: { fontSize: 9 }
      });

    } else if (selectedCategory === 'customer' && selectedReport === 'insights') {
      // Customer Insights Report
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Customer Insights Report', 14, yPos);
      yPos += 10;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Total Customers: ${reportData.totalCustomers} | New: ${reportData.newCustomers} | Returning: ${reportData.returningCustomers}`, 14, yPos);
      yPos += 5;
      doc.text(`Average Spend: ₱${(reportData.averageSpend || 0).toLocaleString()} | Total Revenue from Top Customers: ₱${(reportData.topCustomers?.reduce((sum, c) => sum + (c.spent || 0), 0) || 0).toLocaleString()}`, 14, yPos);
      yPos += 10;

      doc.autoTable({
        startY: yPos,
        head: [['Customer', 'Visits', 'Total Spent', 'Last Visit']],
        body: (reportData.topCustomers || []).map(c => [
          c.name,
          c.visits,
          `₱${(c.spent || 0).toLocaleString()}`,
          format(new Date(c.lastVisit), 'MMM d, yyyy')
        ]),
        theme: 'striped',
        headStyles: { fillColor: [139, 92, 246] },
        styles: { fontSize: 9 }
      });

    } else if (selectedCategory === 'operations' && selectedReport === 'services') {
      // Service Performance Report
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Service Performance Report', 14, yPos);
      yPos += 10;

      if (reportData.servicePerformance) {
        doc.autoTable({
          startY: yPos,
          head: [['Service', 'Bookings', 'Revenue', 'Avg Price', 'Performance']],
          body: reportData.servicePerformance.map(s => [
            s.name,
            s.bookings || 0,
            `₱${(s.revenue || 0).toLocaleString()}`,
            `₱${(s.avgPrice || 0).toLocaleString()}`,
            s.trend || 'Stable'
          ]),
          theme: 'striped',
          headStyles: { fillColor: [139, 92, 246] },
          styles: { fontSize: 9 }
        });
      }

    } else {
      // Generic report
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text('Report data has been exported.', 14, yPos);
      doc.text('Please check the data summary below:', 14, yPos + 10);

      // Add basic summary
      const summaryData = [];
      if (reportData.totalRevenue) summaryData.push(['Total Revenue', `₱${(reportData.totalRevenue || 0).toLocaleString()}`]);
      if (reportData.transactionCount) summaryData.push(['Transactions', reportData.transactionCount || 0]);
      if (reportData.guestCount) summaryData.push(['Guests Served', reportData.guestCount || 0]);
      if (reportData.avgTransaction) summaryData.push(['Avg Transaction', `₱${(reportData.avgTransaction || 0).toLocaleString()}`]);

      if (summaryData.length > 0) {
        doc.autoTable({
          startY: yPos + 20,
          head: [['Metric', 'Value']],
          body: summaryData,
          theme: 'striped',
          headStyles: { fillColor: [139, 92, 246] }
        });
      }
    }

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(`Generated on ${format(new Date(), 'MMM d, yyyy h:mm a')}`, 14, doc.internal.pageSize.getHeight() - 10);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
    }

    // Save
    doc.save(`${reportName.toLowerCase().replace(/ /g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    showToast('PDF report downloaded successfully!', 'success');
  };

  const handleExportCSV = () => {
    if (!reportData) {
      showToast('Please generate a report first', 'error');
      return;
    }

    let csv = '';
    const reportName = selectedReport ? reports[selectedCategory].find(r => r.id === selectedReport)?.name : 'Report';

    csv += `${reportName}\nPeriod: ${startDate} to ${endDate}\n\n`;

    // Transactions filtered to the report's date range — used to append
    // transaction-level and item-level breakdowns (with Pax / Guest # columns)
    // to the existing summary CSVs without disturbing prior column order.
    const txnsForExport = filterByDateRange(transactions, 'createdAt');

    // Helper: escape a value for CSV. Wraps in quotes when needed and doubles
    // any embedded quotes per RFC 4180.
    const csvCell = (v) => {
      if (v == null) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    if (selectedCategory === 'financial' && selectedReport === 'pl') {
      csv += 'Category,Amount\n';
      csv += `Total Revenue,₱${(reportData.totalRevenue || 0).toLocaleString()}\n`;
      csv += `Total Expenses,₱${(reportData.totalExpenses || 0).toLocaleString()}\n`;
      csv += `Net Profit,₱${(reportData.profit || 0).toLocaleString()}\n`;
      csv += `Profit Margin,${reportData.margin || 0}%\n`;
      csv += `Transactions,${reportData.transactionCount || 0}\n`;
      csv += `Guests Served,${reportData.guestCount || 0}\n`;
    } else if (selectedCategory === 'employee' && selectedReport === 'performance') {
      csv += 'Employee,Role,Services,Revenue,Commission,Rating,Attendance\n';
      reportData.employeePerformance?.forEach(emp => {
        csv += `"${emp.name}","${emp.role}",${emp.services || 0},₱${(emp.revenue || 0).toLocaleString()},₱${(emp.commission || 0).toLocaleString()},${(emp.rating || 0).toFixed(1)},${emp.attendance || 0}%\n`;
      });
    } else if (selectedCategory === 'customer' && selectedReport === 'insights') {
      csv += 'Customer,Visits,Total Spent,Last Visit\n';
      reportData.topCustomers?.forEach(c => {
        csv += `"${c.name}",${c.visits || 0},₱${(c.spent || 0).toLocaleString()},"${format(new Date(c.lastVisit), 'yyyy-MM-dd')}"\n`;
      });
    }

    // --- Transaction-level breakdown (appended to every CSV) ---------------
    // One row per transaction. Pax column at the end keeps existing spreadsheet
    // imports working — new column is purely additive.
    if (txnsForExport.length > 0) {
      csv += `\nTransactions\n`;
      csv += 'Receipt #,Date,Customer,Payment Method,Total,Pax\n';
      txnsForExport.forEach(t => {
        const receipt = t.receiptNumber || t.id || t._id || '';
        const date = t.createdAt || t.date
          ? format(new Date(t.createdAt || t.date), 'yyyy-MM-dd HH:mm')
          : '';
        const customer = t.customer?.name || t.customerName || 'Walk-in';
        const method = t.paymentMethod || '';
        const total = (t.totalAmount || t.total || 0);
        const pax = t.paxCount || 1;
        csv += [
          csvCell(receipt),
          csvCell(date),
          csvCell(customer),
          csvCell(method),
          `₱${total.toLocaleString()}`,
          pax,
        ].join(',') + '\n';
      });

      // --- Item-level breakdown ---------------------------------------------
      // One row per line item. Guest # at the end identifies which guest in a
      // multi-pax booking ordered the item (defaults to 1 for legacy items).
      csv += `\nLine Items\n`;
      csv += 'Receipt #,Item,Type,Quantity,Unit Price,Subtotal,Guest #\n';
      txnsForExport.forEach(t => {
        const receipt = t.receiptNumber || t.id || t._id || '';
        (t.items || []).forEach(item => {
          const qty = item.quantity || 1;
          const price = item.price || 0;
          const subtotal = item.subtotal || price * qty;
          const guestNum = item.guestNumber || 1;
          csv += [
            csvCell(receipt),
            csvCell(item.name || ''),
            csvCell(item.type || ''),
            qty,
            `₱${price.toLocaleString()}`,
            `₱${subtotal.toLocaleString()}`,
            guestNum,
          ].join(',') + '\n';
        });
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
                <span className="pl-value">₱{(reportData.revenueBreakdown?.services || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="pl-line">
                <span className="pl-label">Product Sales</span>
                <span className="pl-value">₱{(reportData.revenueBreakdown?.products || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="pl-line">
                <span className="pl-label">Gift Certificates</span>
                <span className="pl-value">₱{(reportData.revenueBreakdown?.giftCertificates || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="pl-line total">
                <span className="pl-label">Total Revenue</span>
                <span className="pl-value positive">₱{(reportData.totalRevenue || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="pl-section">
              <h3 className="pl-section-title">Expenses</h3>
              <div className="pl-line">
                <span className="pl-label">Payroll & Benefits</span>
                <span className="pl-value">₱{(reportData.expenseBreakdown?.payroll || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="pl-line">
                <span className="pl-label">Supplies & Materials</span>
                <span className="pl-value">₱{(reportData.expenseBreakdown?.supplies || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="pl-line">
                <span className="pl-label">Utilities</span>
                <span className="pl-value">₱{(reportData.expenseBreakdown?.utilities || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="pl-line">
                <span className="pl-label">Rent</span>
                <span className="pl-value">₱{(reportData.expenseBreakdown?.rent || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="pl-line">
                <span className="pl-label">Other Expenses</span>
                <span className="pl-value">₱{(reportData.expenseBreakdown?.other || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="pl-line total">
                <span className="pl-label">Total Expenses</span>
                <span className="pl-value negative">₱{(reportData.totalExpenses || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="pl-line grand-total">
              <span className="pl-label">Net Profit</span>
              <span className="pl-value positive">₱{(reportData.profit || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="pl-line">
              <span className="pl-label">Profit Margin</span>
              <span className="pl-value">{reportData.margin || 0}%</span>
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
              <div className="financial-value positive">₱{(reportData.totalRevenue || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
              <div className="financial-meta">
                Transactions: {reportData.transactionCount || 0} · Guests served: {reportData.guestCount || 0}
              </div>
            </div>
            <div className="financial-card">
              <div className="financial-label">Transactions</div>
              <div className="financial-value">{reportData.transactionCount || 0}</div>
              <div className="financial-meta">Receipts rung up</div>
            </div>
            <div className="financial-card">
              <div className="financial-label">Guests Served</div>
              <div className="financial-value">{reportData.guestCount || 0}</div>
              <div className="financial-meta">Total pax across all bookings</div>
            </div>
            <div className="financial-card">
              <div className="financial-label">Average Transaction</div>
              <div className="financial-value">₱{(reportData.avgTransaction || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="financial-card">
              <div className="financial-label">Daily Average</div>
              <div className="financial-value">₱{((reportData.totalRevenue || 0) / (differenceInDays(new Date(endDate), new Date(startDate)) || 1)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
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
                    <td className="right">{service.count || 0}</td>
                    <td className="right">₱{(service.revenue || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    <td className="right">₱{((service.revenue || 0) / (service.count || 1)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    } else if (selectedReport === 'expenses') {
      // Expense Breakdown Report
      const expenseCategories = [
        { name: 'Payroll & Benefits', amount: reportData.expenseBreakdown?.payroll || 0, icon: '👥' },
        { name: 'Supplies & Materials', amount: reportData.expenseBreakdown?.supplies || 0, icon: '📦' },
        { name: 'Utilities', amount: reportData.expenseBreakdown?.utilities || 0, icon: '💡' },
        { name: 'Rent', amount: reportData.expenseBreakdown?.rent || 0, icon: '🏢' },
        { name: 'Other Expenses', amount: reportData.expenseBreakdown?.other || 0, icon: '📋' }
      ].sort((a, b) => b.amount - a.amount);

      const totalExpenses = expenseCategories.reduce((sum, cat) => sum + cat.amount, 0);

      const expenseChartData = {
        labels: expenseCategories.map(c => c.name),
        datasets: [{
          data: expenseCategories.map(c => c.amount),
          backgroundColor: [
            'rgba(27, 94, 55, 0.8)',
            'rgba(27, 94, 55, 0.6)',
            'rgba(217, 119, 6, 0.8)',
            'rgba(220, 38, 38, 0.8)',
            'rgba(102, 102, 102, 0.6)'
          ],
          borderWidth: 0
        }]
      };

      return (
        <div className="report-content">
          <div className="financial-summary">
            <div className="financial-card expenses">
              <div className="financial-label">Total Expenses</div>
              <div className="financial-value negative">₱{totalExpenses.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="financial-card">
              <div className="financial-label">Largest Category</div>
              <div className="financial-value">{expenseCategories[0]?.name || 'N/A'}</div>
              <div className="financial-meta">₱{(expenseCategories[0]?.amount || 0).toLocaleString()}</div>
            </div>
            <div className="financial-card">
              <div className="financial-label">Expense/Revenue Ratio</div>
              <div className={`financial-value ${((totalExpenses / (reportData.totalRevenue || 1)) * 100) <= 70 ? 'positive' : 'warning'}`}>
                {((totalExpenses / (reportData.totalRevenue || 1)) * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="report-grid two-column">
            <div className="chart-card">
              <h3>Expense Distribution</h3>
              <div className="chart-container-small">
                <Doughnut
                  data={expenseChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                      legend: {
                        position: 'right',
                        labels: { color: '#666666' }
                      }
                    }
                  }}
                />
              </div>
            </div>

            <div className="top-performers">
              <h3>Expense Breakdown by Category</h3>
              <table className="performers-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="right">Amount</th>
                    <th className="right">% of Total</th>
                    <th className="right">% of Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseCategories.map((category, index) => (
                    <tr key={index}>
                      <td>
                        <span className="category-with-icon">
                          <span className="category-icon">{category.icon}</span>
                          {category.name}
                        </span>
                      </td>
                      <td className="right">₱{category.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                      <td className="right">{((category.amount / totalExpenses) * 100).toFixed(1)}%</td>
                      <td className={`right ${((category.amount / (reportData.totalRevenue || 1)) * 100) <= 15 ? 'positive' : 'warning'}`}>
                        {((category.amount / (reportData.totalRevenue || 1)) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td><strong>Total</strong></td>
                    <td className="right"><strong>₱{totalExpenses.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></td>
                    <td className="right"><strong>100%</strong></td>
                    <td className="right"><strong>{((totalExpenses / (reportData.totalRevenue || 1)) * 100).toFixed(1)}%</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      );
    } else if (selectedReport === 'cashflow') {
      // Cash Flow Report
      const cashInflows = reportData.totalRevenue || 0;
      const cashOutflows = reportData.totalExpenses || 0;
      const netCashFlow = cashInflows - cashOutflows;

      // Derive opening + closing balance from actual cash drawer sessions
      // within the selected date range. The opening balance is the cash
      // float of the earliest drawer opened in the range; the closing
      // balance is the actualCash of the latest closed drawer (falls back
      // to opening + netCashFlow when the drawer is still open or no
      // session has been closed yet). Previously this was hardcoded to
      // ₱150,000 — a placeholder that ignored the real float and made
      // every cash-flow report start from the same wrong number.
      const sessionsInRange = (cashSessions || []).filter(s => {
        const t = s.openTime ? new Date(s.openTime) : null;
        if (!t) return false;
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return t >= start && t <= end;
      });
      const firstSession = [...sessionsInRange].sort((a, b) => new Date(a.openTime) - new Date(b.openTime))[0];
      const lastClosedSession = [...sessionsInRange]
        .filter(s => s.status === 'closed' && s.closeTime)
        .sort((a, b) => new Date(b.closeTime) - new Date(a.closeTime))[0];
      const openingBalance = Number(firstSession?.openingFloat ?? firstSession?.openingBalance ?? 0);
      const closingBalance = lastClosedSession
        ? Number(lastClosedSession.actualCash ?? lastClosedSession.expectedCash ?? 0)
        : openingBalance + netCashFlow;

      // Payment method breakdown for inflows
      const paymentMethods = reportData.revenueByPaymentMethod || { Cash: 0, Card: 0, GCash: 0, Other: 0 };

      const cashFlowChartData = {
        labels: ['Cash Inflows', 'Cash Outflows', 'Net Cash Flow'],
        datasets: [{
          label: 'Amount',
          data: [cashInflows, cashOutflows, netCashFlow],
          backgroundColor: [
            'rgba(27, 94, 55, 0.8)',
            'rgba(220, 38, 38, 0.8)',
            netCashFlow >= 0 ? 'rgba(27, 94, 55, 0.6)' : 'rgba(220, 38, 38, 0.6)'
          ],
          borderRadius: 4
        }]
      };

      return (
        <div className="report-content">
          <div className="financial-summary">
            <div className="financial-card">
              <div className="financial-label">Opening Balance</div>
              <div className="financial-value">₱{openingBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="financial-card revenue">
              <div className="financial-label">Cash Inflows</div>
              <div className="financial-value positive">₱{cashInflows.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="financial-card expenses">
              <div className="financial-label">Cash Outflows</div>
              <div className="financial-value negative">₱{cashOutflows.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="financial-card profit">
              <div className="financial-label">Net Cash Flow</div>
              <div className={`financial-value ${netCashFlow >= 0 ? 'positive' : 'negative'}`}>
                ₱{netCashFlow.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="financial-card">
              <div className="financial-label">Closing Balance</div>
              <div className={`financial-value ${closingBalance >= openingBalance ? 'positive' : 'warning'}`}>
                ₱{closingBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div className="report-grid two-column">
            <div className="chart-card">
              <h3>Cash Flow Overview</h3>
              <div className="chart-container">
                <Bar
                  data={cashFlowChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: { color: '#666666' },
                        grid: { color: 'rgba(224, 224, 224, 0.5)' }
                      },
                      x: {
                        ticks: { color: '#666666' },
                        grid: { display: false }
                      }
                    }
                  }}
                />
              </div>
            </div>

            <div className="cashflow-details">
              <div className="cashflow-section">
                <h3>Cash Inflows</h3>
                <div className="cashflow-items">
                  <div className="cashflow-item">
                    <span className="item-label">Service Revenue</span>
                    <span className="item-value positive">₱{(reportData.revenueBreakdown?.services || 0).toLocaleString()}</span>
                  </div>
                  <div className="cashflow-item">
                    <span className="item-label">Product Sales</span>
                    <span className="item-value positive">₱{(reportData.revenueBreakdown?.products || 0).toLocaleString()}</span>
                  </div>
                  <div className="cashflow-item">
                    <span className="item-label">Gift Certificates</span>
                    <span className="item-value positive">₱{(reportData.revenueBreakdown?.giftCertificates || 0).toLocaleString()}</span>
                  </div>
                  <div className="cashflow-item total">
                    <span className="item-label"><strong>Total Inflows</strong></span>
                    <span className="item-value positive"><strong>₱{cashInflows.toLocaleString()}</strong></span>
                  </div>
                </div>
              </div>

              <div className="cashflow-section">
                <h3>Cash Outflows</h3>
                <div className="cashflow-items">
                  <div className="cashflow-item">
                    <span className="item-label">Payroll & Benefits</span>
                    <span className="item-value negative">₱{(reportData.expenseBreakdown?.payroll || 0).toLocaleString()}</span>
                  </div>
                  <div className="cashflow-item">
                    <span className="item-label">Supplies & Materials</span>
                    <span className="item-value negative">₱{(reportData.expenseBreakdown?.supplies || 0).toLocaleString()}</span>
                  </div>
                  <div className="cashflow-item">
                    <span className="item-label">Utilities</span>
                    <span className="item-value negative">₱{(reportData.expenseBreakdown?.utilities || 0).toLocaleString()}</span>
                  </div>
                  <div className="cashflow-item">
                    <span className="item-label">Rent</span>
                    <span className="item-value negative">₱{(reportData.expenseBreakdown?.rent || 0).toLocaleString()}</span>
                  </div>
                  <div className="cashflow-item">
                    <span className="item-label">Other Expenses</span>
                    <span className="item-value negative">₱{(reportData.expenseBreakdown?.other || 0).toLocaleString()}</span>
                  </div>
                  <div className="cashflow-item total">
                    <span className="item-label"><strong>Total Outflows</strong></span>
                    <span className="item-value negative"><strong>₱{cashOutflows.toLocaleString()}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="top-performers">
            <h3>Inflows by Payment Method</h3>
            <table className="performers-table">
              <thead>
                <tr>
                  <th>Payment Method</th>
                  <th className="right">Amount</th>
                  <th className="right">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(paymentMethods).map(([method, amount], index) => (
                  <tr key={index}>
                    <td>{method}</td>
                    <td className="right">₱{(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    <td className="right">{((amount || 0) / (cashInflows || 1) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // Default fallback for any other financial report
    return (
      <div className="report-content">
        <div className="financial-summary">
          <div className="financial-card revenue">
            <div className="financial-label">Total Revenue</div>
            <div className="financial-value positive">₱{(reportData.totalRevenue || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="financial-card expenses">
            <div className="financial-label">Total Expenses</div>
            <div className="financial-value negative">₱{(reportData.totalExpenses || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="financial-card profit">
            <div className="financial-label">Net Profit</div>
            <div className="financial-value positive">₱{(reportData.profit || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="financial-card margin">
            <div className="financial-label">Profit Margin</div>
            <div className="financial-value">{reportData.margin || 0}%</div>
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
                    <td className="right">{service.count || 0}</td>
                    <td className="right">₱{(service.revenue || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    <td className="right">₱{((service.revenue || 0) / (service.count || 1)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
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
                  <th className="right">Seat-minutes</th>
                  <th className="right">Utilization</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {reportData.roomUtilization?.map((room, index) => (
                  <tr key={index}>
                    <td>{room.name}</td>
                    <td className="right">{room.bookings}</td>
                    <td className="right">{(room.seatMinutes || 0).toLocaleString()}</td>
                    <td className="right">{(room.utilization || 0).toFixed(1)}%</td>
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
    } else if (selectedReport === 'inventory') {
      // Inventory Turnover Report
      // Build inventory data from products
      const inventoryItems = products.filter(p => p.type === 'product').map(product => {
        const soldCount = reportData.servicePerformance?.find(s => s.name === product.name)?.count || Math.floor(Math.random() * 50);
        const avgDailySales = soldCount / Math.max(1, differenceInDays(new Date(endDate), new Date(startDate)));
        const currentStock = product.quantity || 0;
        const inventoryValue = currentStock * (product.costPrice || product.price * 0.6);
        const turnoverRate = currentStock > 0 ? (soldCount / currentStock) : 0;
        const daysUntilStockout = avgDailySales > 0 ? Math.round(currentStock / avgDailySales) : 999;

        return {
          name: product.name,
          currentStock,
          soldCount,
          inventoryValue,
          avgDailySales: avgDailySales.toFixed(1),
          turnoverRate: turnoverRate.toFixed(2),
          daysUntilStockout,
          status: daysUntilStockout <= 7 ? 'critical' : daysUntilStockout <= 14 ? 'low' : 'healthy'
        };
      });

      const totalInventoryValue = inventoryItems.reduce((sum, item) => sum + item.inventoryValue, 0);
      const avgTurnoverRate = inventoryItems.length > 0
        ? (inventoryItems.reduce((sum, item) => sum + parseFloat(item.turnoverRate), 0) / inventoryItems.length).toFixed(2)
        : 0;
      const lowStockItems = inventoryItems.filter(item => item.status === 'critical' || item.status === 'low').length;

      const turnoverChartData = {
        labels: inventoryItems.slice(0, 8).map(item => item.name.substring(0, 15)),
        datasets: [{
          label: 'Turnover Rate',
          data: inventoryItems.slice(0, 8).map(item => parseFloat(item.turnoverRate)),
          backgroundColor: inventoryItems.slice(0, 8).map(item => {
            const rate = parseFloat(item.turnoverRate);
            if (rate >= 1) return 'rgba(27, 94, 55, 0.8)';
            if (rate >= 0.5) return 'rgba(217, 119, 6, 0.8)';
            return 'rgba(220, 38, 38, 0.8)';
          }),
          borderRadius: 4
        }]
      };

      return (
        <div className="report-content">
          <div className="operations-summary">
            <div className="ops-card">
              <div className="ops-icon">📦</div>
              <div className="ops-value">{inventoryItems.length}</div>
              <div className="ops-label">Total Products</div>
            </div>
            <div className="ops-card">
              <div className="ops-icon">💰</div>
              <div className="ops-value">₱{totalInventoryValue.toLocaleString()}</div>
              <div className="ops-label">Inventory Value</div>
            </div>
            <div className="ops-card">
              <div className="ops-icon">🔄</div>
              <div className="ops-value">{avgTurnoverRate}x</div>
              <div className="ops-label">Avg Turnover Rate</div>
            </div>
            <div className="ops-card">
              <div className="ops-icon">⚠️</div>
              <div className="ops-value warning">{lowStockItems}</div>
              <div className="ops-label">Low Stock Items</div>
            </div>
          </div>

          <div className="chart-card">
            <h3>Turnover Rate by Product</h3>
            <div className="chart-container">
              <Bar
                data={turnoverChartData}
                options={{
                  indexAxis: 'y',
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { ticks: { color: '#666666' }, grid: { color: 'rgba(224, 224, 224, 0.5)' } },
                    y: { ticks: { color: '#666666' }, grid: { display: false } }
                  }
                }}
              />
            </div>
          </div>

          <div className="top-performers">
            <h3>Inventory Turnover Details</h3>
            <table className="performers-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="right">Current Stock</th>
                  <th className="right">Sold (Period)</th>
                  <th className="right">Inventory Value</th>
                  <th className="right">Daily Velocity</th>
                  <th className="right">Turnover Rate</th>
                  <th className="right">Days Until Stockout</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {inventoryItems.map((item, index) => (
                  <tr key={index}>
                    <td>{item.name}</td>
                    <td className="right">{item.currentStock}</td>
                    <td className="right">{item.soldCount}</td>
                    <td className="right">₱{item.inventoryValue.toLocaleString()}</td>
                    <td className="right">{item.avgDailySales}/day</td>
                    <td className={`right ${parseFloat(item.turnoverRate) >= 1 ? 'positive' : parseFloat(item.turnoverRate) >= 0.5 ? 'warning' : 'negative'}`}>
                      {item.turnoverRate}x
                    </td>
                    <td className={`right ${item.daysUntilStockout <= 7 ? 'negative' : item.daysUntilStockout <= 14 ? 'warning' : ''}`}>
                      {item.daysUntilStockout === 999 ? 'N/A' : `${item.daysUntilStockout} days`}
                    </td>
                    <td>
                      <span className={`status-badge ${item.status === 'critical' ? 'danger' : item.status === 'low' ? 'warning' : 'success'}`}>
                        {item.status === 'critical' ? 'Critical' : item.status === 'low' ? 'Low Stock' : 'Healthy'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    } else if (selectedReport === 'daily') {
      // Daily Operations Summary
      const dayData = {};
      const days = [];
      let current = new Date(startDate);
      const end = new Date(endDate);

      while (current <= end) {
        const dateKey = format(current, 'yyyy-MM-dd');
        days.push(dateKey);
        dayData[dateKey] = {
          date: dateKey,
          displayDate: format(current, 'MMM dd'),
          dayName: format(current, 'EEE'),
          revenue: 0,
          transactions: 0,
          guests: 0,
          services: 0,
          avgTicket: 0
        };
        current = addDays(current, 1);
      }

      // Aggregate data from transactions
      transactions.forEach(t => {
        const txDate = format(new Date(t.createdAt || t.date), 'yyyy-MM-dd');
        if (dayData[txDate]) {
          dayData[txDate].revenue += (t.totalAmount || t.total || 0);
          dayData[txDate].transactions += 1;
          dayData[txDate].guests = (dayData[txDate].guests || 0) + (t.paxCount || 1);
          dayData[txDate].services += t.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 1;
        }
      });

      // Calculate avg tickets
      Object.values(dayData).forEach(day => {
        day.avgTicket = day.transactions > 0 ? day.revenue / day.transactions : 0;
      });

      const dailyData = Object.values(dayData).slice(-14); // Last 14 days
      const totalRevenue = dailyData.reduce((sum, d) => sum + d.revenue, 0);
      const totalTransactions = dailyData.reduce((sum, d) => sum + d.transactions, 0);
      const totalGuests = dailyData.reduce((sum, d) => sum + (d.guests || 0), 0);
      const totalServices = dailyData.reduce((sum, d) => sum + d.services, 0);
      const avgDailyRevenue = dailyData.length > 0 ? totalRevenue / dailyData.length : 0;

      const dailyChartData = {
        labels: dailyData.map(d => d.displayDate),
        datasets: [
          {
            label: 'Revenue',
            data: dailyData.map(d => d.revenue),
            borderColor: 'rgba(27, 94, 55, 1)',
            backgroundColor: 'rgba(27, 94, 55, 0.1)',
            fill: true,
            tension: 0.4
          }
        ]
      };

      const transactionsChartData = {
        labels: dailyData.map(d => d.displayDate),
        datasets: [
          {
            label: 'Transactions',
            data: dailyData.map(d => d.transactions),
            backgroundColor: 'rgba(27, 94, 55, 0.8)',
            borderRadius: 4
          }
        ]
      };

      return (
        <div className="report-content">
          <div className="operations-summary">
            <div className="ops-card">
              <div className="ops-icon">💰</div>
              <div className="ops-value">₱{totalRevenue.toLocaleString()}</div>
              <div className="ops-label">Total Revenue</div>
            </div>
            <div className="ops-card">
              <div className="ops-icon">📊</div>
              <div className="ops-value">₱{avgDailyRevenue.toLocaleString()}</div>
              <div className="ops-label">Avg Daily Revenue</div>
            </div>
            <div className="ops-card">
              <div className="ops-icon">🧾</div>
              <div className="ops-value">{totalTransactions}</div>
              <div className="ops-label">Transactions</div>
            </div>
            <div className="ops-card">
              <div className="ops-icon">👥</div>
              <div className="ops-value">{totalGuests}</div>
              <div className="ops-label">Guests Served</div>
            </div>
            <div className="ops-card">
              <div className="ops-icon">✅</div>
              <div className="ops-value">{totalServices}</div>
              <div className="ops-label">Services Completed</div>
            </div>
          </div>

          <div className="report-grid two-column">
            <div className="chart-card">
              <h3>Daily Revenue Trend</h3>
              <div className="chart-container">
                <Line
                  data={dailyChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { ticks: { color: '#666666' }, grid: { color: 'rgba(224, 224, 224, 0.5)' } },
                      y: { ticks: { color: '#666666' }, grid: { color: 'rgba(224, 224, 224, 0.5)' } }
                    }
                  }}
                />
              </div>
            </div>
            <div className="chart-card">
              <h3>Daily Transactions</h3>
              <div className="chart-container">
                <Bar
                  data={transactionsChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { ticks: { color: '#666666' }, grid: { display: false } },
                      y: { ticks: { color: '#666666' }, grid: { color: 'rgba(224, 224, 224, 0.5)' } }
                    }
                  }}
                />
              </div>
            </div>
          </div>

          <div className="top-performers">
            <h3>Daily Operations Breakdown</h3>
            <table className="performers-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Day</th>
                  <th className="right">Revenue</th>
                  <th className="right">Transactions</th>
                  <th className="right">Guests</th>
                  <th className="right">Services</th>
                  <th className="right">Avg Ticket</th>
                  <th>Performance</th>
                </tr>
              </thead>
              <tbody>
                {dailyData.map((day, index) => (
                  <tr key={index}>
                    <td>{day.displayDate}</td>
                    <td>{day.dayName}</td>
                    <td className="right highlight">₱{day.revenue.toLocaleString()}</td>
                    <td className="right">{day.transactions}</td>
                    <td className="right">{day.guests || 0}</td>
                    <td className="right">{day.services}</td>
                    <td className="right">₱{day.avgTicket.toLocaleString()}</td>
                    <td>
                      <span className={`status-badge ${day.revenue >= avgDailyRevenue ? 'success' : day.revenue >= avgDailyRevenue * 0.7 ? 'warning' : 'info'}`}>
                        {day.revenue >= avgDailyRevenue ? 'Above Avg' : day.revenue >= avgDailyRevenue * 0.7 ? 'Near Avg' : 'Below Avg'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="2"><strong>Total</strong></td>
                  <td className="right"><strong>₱{totalRevenue.toLocaleString()}</strong></td>
                  <td className="right"><strong>{totalTransactions}</strong></td>
                  <td className="right"><strong>{totalGuests}</strong></td>
                  <td className="right"><strong>{totalServices}</strong></td>
                  <td className="right"><strong>₱{(totalTransactions > 0 ? totalRevenue / totalTransactions : 0).toLocaleString()}</strong></td>
                  <td></td>
                </tr>
              </tfoot>
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
            <div className="ops-icon">👥</div>
            <div className="ops-value">{reportData.totalGuests || 0}</div>
            <div className="ops-label">Guests Served</div>
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
              <div className="summary-value">{(reportData.avgAttendanceRate || 0).toFixed(1)}%</div>
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
                    <td className="right">₱{(emp.revenue || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    <td className="right">₱{(emp.commission || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    <td className="right">{(emp.hoursWorked || 0).toFixed(1)}h</td>
                    <td className="right">{emp.attendance}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (selectedReport === 'attendance') {
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
              <div className="summary-value">{(reportData.avgAttendanceRate || 0).toFixed(1)}%</div>
              <div className="summary-label">Avg Attendance Rate</div>
            </div>
            <div className="employee-summary-card">
              <div className="summary-icon">⏰</div>
              <div className="summary-value">{reportData.employeePerformance?.reduce((sum, e) => sum + (e.hoursWorked || 0), 0).toFixed(0)}h</div>
              <div className="summary-label">Total Hours Worked</div>
            </div>
          </div>

          <div className="top-performers">
            <h3>Attendance Report</h3>
            <table className="performers-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Role</th>
                  <th className="right">Days Present</th>
                  <th className="right">Total Days</th>
                  <th className="right">Hours Worked</th>
                  <th className="right">Attendance %</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {reportData.employeePerformance?.map((emp) => (
                  <tr key={emp.id}>
                    <td>{emp.name}</td>
                    <td>{emp.role}</td>
                    <td className="right">{Math.round((emp.attendance / 100) * (emp.totalDays || 20))}</td>
                    <td className="right">{emp.totalDays || 20}</td>
                    <td className="right">{(emp.hoursWorked || 0).toFixed(1)}h</td>
                    <td className="right">{emp.attendance}%</td>
                    <td>
                      <span className={`status-badge ${emp.attendance >= 90 ? 'success' : emp.attendance >= 75 ? 'warning' : 'danger'}`}>
                        {emp.attendance >= 90 ? 'Excellent' : emp.attendance >= 75 ? 'Good' : 'Needs Improvement'}
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

    if (selectedReport === 'payroll') {
      const totalPayroll = reportData.employeePerformance?.reduce((sum, e) => sum + ((e.hoursWorked || 0) * (e.hourlyRate || 150)), 0) || 0;
      const totalCommissions = reportData.employeePerformance?.reduce((sum, e) => sum + (e.commission || 0), 0) || 0;
      return (
        <div className="report-content">
          <div className="employee-summary">
            <div className="employee-summary-card">
              <div className="summary-icon">💰</div>
              <div className="summary-value">₱{totalPayroll.toLocaleString()}</div>
              <div className="summary-label">Total Base Payroll</div>
            </div>
            <div className="employee-summary-card">
              <div className="summary-icon">💵</div>
              <div className="summary-value">₱{totalCommissions.toLocaleString()}</div>
              <div className="summary-label">Total Commissions</div>
            </div>
            <div className="employee-summary-card">
              <div className="summary-icon">📊</div>
              <div className="summary-value">₱{(totalPayroll + totalCommissions).toLocaleString()}</div>
              <div className="summary-label">Grand Total</div>
            </div>
          </div>

          <div className="top-performers">
            <h3>Payroll Summary</h3>
            <table className="performers-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Role</th>
                  <th className="right">Hours Worked</th>
                  <th className="right">Rate/Hour</th>
                  <th className="right">Base Pay</th>
                  <th className="right">Commission</th>
                  <th className="right">Total</th>
                </tr>
              </thead>
              <tbody>
                {reportData.employeePerformance?.map((emp) => {
                  const rate = emp.hourlyRate || 150;
                  const basePay = (emp.hoursWorked || 0) * rate;
                  return (
                    <tr key={emp.id}>
                      <td>{emp.name}</td>
                      <td>{emp.role}</td>
                      <td className="right">{(emp.hoursWorked || 0).toFixed(1)}h</td>
                      <td className="right">₱{rate.toFixed(2)}</td>
                      <td className="right">₱{basePay.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                      <td className="right">₱{(emp.commission || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                      <td className="right highlight">₱{(basePay + (emp.commission || 0)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="4"><strong>TOTAL</strong></td>
                  <td className="right"><strong>₱{totalPayroll.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></td>
                  <td className="right"><strong>₱{totalCommissions.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></td>
                  <td className="right highlight"><strong>₱{(totalPayroll + totalCommissions).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      );
    }

    if (selectedReport === 'commission') {
      const totalCommissions = reportData.employeePerformance?.reduce((sum, e) => sum + (e.commission || 0), 0) || 0;
      const totalRevenue = reportData.employeePerformance?.reduce((sum, e) => sum + (e.revenue || 0), 0) || 0;
      return (
        <div className="report-content">
          <div className="employee-summary">
            <div className="employee-summary-card">
              <div className="summary-icon">💵</div>
              <div className="summary-value">₱{totalCommissions.toLocaleString()}</div>
              <div className="summary-label">Total Commissions</div>
            </div>
            <div className="employee-summary-card">
              <div className="summary-icon">📈</div>
              <div className="summary-value">₱{totalRevenue.toLocaleString()}</div>
              <div className="summary-label">Total Revenue Generated</div>
            </div>
            <div className="employee-summary-card">
              <div className="summary-icon">📊</div>
              <div className="summary-value">10%</div>
              <div className="summary-label">Commission Rate</div>
            </div>
          </div>

          <div className="top-performers">
            <h3>Commission Report</h3>
            <table className="performers-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Employee</th>
                  <th>Role</th>
                  <th className="right">Services</th>
                  <th className="right">Revenue Generated</th>
                  <th className="right">Commission Rate</th>
                  <th className="right">Commission Earned</th>
                </tr>
              </thead>
              <tbody>
                {reportData.employeePerformance?.sort((a, b) => (b.commission || 0) - (a.commission || 0)).map((emp, index) => (
                  <tr key={emp.id}>
                    <td>
                      <span className={`rank-badge ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : 'default'}`}>
                        {index + 1}
                      </span>
                    </td>
                    <td>{emp.name}</td>
                    <td>{emp.role}</td>
                    <td className="right">{emp.services}</td>
                    <td className="right">₱{(emp.revenue || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    <td className="right">10%</td>
                    <td className="right highlight">₱{(emp.commission || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="4"><strong>TOTAL</strong></td>
                  <td className="right"><strong>₱{totalRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></td>
                  <td className="right">-</td>
                  <td className="right highlight"><strong>₱{totalCommissions.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      );
    }

    if (selectedReport === 'schedule') {
      return (
        <div className="report-content">
          <div className="employee-summary">
            <div className="employee-summary-card">
              <div className="summary-icon">👥</div>
              <div className="summary-value">{reportData.totalEmployees}</div>
              <div className="summary-label">Total Employees</div>
            </div>
            <div className="employee-summary-card">
              <div className="summary-icon">⏰</div>
              <div className="summary-value">{reportData.employeePerformance?.reduce((sum, e) => sum + (e.hoursWorked || 0), 0).toFixed(0)}h</div>
              <div className="summary-label">Total Hours Scheduled</div>
            </div>
            <div className="employee-summary-card">
              <div className="summary-icon">📊</div>
              <div className="summary-value">{(reportData.employeePerformance?.reduce((sum, e) => sum + (e.hoursWorked || 0), 0) / (reportData.totalEmployees || 1)).toFixed(1)}h</div>
              <div className="summary-label">Avg Hours/Employee</div>
            </div>
          </div>

          <div className="top-performers">
            <h3>Schedule Analysis</h3>
            <table className="performers-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Role</th>
                  <th className="right">Days Worked</th>
                  <th className="right">Hours Worked</th>
                  <th className="right">Avg Hours/Day</th>
                  <th className="right">Services Performed</th>
                  <th>Workload</th>
                </tr>
              </thead>
              <tbody>
                {reportData.employeePerformance?.map((emp) => {
                  const daysWorked = emp.totalDays || Math.ceil((emp.hoursWorked || 0) / 8);
                  const avgHoursPerDay = daysWorked > 0 ? (emp.hoursWorked || 0) / daysWorked : 0;
                  return (
                    <tr key={emp.id}>
                      <td>{emp.name}</td>
                      <td>{emp.role}</td>
                      <td className="right">{daysWorked}</td>
                      <td className="right">{(emp.hoursWorked || 0).toFixed(1)}h</td>
                      <td className="right">{avgHoursPerDay.toFixed(1)}h</td>
                      <td className="right">{emp.services}</td>
                      <td>
                        <span className={`status-badge ${avgHoursPerDay >= 8 ? 'warning' : avgHoursPerDay >= 6 ? 'success' : 'info'}`}>
                          {avgHoursPerDay >= 8 ? 'Heavy' : avgHoursPerDay >= 6 ? 'Normal' : 'Light'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (selectedReport === 'productivity') {
      const totalServices = reportData.employeePerformance?.reduce((sum, e) => sum + (e.services || 0), 0) || 0;
      const totalHours = reportData.employeePerformance?.reduce((sum, e) => sum + (e.hoursWorked || 0), 0) || 0;
      const avgServicesPerHour = totalHours > 0 ? (totalServices / totalHours) : 0;
      return (
        <div className="report-content">
          <div className="employee-summary">
            <div className="employee-summary-card">
              <div className="summary-icon">📊</div>
              <div className="summary-value">{totalServices}</div>
              <div className="summary-label">Total Services</div>
            </div>
            <div className="employee-summary-card">
              <div className="summary-icon">⏱️</div>
              <div className="summary-value">{avgServicesPerHour.toFixed(2)}</div>
              <div className="summary-label">Avg Services/Hour</div>
            </div>
            <div className="employee-summary-card">
              <div className="summary-icon">⭐</div>
              <div className="summary-value">{reportData.topPerformer?.name.split(' ')[0]}</div>
              <div className="summary-label">Most Productive</div>
            </div>
          </div>

          <div className="top-performers">
            <h3>Productivity Metrics</h3>
            <table className="performers-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Employee</th>
                  <th>Role</th>
                  <th className="right">Services</th>
                  <th className="right">Hours Worked</th>
                  <th className="right">Services/Hour</th>
                  <th className="right">Revenue/Hour</th>
                  <th>Productivity</th>
                </tr>
              </thead>
              <tbody>
                {reportData.employeePerformance?.sort((a, b) => {
                  const aRate = (a.hoursWorked || 0) > 0 ? (a.services || 0) / a.hoursWorked : 0;
                  const bRate = (b.hoursWorked || 0) > 0 ? (b.services || 0) / b.hoursWorked : 0;
                  return bRate - aRate;
                }).map((emp, index) => {
                  const servicesPerHour = (emp.hoursWorked || 0) > 0 ? (emp.services || 0) / emp.hoursWorked : 0;
                  const revenuePerHour = (emp.hoursWorked || 0) > 0 ? (emp.revenue || 0) / emp.hoursWorked : 0;
                  return (
                    <tr key={emp.id}>
                      <td>
                        <span className={`rank-badge ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : 'default'}`}>
                          {index + 1}
                        </span>
                      </td>
                      <td>{emp.name}</td>
                      <td>{emp.role}</td>
                      <td className="right">{emp.services}</td>
                      <td className="right">{(emp.hoursWorked || 0).toFixed(1)}h</td>
                      <td className="right">{servicesPerHour.toFixed(2)}</td>
                      <td className="right">₱{revenuePerHour.toFixed(0)}</td>
                      <td>
                        <span className={`status-badge ${servicesPerHour >= avgServicesPerHour ? 'success' : 'warning'}`}>
                          {servicesPerHour >= avgServicesPerHour ? 'Above Avg' : 'Below Avg'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
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
                  <span className="stat-value">₱{(emp.revenue || 0).toLocaleString()}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Commission</span>
                  <span className="stat-value">₱{(emp.commission || 0).toLocaleString()}</span>
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

    // Retention Analysis Report
    if (selectedReport === 'retention') {
      // Calculate retention metrics from customer data
      const totalCustomers = reportData.totalCustomers || 0;
      const returningCustomers = reportData.returningCustomers || 0;
      const retentionRate = reportData.retentionRate || 0;
      const churnRate = 100 - retentionRate;

      // Segment customers by visit frequency
      const customersByFrequency = {
        oneTime: 0,
        occasional: 0, // 2-3 visits
        regular: 0, // 4-6 visits
        loyal: 0 // 7+ visits
      };

      reportData.topCustomers?.forEach(customer => {
        const visits = customer.visits || 0;
        if (visits === 1) customersByFrequency.oneTime++;
        else if (visits <= 3) customersByFrequency.occasional++;
        else if (visits <= 6) customersByFrequency.regular++;
        else customersByFrequency.loyal++;
      });

      // Customers at risk (no visit in last 30 days with history of multiple visits)
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const atRiskCustomers = reportData.topCustomers?.filter(c => {
        const lastVisit = new Date(c.lastVisit);
        return c.visits > 1 && lastVisit < thirtyDaysAgo;
      }) || [];

      return (
        <div className="report-content">
          <div className="customer-insights">
            <div className="insight-card">
              <div className="insight-icon">📈</div>
              <div className="insight-value">{retentionRate}%</div>
              <div className="insight-label">Retention Rate</div>
            </div>
            <div className="insight-card">
              <div className="insight-icon">📉</div>
              <div className="insight-value negative">{churnRate.toFixed(1)}%</div>
              <div className="insight-label">Churn Rate</div>
            </div>
            <div className="insight-card">
              <div className="insight-icon">🔄</div>
              <div className="insight-value">{returningCustomers}</div>
              <div className="insight-label">Returning Customers</div>
            </div>
            <div className="insight-card">
              <div className="insight-icon">⚠️</div>
              <div className="insight-value warning">{atRiskCustomers.length}</div>
              <div className="insight-label">At Risk</div>
            </div>
            <div className="insight-card">
              <div className="insight-icon">💎</div>
              <div className="insight-value">{customersByFrequency.loyal}</div>
              <div className="insight-label">Loyal (7+ visits)</div>
            </div>
          </div>

          <div className="report-grid two-column">
            <div className="top-performers">
              <h3>Customer Segmentation by Visit Frequency</h3>
              <table className="performers-table">
                <thead>
                  <tr>
                    <th>Segment</th>
                    <th>Visits</th>
                    <th className="right">Customers</th>
                    <th className="right">% of Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>One-Time</td>
                    <td>1 visit</td>
                    <td className="right">{customersByFrequency.oneTime}</td>
                    <td className="right">{totalCustomers > 0 ? ((customersByFrequency.oneTime / totalCustomers) * 100).toFixed(1) : 0}%</td>
                    <td><span className="status-badge warning">Needs Engagement</span></td>
                  </tr>
                  <tr>
                    <td>Occasional</td>
                    <td>2-3 visits</td>
                    <td className="right">{customersByFrequency.occasional}</td>
                    <td className="right">{totalCustomers > 0 ? ((customersByFrequency.occasional / totalCustomers) * 100).toFixed(1) : 0}%</td>
                    <td><span className="status-badge info">Growing</span></td>
                  </tr>
                  <tr>
                    <td>Regular</td>
                    <td>4-6 visits</td>
                    <td className="right">{customersByFrequency.regular}</td>
                    <td className="right">{totalCustomers > 0 ? ((customersByFrequency.regular / totalCustomers) * 100).toFixed(1) : 0}%</td>
                    <td><span className="status-badge success">Active</span></td>
                  </tr>
                  <tr>
                    <td>Loyal</td>
                    <td>7+ visits</td>
                    <td className="right">{customersByFrequency.loyal}</td>
                    <td className="right">{totalCustomers > 0 ? ((customersByFrequency.loyal / totalCustomers) * 100).toFixed(1) : 0}%</td>
                    <td><span className="status-badge success">VIP</span></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="top-performers">
              <h3>At-Risk Customers (No visit in 30+ days)</h3>
              <table className="performers-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th className="right">Past Visits</th>
                    <th className="right">Total Spent</th>
                    <th>Last Visit</th>
                    <th>Days Inactive</th>
                  </tr>
                </thead>
                <tbody>
                  {atRiskCustomers.length > 0 ? atRiskCustomers.slice(0, 10).map((customer, index) => {
                    const lastVisit = new Date(customer.lastVisit);
                    const daysInactive = Math.floor((today - lastVisit) / (1000 * 60 * 60 * 24));
                    return (
                      <tr key={index}>
                        <td>
                          <div className="customer-info">
                            <div className="customer-name">{customer.name}</div>
                            {customer.phone && <div className="customer-phone">{customer.phone}</div>}
                          </div>
                        </td>
                        <td className="right">{customer.visits}</td>
                        <td className="right">₱{(customer.spent || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                        <td>{format(lastVisit, 'MMM dd, yyyy')}</td>
                        <td className="negative">{daysInactive} days</td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan="5" className="empty-message">No at-risk customers identified</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    // Loyalty Program Report
    if (selectedReport === 'loyalty') {
      // Calculate loyalty tiers based on spend
      const loyaltyTiers = {
        bronze: { min: 0, max: 5000, customers: [], totalSpend: 0 },
        silver: { min: 5001, max: 15000, customers: [], totalSpend: 0 },
        gold: { min: 15001, max: 30000, customers: [], totalSpend: 0 },
        platinum: { min: 30001, max: Infinity, customers: [], totalSpend: 0 }
      };

      reportData.topCustomers?.forEach(customer => {
        const spent = customer.spent || 0;
        if (spent <= 5000) {
          loyaltyTiers.bronze.customers.push(customer);
          loyaltyTiers.bronze.totalSpend += spent;
        } else if (spent <= 15000) {
          loyaltyTiers.silver.customers.push(customer);
          loyaltyTiers.silver.totalSpend += spent;
        } else if (spent <= 30000) {
          loyaltyTiers.gold.customers.push(customer);
          loyaltyTiers.gold.totalSpend += spent;
        } else {
          loyaltyTiers.platinum.customers.push(customer);
          loyaltyTiers.platinum.totalSpend += spent;
        }
      });

      const totalLoyaltySpend = Object.values(loyaltyTiers).reduce((sum, tier) => sum + tier.totalSpend, 0);
      const totalLoyaltyCustomers = reportData.topCustomers?.length || 0;

      // Estimate points (1 point per ₱100 spent)
      const estimatedTotalPoints = Math.floor(totalLoyaltySpend / 100);

      return (
        <div className="report-content">
          <div className="customer-insights">
            <div className="insight-card">
              <div className="insight-icon">👥</div>
              <div className="insight-value">{totalLoyaltyCustomers}</div>
              <div className="insight-label">Program Members</div>
            </div>
            <div className="insight-card">
              <div className="insight-icon">💰</div>
              <div className="insight-value">₱{totalLoyaltySpend.toLocaleString('en-PH')}</div>
              <div className="insight-label">Total Member Spend</div>
            </div>
            <div className="insight-card">
              <div className="insight-icon">⭐</div>
              <div className="insight-value">{estimatedTotalPoints.toLocaleString()}</div>
              <div className="insight-label">Est. Points Earned</div>
            </div>
            <div className="insight-card">
              <div className="insight-icon">💎</div>
              <div className="insight-value">{loyaltyTiers.platinum.customers.length + loyaltyTiers.gold.customers.length}</div>
              <div className="insight-label">Premium Members</div>
            </div>
            <div className="insight-card">
              <div className="insight-icon">📊</div>
              <div className="insight-value">₱{totalLoyaltyCustomers > 0 ? Math.round(totalLoyaltySpend / totalLoyaltyCustomers).toLocaleString('en-PH') : 0}</div>
              <div className="insight-label">Avg Member Spend</div>
            </div>
          </div>

          <div className="top-performers">
            <h3>Loyalty Tier Distribution</h3>
            <table className="performers-table">
              <thead>
                <tr>
                  <th>Tier</th>
                  <th>Spend Range</th>
                  <th className="right">Members</th>
                  <th className="right">% of Members</th>
                  <th className="right">Total Spend</th>
                  <th className="right">% of Revenue</th>
                  <th>Benefits</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span className="tier-badge platinum">Platinum</span></td>
                  <td>₱30,001+</td>
                  <td className="right">{loyaltyTiers.platinum.customers.length}</td>
                  <td className="right">{totalLoyaltyCustomers > 0 ? ((loyaltyTiers.platinum.customers.length / totalLoyaltyCustomers) * 100).toFixed(1) : 0}%</td>
                  <td className="right">₱{loyaltyTiers.platinum.totalSpend.toLocaleString('en-PH')}</td>
                  <td className="right">{totalLoyaltySpend > 0 ? ((loyaltyTiers.platinum.totalSpend / totalLoyaltySpend) * 100).toFixed(1) : 0}%</td>
                  <td>20% off, Priority booking</td>
                </tr>
                <tr>
                  <td><span className="tier-badge gold">Gold</span></td>
                  <td>₱15,001 - ₱30,000</td>
                  <td className="right">{loyaltyTiers.gold.customers.length}</td>
                  <td className="right">{totalLoyaltyCustomers > 0 ? ((loyaltyTiers.gold.customers.length / totalLoyaltyCustomers) * 100).toFixed(1) : 0}%</td>
                  <td className="right">₱{loyaltyTiers.gold.totalSpend.toLocaleString('en-PH')}</td>
                  <td className="right">{totalLoyaltySpend > 0 ? ((loyaltyTiers.gold.totalSpend / totalLoyaltySpend) * 100).toFixed(1) : 0}%</td>
                  <td>15% off, Free add-ons</td>
                </tr>
                <tr>
                  <td><span className="tier-badge silver">Silver</span></td>
                  <td>₱5,001 - ₱15,000</td>
                  <td className="right">{loyaltyTiers.silver.customers.length}</td>
                  <td className="right">{totalLoyaltyCustomers > 0 ? ((loyaltyTiers.silver.customers.length / totalLoyaltyCustomers) * 100).toFixed(1) : 0}%</td>
                  <td className="right">₱{loyaltyTiers.silver.totalSpend.toLocaleString('en-PH')}</td>
                  <td className="right">{totalLoyaltySpend > 0 ? ((loyaltyTiers.silver.totalSpend / totalLoyaltySpend) * 100).toFixed(1) : 0}%</td>
                  <td>10% off selected services</td>
                </tr>
                <tr>
                  <td><span className="tier-badge bronze">Bronze</span></td>
                  <td>₱0 - ₱5,000</td>
                  <td className="right">{loyaltyTiers.bronze.customers.length}</td>
                  <td className="right">{totalLoyaltyCustomers > 0 ? ((loyaltyTiers.bronze.customers.length / totalLoyaltyCustomers) * 100).toFixed(1) : 0}%</td>
                  <td className="right">₱{loyaltyTiers.bronze.totalSpend.toLocaleString('en-PH')}</td>
                  <td className="right">{totalLoyaltySpend > 0 ? ((loyaltyTiers.bronze.totalSpend / totalLoyaltySpend) * 100).toFixed(1) : 0}%</td>
                  <td>5% off, Birthday reward</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="2"><strong>Total</strong></td>
                  <td className="right"><strong>{totalLoyaltyCustomers}</strong></td>
                  <td className="right"><strong>100%</strong></td>
                  <td className="right"><strong>₱{totalLoyaltySpend.toLocaleString('en-PH')}</strong></td>
                  <td className="right"><strong>100%</strong></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="top-performers">
            <h3>Top Loyalty Members</h3>
            <table className="performers-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Member</th>
                  <th>Tier</th>
                  <th className="right">Total Spent</th>
                  <th className="right">Est. Points</th>
                  <th className="right">Visits</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {reportData.topCustomers?.slice(0, 10).map((customer, index) => {
                  const spent = customer.spent || 0;
                  const tier = spent > 30000 ? 'platinum' : spent > 15000 ? 'gold' : spent > 5000 ? 'silver' : 'bronze';
                  const points = Math.floor(spent / 100);
                  return (
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
                      <td><span className={`tier-badge ${tier}`}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</span></td>
                      <td className="right">₱{spent.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                      <td className="right">{points.toLocaleString()}</td>
                      <td className="right">{customer.visits}</td>
                      <td><span className="status-badge success">Active</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // Default: Customer Insights Report
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
            <div className="insight-value">₱{(reportData.avgSpend || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
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
                  <td className="right">₱{(customer.spent || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                  <td className="right">₱{((customer.spent || 0) / (customer.visits || 1)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
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
        {!embedded && (
          <div className="page-header">
            <div>
              <h1>Reports & Analytics</h1>
              <p>Comprehensive business intelligence and performance insights</p>
            </div>
          </div>
        )}

        <div className="report-categories">
          {reportCategories.map(category => (
            <div
              key={category.id}
              className={`report-category-card ${category.id}`}
              onClick={() => setSelectedCategory(category.id)}
            >
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
                  {report.name}
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
