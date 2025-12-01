import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi/mockApi';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

const AIChatbot = () => {
  const { showToast } = useApp();
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'bot',
      text: 'Hello! I\'m Ava, your AI business assistant. I\'m connected to your real business data and can help you with insights, analytics, and quick actions. How can I assist you today?',
      timestamp: new Date().toISOString(),
      suggestions: [
        'Show today\'s sales summary',
        'What are my top services?',
        'Show inventory alerts',
        'Customer analytics'
      ]
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef(null);

  // Real business data from API
  const [businessData, setBusinessData] = useState({
    transactions: [],
    products: [],
    employees: [],
    customers: [],
    appointments: [],
    advanceBookings: [],
    attendance: [],
    rooms: [],
    dataLoaded: false
  });

  // Load real data on mount
  useEffect(() => {
    loadBusinessData();
  }, []);

  const loadBusinessData = async () => {
    try {
      const [transactions, products, employees, customers, appointments, advanceBookings, attendance, rooms] = await Promise.all([
        mockApi.transactions.getTransactions(),
        mockApi.products.getProducts(),
        mockApi.employees.getEmployees(),
        mockApi.customers.getCustomers(),
        mockApi.appointments.getAppointments(),
        mockApi.advanceBooking.listAdvanceBookings(),
        mockApi.attendance.getAttendance(),
        mockApi.rooms.getRooms()
      ]);

      setBusinessData({
        transactions,
        products,
        employees,
        customers,
        appointments,
        advanceBookings,
        attendance,
        rooms,
        dataLoaded: true
      });
    } catch (error) {
      console.error('Failed to load business data:', error);
    }
  };

  // Helper functions to calculate real metrics
  const getTodaysSales = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const todayTxns = businessData.transactions.filter(t => {
      const txnDate = format(new Date(t.date || t.createdAt), 'yyyy-MM-dd');
      return txnDate === today;
    });
    const totalRevenue = todayTxns.reduce((sum, t) => sum + (t.totalAmount || t.total || 0), 0);
    return {
      revenue: totalRevenue,
      count: todayTxns.length,
      average: todayTxns.length > 0 ? totalRevenue / todayTxns.length : 0
    };
  };

  const getWeekSales = () => {
    const weekAgo = subDays(new Date(), 7);
    const weekTxns = businessData.transactions.filter(t => {
      const txnDate = new Date(t.date || t.createdAt);
      return txnDate >= weekAgo;
    });
    return weekTxns.reduce((sum, t) => sum + (t.totalAmount || t.total || 0), 0);
  };

  const getTopServices = () => {
    const serviceStats = {};
    businessData.transactions.forEach(t => {
      t.items?.forEach(item => {
        if (item.type === 'service' || !item.type) {
          const name = item.name;
          if (!serviceStats[name]) {
            serviceStats[name] = { name, bookings: 0, revenue: 0 };
          }
          serviceStats[name].bookings += item.quantity || 1;
          serviceStats[name].revenue += (item.price * (item.quantity || 1)) || item.subtotal || 0;
        }
      });
    });
    return Object.values(serviceStats).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  };

  const getLowStockItems = () => {
    return businessData.products
      .filter(p => p.type === 'product' && p.stock <= (p.lowStockAlert || 5))
      .map(p => ({
        name: p.name,
        stock: p.stock,
        threshold: p.lowStockAlert || 5,
        isOutOfStock: p.stock === 0
      }))
      .sort((a, b) => a.stock - b.stock);
  };

  const getCustomerStats = () => {
    const customers = businessData.customers;
    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();
    const newThisMonth = customers.filter(c => {
      const createdDate = new Date(c.createdAt);
      return createdDate.getMonth() === thisMonth && createdDate.getFullYear() === thisYear;
    }).length;

    // Calculate average spend
    const customerSpend = {};
    businessData.transactions.forEach(t => {
      const customerId = t.customer?.id || t.customer?._id;
      if (customerId) {
        customerSpend[customerId] = (customerSpend[customerId] || 0) + (t.totalAmount || t.total || 0);
      }
    });
    const spends = Object.values(customerSpend);
    const avgSpend = spends.length > 0 ? spends.reduce((a, b) => a + b, 0) / spends.length : 0;

    return {
      total: customers.length,
      newThisMonth,
      averageSpend: Math.round(avgSpend)
    };
  };

  const getTodaysAppointments = () => {
    const today = format(new Date(), 'yyyy-MM-dd');

    // From advance bookings
    const todayBookings = businessData.advanceBookings.filter(b => {
      const bookingDate = format(new Date(b.bookingDateTime), 'yyyy-MM-dd');
      return bookingDate === today && b.status !== 'cancelled';
    }).map(b => ({
      time: format(new Date(b.bookingDateTime), 'hh:mm a'),
      customer: b.clientName,
      service: b.serviceName,
      status: b.status,
      employee: b.employeeName
    }));

    // From appointments
    const todayAppts = businessData.appointments.filter(a => {
      const apptDate = format(new Date(a.dateTime || a.date), 'yyyy-MM-dd');
      return apptDate === today;
    }).map(a => ({
      time: format(new Date(a.dateTime || a.date), 'hh:mm a'),
      customer: a.customer?.name || a.customerName,
      service: a.service?.name || a.serviceName,
      status: a.status,
      employee: a.employee?.name || a.employeeName
    }));

    return [...todayBookings, ...todayAppts].sort((a, b) =>
      new Date('2000-01-01 ' + a.time) - new Date('2000-01-01 ' + b.time)
    );
  };

  const getEmployeeStats = () => {
    const activeEmployees = businessData.employees.filter(e => e.status === 'active');
    const today = format(new Date(), 'yyyy-MM-dd');
    const todayAttendance = businessData.attendance.filter(a => {
      const attDate = format(new Date(a.date), 'yyyy-MM-dd');
      return attDate === today;
    });
    const presentCount = todayAttendance.filter(a => a.status === 'present').length;

    // Calculate today's commissions from transactions
    const todayTxns = businessData.transactions.filter(t => {
      const txnDate = format(new Date(t.date || t.createdAt), 'yyyy-MM-dd');
      return txnDate === today;
    });
    const totalCommission = todayTxns.reduce((sum, t) => sum + (t.employee?.commission || 0), 0);

    // Top performer
    const employeeRevenue = {};
    todayTxns.forEach(t => {
      const empId = t.employee?.id || t.employee?._id;
      const empName = t.employee?.name;
      if (empId && empName) {
        if (!employeeRevenue[empId]) {
          employeeRevenue[empId] = { name: empName, revenue: 0, services: 0 };
        }
        employeeRevenue[empId].revenue += t.totalAmount || t.total || 0;
        employeeRevenue[empId].services += t.items?.length || 1;
      }
    });
    const topPerformer = Object.values(employeeRevenue).sort((a, b) => b.revenue - a.revenue)[0];

    return {
      total: activeEmployees.length,
      presentToday: presentCount,
      totalCommission,
      topPerformer
    };
  };

  const getRoomStatus = () => {
    const rooms = businessData.rooms;
    const occupied = rooms.filter(r => r.status === 'occupied').length;
    const available = rooms.filter(r => r.status === 'available').length;
    const maintenance = rooms.filter(r => r.status === 'maintenance').length;
    return { total: rooms.length, occupied, available, maintenance };
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateAIResponse = (userMessage) => {
    const lowerMessage = userMessage.toLowerCase();

    // Check if data is loaded
    if (!businessData.dataLoaded) {
      return {
        text: `⏳ I'm still loading your business data. Please wait a moment and try again.`,
        suggestions: ['Refresh data', 'Help']
      };
    }

    // Sales queries
    if (lowerMessage.includes('sales') || lowerMessage.includes('revenue')) {
      const sales = getTodaysSales();
      const weekSales = getWeekSales();
      const performance = sales.revenue > 0 ? '✨ Great work!' : '📈 Let\'s boost those numbers!';

      return {
        text: `📊 **Today's Sales Summary (Live Data):**\n\n💰 Total Revenue: ₱${sales.revenue.toLocaleString()}\n📝 Transactions: ${sales.count}\n📈 Average Transaction: ₱${Math.round(sales.average).toLocaleString()}\n\n📅 **This Week:** ₱${weekSales.toLocaleString()}\n\n${performance}`,
        suggestions: ['Top services', 'Customer analytics', 'Show inventory alerts']
      };
    }

    // Service queries
    if (lowerMessage.includes('service') || lowerMessage.includes('top') || lowerMessage.includes('popular')) {
      const topServices = getTopServices();

      if (topServices.length === 0) {
        return {
          text: `🏆 **Top Services:**\n\nNo service data available yet. Complete some transactions to see your top performers!`,
          suggestions: ['Show today\'s sales', 'Inventory alerts', 'Customer analytics']
        };
      }

      const servicesText = topServices
        .map((s, i) => `${i + 1}. **${s.name}**\n   📅 ${s.bookings} bookings | 💰 ₱${s.revenue.toLocaleString()}`)
        .join('\n\n');

      return {
        text: `🏆 **Top Services (Based on Real Data):**\n\n${servicesText}\n\n💡 ${topServices[0]?.name || 'Your top service'} is your best performer!`,
        suggestions: ['Show today\'s sales', 'Employee performance', 'Customer analytics']
      };
    }

    // Inventory queries
    if (lowerMessage.includes('inventory') || lowerMessage.includes('stock') || lowerMessage.includes('alert')) {
      const lowStock = getLowStockItems();

      if (lowStock.length === 0) {
        return {
          text: `📦 **Inventory Status:**\n\n✅ All products are well-stocked!\n\n📊 Total Products: ${businessData.products.filter(p => p.type === 'product').length}\n\nNo immediate restocking required.`,
          suggestions: ['Show today\'s sales', 'Top services', 'Customer analytics']
        };
      }

      const outOfStock = lowStock.filter(i => i.isOutOfStock);
      const lowItems = lowStock.filter(i => !i.isOutOfStock);

      let itemsText = '';
      if (outOfStock.length > 0) {
        itemsText += '🔴 **Out of Stock:**\n' + outOfStock.map(item => `• ${item.name}`).join('\n') + '\n\n';
      }
      if (lowItems.length > 0) {
        itemsText += '⚠️ **Low Stock:**\n' + lowItems.map(item => `• **${item.name}** - ${item.stock} remaining (threshold: ${item.threshold})`).join('\n');
      }

      return {
        text: `📦 **Inventory Alerts (Live Data):**\n\n${itemsText}\n\n🔔 Recommendation: Place orders soon to avoid stockouts.`,
        suggestions: ['Show all products', 'Top services', 'Show today\'s sales'],
        action: 'inventory_alert'
      };
    }

    // Customer queries
    if (lowerMessage.includes('customer') || lowerMessage.includes('client')) {
      const stats = getCustomerStats();

      return {
        text: `👥 **Customer Analytics (Live Data):**\n\n📊 Total Customers: ${stats.total}\n✨ New This Month: ${stats.newThisMonth}\n💰 Average Spend: ₱${stats.averageSpend.toLocaleString()}\n\n📈 ${stats.newThisMonth > 0 ? `Great job! You've acquired ${stats.newThisMonth} new customers this month.` : 'Focus on marketing to attract new customers!'}`,
        suggestions: ['Top services', 'Show today\'s sales', 'Show appointments']
      };
    }

    // Appointment queries
    if (lowerMessage.includes('appointment') || lowerMessage.includes('booking') || lowerMessage.includes('schedule')) {
      const appointments = getTodaysAppointments();

      if (appointments.length === 0) {
        return {
          text: `📅 **Today's Appointments:**\n\n📭 No appointments scheduled for today.\n\n💡 Consider running a promotion to fill empty slots!`,
          suggestions: ['Show today\'s sales', 'Customer analytics', 'Employee status']
        };
      }

      const appointmentsText = appointments.slice(0, 5)
        .map(apt => `🕐 **${apt.time}** - ${apt.customer}\n   ${apt.service}${apt.employee ? ` (${apt.employee})` : ''}\n   Status: ${apt.status}`)
        .join('\n\n');

      const moreText = appointments.length > 5 ? `\n\n📋 ...and ${appointments.length - 5} more appointments` : '';

      return {
        text: `📅 **Today's Appointments (Live Data):**\n\n${appointmentsText}${moreText}\n\n✅ Total: ${appointments.length} appointments today`,
        suggestions: ['Employee status', 'Room availability', 'Show today\'s sales']
      };
    }

    // Employee queries
    if (lowerMessage.includes('employee') || lowerMessage.includes('staff') || lowerMessage.includes('therapist')) {
      const empStats = getEmployeeStats();

      let topPerformerText = '';
      if (empStats.topPerformer) {
        topPerformerText = `\n🏆 Top performer: ${empStats.topPerformer.name} (${empStats.topPerformer.services} services, ₱${empStats.topPerformer.revenue.toLocaleString()})`;
      }

      return {
        text: `👨‍💼 **Employee Insights (Live Data):**\n\n👥 Active Employees: ${empStats.total}\n✅ Present Today: ${empStats.presentToday}\n💰 Today's Commissions: ₱${empStats.totalCommission.toLocaleString()}${topPerformerText}\n\n📊 Attendance Rate: ${empStats.total > 0 ? Math.round((empStats.presentToday / empStats.total) * 100) : 0}%`,
        suggestions: ['Show today\'s sales', 'Show appointments', 'Room status']
      };
    }

    // Room queries
    if (lowerMessage.includes('room') || lowerMessage.includes('availability')) {
      const roomStatus = getRoomStatus();

      return {
        text: `🚪 **Room Status (Live Data):**\n\n📊 Total Rooms: ${roomStatus.total}\n✅ Available: ${roomStatus.available}\n🔴 Occupied: ${roomStatus.occupied}\n🔧 Maintenance: ${roomStatus.maintenance}\n\n📈 Utilization: ${roomStatus.total > 0 ? Math.round((roomStatus.occupied / roomStatus.total) * 100) : 0}%`,
        suggestions: ['Show appointments', 'Employee status', 'Show today\'s sales']
      };
    }

    // Business overview
    if (lowerMessage.includes('overview') || lowerMessage.includes('summary') || lowerMessage.includes('dashboard')) {
      const sales = getTodaysSales();
      const appointments = getTodaysAppointments();
      const lowStock = getLowStockItems();
      const empStats = getEmployeeStats();

      return {
        text: `📊 **Business Overview (Live Data):**\n\n💰 **Today's Revenue:** ₱${sales.revenue.toLocaleString()} (${sales.count} transactions)\n\n📅 **Appointments:** ${appointments.length} scheduled\n\n👥 **Staff:** ${empStats.presentToday}/${empStats.total} present\n\n📦 **Inventory:** ${lowStock.length > 0 ? `⚠️ ${lowStock.length} items need attention` : '✅ All stocked'}\n\n${sales.revenue > 10000 ? '🎉 Great day so far!' : '💪 Keep pushing!'}`,
        suggestions: ['Show today\'s sales', 'Top services', 'Inventory alerts']
      };
    }

    // Help queries
    if (lowerMessage.includes('help') || lowerMessage.includes('what can you')) {
      return {
        text: `🤖 **I can help you with (using REAL data):**\n\n📊 Sales & revenue tracking\n💰 Business analytics\n📅 Appointment management\n👥 Customer insights\n📦 Inventory monitoring\n👨‍💼 Employee performance\n🚪 Room availability\n\n💡 I'm connected to your live business data - just ask!`,
        suggestions: ['Business overview', 'Show today\'s sales', 'Top services', 'Inventory alerts']
      };
    }

    // Greeting queries
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
      const sales = getTodaysSales();
      return {
        text: `👋 Hello! I'm Ava, connected to your live business data.\n\n📊 Quick update: You've made ₱${sales.revenue.toLocaleString()} today from ${sales.count} transactions.\n\nWhat would you like to know?`,
        suggestions: ['Business overview', 'Top services', 'Inventory alerts']
      };
    }

    // Refresh data
    if (lowerMessage.includes('refresh')) {
      loadBusinessData();
      return {
        text: `🔄 Refreshing business data...\n\nYour data has been updated! Ask me anything about your business.`,
        suggestions: ['Business overview', 'Show today\'s sales', 'Inventory alerts']
      };
    }

    // Default response
    return {
      text: `I understand you're asking about "${userMessage}".\n\n💡 I can provide real-time insights on:\n• Sales & revenue ("show today's sales")\n• Top services ("what are my top services?")\n• Inventory ("show inventory alerts")\n• Customers ("customer analytics")\n• Appointments ("today's appointments")\n• Employees ("employee status")\n• Rooms ("room availability")\n• Overview ("business overview")`,
      suggestions: ['Business overview', 'Show today\'s sales', 'Top services', 'Help']
    };
  };

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    // Add user message
    const userMsg = {
      id: messages.length + 1,
      type: 'user',
      text: inputMessage,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsTyping(true);

    // Simulate AI thinking time
    setTimeout(() => {
      const aiResponse = generateAIResponse(inputMessage);
      const botMsg = {
        id: messages.length + 2,
        type: 'bot',
        text: aiResponse.text,
        timestamp: new Date().toISOString(),
        suggestions: aiResponse.suggestions || [],
        action: aiResponse.action
      };

      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);

      // Show action notification if applicable
      if (aiResponse.action === 'inventory_alert') {
        showToast('Inventory alerts detected! Check inventory page for details.', 'warning');
      }
    }, 1000 + Math.random() * 1000);
  };

  const handleSuggestionClick = (suggestion) => {
    setInputMessage(suggestion);
    // Auto-send after a short delay
    setTimeout(() => {
      const input = suggestion;
      setInputMessage('');

      const userMsg = {
        id: messages.length + 1,
        type: 'user',
        text: input,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, userMsg]);
      setIsTyping(true);

      setTimeout(() => {
        const aiResponse = generateAIResponse(input);
        const botMsg = {
          id: messages.length + 2,
          type: 'bot',
          text: aiResponse.text,
          timestamp: new Date().toISOString(),
          suggestions: aiResponse.suggestions || [],
          action: aiResponse.action
        };

        setMessages(prev => [...prev, botMsg]);
        setIsTyping(false);
      }, 1000 + Math.random() * 1000);
    }, 100);
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 1,
        type: 'bot',
        text: 'Chat cleared! I\'m Ava, ready to help. What would you like to know?',
        timestamp: new Date().toISOString(),
        suggestions: [
          'Show today\'s sales summary',
          'What are my top services?',
          'Show inventory alerts',
          'Customer analytics'
        ]
      }
    ]);
    showToast('Chat history cleared', 'success');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="chatbot-page">
      <div className="page-header">
        <div>
          <h1>✨ Ava</h1>
          <p>Your AI business assistant - Get instant insights and manage your spa with ease</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={handleClearChat}>
            🗑️ Clear Chat
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? '⬆️ Expand' : '⬇️ Minimize'}
          </button>
        </div>
      </div>

      <div className={`chatbot-container ${isMinimized ? 'minimized' : ''}`}>
        {!isMinimized && (
          <>
            {/* Chat Messages */}
            <div className="chat-messages">
              {messages.map(message => (
                <div key={message.id} className={`message ${message.type}`}>
                  <div className="message-avatar">
                    {message.type === 'bot' ? '✨' : '👤'}
                  </div>
                  <div className="message-content">
                    <div className="message-header">
                      <span className="message-sender">
                        {message.type === 'bot' ? 'Ava' : 'You'}
                      </span>
                      <span className="message-time">
                        {new Date(message.timestamp).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className="message-text">
                      {message.text.split('\n').map((line, i) => (
                        <React.Fragment key={i}>
                          {line.includes('**') ? (
                            <strong>{line.replace(/\*\*/g, '')}</strong>
                          ) : (
                            line
                          )}
                          {i < message.text.split('\n').length - 1 && <br />}
                        </React.Fragment>
                      ))}
                    </div>
                    {message.suggestions && message.suggestions.length > 0 && (
                      <div className="message-suggestions">
                        {message.suggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            className="suggestion-chip"
                            onClick={() => handleSuggestionClick(suggestion)}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="message bot">
                  <div className="message-avatar">✨</div>
                  <div className="message-content">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <div className="chat-input-container">
              <div className="chat-input-wrapper">
                <textarea
                  className="chat-input"
                  placeholder="Ask me anything about your business..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  rows="1"
                  disabled={isTyping}
                />
                <button
                  className="btn btn-primary send-btn"
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || isTyping}
                >
                  {isTyping ? '⏳' : '📤'} Send
                </button>
              </div>
              <div className="chat-input-hint">
                💡 Press Enter to send, Shift+Enter for new line
              </div>
            </div>
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="quick-actions-panel">
        <h3>Quick Actions</h3>
        <div className="quick-actions-grid">
          <button className="quick-action-btn" onClick={() => handleSuggestionClick('Show today\'s sales summary')}>
            <div className="quick-action-icon">📊</div>
            <div className="quick-action-label">Sales Summary</div>
          </button>
          <button className="quick-action-btn" onClick={() => handleSuggestionClick('What are my top services?')}>
            <div className="quick-action-icon">🏆</div>
            <div className="quick-action-label">Top Services</div>
          </button>
          <button className="quick-action-btn" onClick={() => handleSuggestionClick('Show inventory alerts')}>
            <div className="quick-action-icon">📦</div>
            <div className="quick-action-label">Inventory</div>
          </button>
          <button className="quick-action-btn" onClick={() => handleSuggestionClick('Customer analytics')}>
            <div className="quick-action-icon">👥</div>
            <div className="quick-action-label">Customers</div>
          </button>
          <button className="quick-action-btn" onClick={() => handleSuggestionClick('Show upcoming appointments')}>
            <div className="quick-action-icon">📅</div>
            <div className="quick-action-label">Appointments</div>
          </button>
          <button className="quick-action-btn" onClick={() => handleSuggestionClick('Employee performance today')}>
            <div className="quick-action-icon">👨‍💼</div>
            <div className="quick-action-label">Employees</div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIChatbot;
