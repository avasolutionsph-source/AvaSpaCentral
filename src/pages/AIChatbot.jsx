import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';

const AIChatbot = () => {
  const { showToast } = useApp();
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'bot',
      text: 'Hello! I\'m your AI assistant for Ava Solutions Demo SPA. I can help you with business insights, analytics, and quick actions. How can I assist you today?',
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

  // Mock business data for AI responses
  const mockData = {
    todaySales: 45230,
    todayTransactions: 28,
    topServices: [
      { name: 'Swedish Massage', bookings: 156, revenue: 234000 },
      { name: 'Hot Stone Therapy', bookings: 142, revenue: 213000 },
      { name: 'Deep Tissue Massage', bookings: 128, revenue: 192000 }
    ],
    lowStockItems: [
      { name: 'Massage Oil', quantity: 5, unit: 'bottles' },
      { name: 'Towels', quantity: 12, unit: 'pieces' },
      { name: 'Aromatherapy Candles', quantity: 8, unit: 'pieces' }
    ],
    customerStats: {
      total: 324,
      newThisMonth: 45,
      retentionRate: 78,
      averageSpend: 1850
    },
    upcomingAppointments: [
      { time: '10:00 AM', customer: 'Maria Santos', service: 'Swedish Massage' },
      { time: '11:30 AM', customer: 'Juan dela Cruz', service: 'Hot Stone Therapy' },
      { time: '02:00 PM', customer: 'Ana Reyes', service: 'Deep Tissue Massage' }
    ]
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateAIResponse = (userMessage) => {
    const lowerMessage = userMessage.toLowerCase();

    // Sales queries
    if (lowerMessage.includes('sales') || lowerMessage.includes('revenue')) {
      return {
        text: `📊 **Today's Sales Summary:**\n\n💰 Total Revenue: ₱${mockData.todaySales.toLocaleString()}\n📝 Transactions: ${mockData.todayTransactions}\n📈 Average Transaction: ₱${Math.round(mockData.todaySales / mockData.todayTransactions).toLocaleString()}\n\n✨ Great performance today! You're up 15% from yesterday.`,
        suggestions: ['Show weekly trends', 'Compare with last month', 'Top customers today']
      };
    }

    // Service queries
    if (lowerMessage.includes('service') || lowerMessage.includes('top') || lowerMessage.includes('popular')) {
      const servicesText = mockData.topServices
        .map((s, i) => `${i + 1}. **${s.name}**\n   📅 ${s.bookings} bookings | 💰 ₱${s.revenue.toLocaleString()}`)
        .join('\n\n');

      return {
        text: `🏆 **Top Services This Month:**\n\n${servicesText}\n\n💡 Swedish Massage continues to be your best performer!`,
        suggestions: ['Service revenue breakdown', 'Employee performance', 'Schedule optimization']
      };
    }

    // Inventory queries
    if (lowerMessage.includes('inventory') || lowerMessage.includes('stock') || lowerMessage.includes('alert')) {
      const itemsText = mockData.lowStockItems
        .map(item => `⚠️ **${item.name}** - Only ${item.quantity} ${item.unit} remaining`)
        .join('\n');

      return {
        text: `📦 **Low Stock Alerts:**\n\n${itemsText}\n\n🔔 Recommendation: Place orders for these items soon to avoid stockouts.`,
        suggestions: ['Generate purchase order', 'Show all inventory', 'Set reorder alerts'],
        action: 'inventory_alert'
      };
    }

    // Customer queries
    if (lowerMessage.includes('customer') || lowerMessage.includes('client')) {
      return {
        text: `👥 **Customer Analytics:**\n\n📊 Total Customers: ${mockData.customerStats.total}\n✨ New This Month: ${mockData.customerStats.newThisMonth}\n🔄 Retention Rate: ${mockData.customerStats.retentionRate}%\n💰 Average Spend: ₱${mockData.customerStats.averageSpend.toLocaleString()}\n\n📈 Your retention rate is excellent! Keep up the great customer service.`,
        suggestions: ['Top customers', 'Birthday reminders', 'Loyalty program status']
      };
    }

    // Appointment queries
    if (lowerMessage.includes('appointment') || lowerMessage.includes('booking') || lowerMessage.includes('schedule')) {
      const appointmentsText = mockData.upcomingAppointments
        .map(apt => `🕐 **${apt.time}** - ${apt.customer}\n   ${apt.service}`)
        .join('\n\n');

      return {
        text: `📅 **Upcoming Appointments Today:**\n\n${appointmentsText}\n\n✅ All appointments confirmed and ready!`,
        suggestions: ['View full calendar', 'Check availability', 'Staff assignments']
      };
    }

    // Employee queries
    if (lowerMessage.includes('employee') || lowerMessage.includes('staff') || lowerMessage.includes('therapist')) {
      return {
        text: `👨‍💼 **Employee Insights:**\n\n👍 All staff members are checked in\n⭐ Average rating: 4.8/5.0\n📊 Today's utilization: 85%\n💰 Total commissions: ₱12,450\n\n🏆 Top performer today: Maria Garcia (12 services)`,
        suggestions: ['Staff performance report', 'Attendance summary', 'Commission breakdown']
      };
    }

    // Help queries
    if (lowerMessage.includes('help') || lowerMessage.includes('what can you')) {
      return {
        text: `🤖 **I can help you with:**\n\n📊 Business analytics and insights\n💰 Sales and revenue tracking\n📅 Appointment management\n👥 Customer analytics\n📦 Inventory monitoring\n👨‍💼 Employee performance\n📈 Trend analysis\n\n💡 Just ask me anything about your business!`,
        suggestions: ['Show today\'s sales', 'Top services', 'Inventory alerts', 'Customer stats']
      };
    }

    // Greeting queries
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
      return {
        text: `👋 Hello! I'm here to help you manage your spa business more efficiently. What would you like to know?`,
        suggestions: ['Business overview', 'Today\'s summary', 'Quick insights']
      };
    }

    // Default response
    return {
      text: `I understand you're asking about "${userMessage}". While I can provide insights on sales, services, inventory, customers, appointments, and employees, I need more context.\n\n💡 Try asking:\n• "Show today's sales summary"\n• "What are my top services?"\n• "Show inventory alerts"\n• "Customer analytics"`,
      suggestions: ['Show today\'s sales', 'Top services', 'Inventory alerts', 'Help']
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
        text: 'Chat cleared! How can I assist you?',
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
          <h1>🤖 AI Assistant</h1>
          <p>Get instant insights and manage your spa business with AI-powered assistance</p>
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
        {/* Chat Stats */}
        <div className="chat-stats">
          <div className="stat-card">
            <div className="stat-icon">💬</div>
            <div className="stat-info">
              <div className="stat-label">Messages</div>
              <div className="stat-value">{messages.length}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🤖</div>
            <div className="stat-info">
              <div className="stat-label">AI Status</div>
              <div className="stat-value">
                <span className="status-badge active">Active</span>
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⚡</div>
            <div className="stat-info">
              <div className="stat-label">Response Time</div>
              <div className="stat-value">~1.2s</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-info">
              <div className="stat-label">Insights Given</div>
              <div className="stat-value">{Math.floor(messages.length / 2)}</div>
            </div>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Chat Messages */}
            <div className="chat-messages">
              {messages.map(message => (
                <div key={message.id} className={`message ${message.type}`}>
                  <div className="message-avatar">
                    {message.type === 'bot' ? '🤖' : '👤'}
                  </div>
                  <div className="message-content">
                    <div className="message-header">
                      <span className="message-sender">
                        {message.type === 'bot' ? 'AI Assistant' : 'You'}
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
                  <div className="message-avatar">🤖</div>
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
