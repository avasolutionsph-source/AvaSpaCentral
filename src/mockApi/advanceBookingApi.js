// Mock Advance Booking API
// Frontend-only simulation with in-memory storage

const delay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

// In-memory storage
let advanceBookings = [];
let activeServices = [];
let bookingIdCounter = 1;
let serviceIdCounter = 1;

// Initialize with some demo data
const initializeDemoData = () => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);
  nextWeek.setHours(14, 30, 0, 0);

  advanceBookings = [
    {
      id: 'booking_001',
      bookingDateTime: tomorrow.toISOString(),
      employeeId: 'emp_003',
      employeeName: 'Sarah Lee',
      serviceName: 'Swedish Massage (90 min)',
      estimatedDuration: 90,
      servicePrice: 1200,
      roomId: 'room_001',
      roomName: 'Room 1',
      isHomeService: false,
      clientName: 'Maria Santos',
      clientPhone: '+63 912 345 6789',
      clientEmail: 'maria.santos@example.com',
      clientAddress: null,
      paymentMethod: 'gcash',
      paymentTiming: 'pay-now',
      paymentStatus: 'paid',
      transactionId: 'txn_adv_001',
      status: 'scheduled',
      specialRequests: 'Please use lavender oil',
      actualStartTime: null,
      actualEndTime: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: 'booking_002',
      bookingDateTime: nextWeek.toISOString(),
      employeeId: 'emp_002',
      employeeName: 'Juan Dela Cruz',
      serviceName: 'Deep Tissue Massage + Hot Stone',
      estimatedDuration: 120,
      servicePrice: 1800,
      roomId: null,
      roomName: null,
      isHomeService: true,
      clientName: 'John Smith',
      clientPhone: '+63 923 456 7890',
      clientEmail: null,
      clientAddress: '123 Main St, Daet, Camarines Norte',
      paymentMethod: 'cash',
      paymentTiming: 'pay-after',
      paymentStatus: 'pending',
      transactionId: 'txn_adv_002',
      status: 'confirmed',
      specialRequests: null,
      actualStartTime: null,
      actualEndTime: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    }
  ];

  bookingIdCounter = 3;
  activeServices = [];
  serviceIdCounter = 1;
};

// Initialize on load
initializeDemoData();

// Helper to clone objects
const clone = (obj) => JSON.parse(JSON.stringify(obj));

// API Methods
export const advanceBookingApi = {
  /**
   * Create a new advance booking
   */
  async createAdvanceBooking(bookingInput) {
    await delay(600);

    const id = `booking_${String(bookingIdCounter++).padStart(3, '0')}`;
    const now = new Date().toISOString();

    const newBooking = {
      id,
      ...bookingInput,
      status: bookingInput.status || 'scheduled',
      actualStartTime: null,
      actualEndTime: null,
      createdAt: now,
      updatedAt: now
    };

    advanceBookings.push(newBooking);
    return clone(newBooking);
  },

  /**
   * List all advance bookings
   */
  async listAdvanceBookings() {
    await delay(400);
    return clone(advanceBookings);
  },

  /**
   * Get a single advance booking by ID
   */
  async getAdvanceBooking(id) {
    await delay(300);
    const booking = advanceBookings.find(b => b.id === id);
    if (!booking) {
      throw new Error('Booking not found');
    }
    return clone(booking);
  },

  /**
   * Update an advance booking
   */
  async updateAdvanceBooking(id, updates) {
    await delay(500);

    const index = advanceBookings.findIndex(b => b.id === id);
    if (index === -1) {
      throw new Error('Booking not found');
    }

    advanceBookings[index] = {
      ...advanceBookings[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    return clone(advanceBookings[index]);
  },

  /**
   * List advance bookings by date
   */
  async listAdvanceBookingsByDate(dateString) {
    await delay(400);

    const targetDate = new Date(dateString);
    const filtered = advanceBookings.filter(booking => {
      const bookingDate = new Date(booking.bookingDateTime);
      return (
        bookingDate.getFullYear() === targetDate.getFullYear() &&
        bookingDate.getMonth() === targetDate.getMonth() &&
        bookingDate.getDate() === targetDate.getDate()
      );
    });

    return clone(filtered);
  },

  /**
   * Start a service from a booking
   */
  async startServiceFromBooking(bookingId) {
    await delay(600);

    const bookingIndex = advanceBookings.findIndex(b => b.id === bookingId);
    if (bookingIndex === -1) {
      throw new Error('Booking not found');
    }

    const booking = advanceBookings[bookingIndex];

    // Update booking status
    advanceBookings[bookingIndex] = {
      ...booking,
      status: 'in-progress',
      actualStartTime: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Create active service
    const activeService = {
      id: `service_${String(serviceIdCounter++).padStart(3, '0')}`,
      roomId: booking.roomId,
      roomName: booking.roomName,
      isHomeService: booking.isHomeService,
      serviceName: booking.serviceName,
      clientName: booking.clientName,
      clientAddress: booking.clientAddress,
      clientPhone: booking.clientPhone,
      employeeId: booking.employeeId,
      employeeName: booking.employeeName,
      transactionId: booking.transactionId,
      estimatedDuration: booking.estimatedDuration,
      startTime: new Date().toISOString(),
      status: 'in-progress',
      advanceBookingId: booking.id
    };

    activeServices.push(activeService);

    return {
      booking: clone(advanceBookings[bookingIndex]),
      activeService: clone(activeService)
    };
  },

  /**
   * Complete a service from a booking
   */
  async completeServiceFromBooking(bookingId, paymentData = {}) {
    await delay(700);

    const bookingIndex = advanceBookings.findIndex(b => b.id === bookingId);
    if (bookingIndex === -1) {
      throw new Error('Booking not found');
    }

    const booking = advanceBookings[bookingIndex];

    // Update booking status
    const now = new Date().toISOString();
    advanceBookings[bookingIndex] = {
      ...booking,
      status: 'completed',
      actualEndTime: now,
      paymentStatus: 'paid',
      ...paymentData,
      updatedAt: now
    };

    // Remove active service
    const serviceIndex = activeServices.findIndex(s => s.advanceBookingId === bookingId);
    let activeService = null;
    if (serviceIndex !== -1) {
      activeService = { ...activeServices[serviceIndex], status: 'completed' };
      activeServices.splice(serviceIndex, 1);
    }

    // Create a mock completed transaction
    const transaction = {
      id: booking.transactionId,
      date: now,
      bookingDateTime: booking.bookingDateTime,
      total: booking.servicePrice,
      items: [
        {
          name: booking.serviceName,
          price: booking.servicePrice,
          quantity: 1,
          employeeId: booking.employeeId,
          employeeName: booking.employeeName
        }
      ],
      customer: {
        name: booking.clientName,
        phone: booking.clientPhone
      },
      paymentMethod: paymentData.paymentMethod || booking.paymentMethod,
      paymentStatus: 'completed',
      paymentTiming: booking.paymentTiming,
      isAdvanceBooking: true,
      advanceBookingId: booking.id
    };

    return {
      booking: clone(advanceBookings[bookingIndex]),
      transaction: clone(transaction),
      activeService: activeService ? clone(activeService) : null
    };
  },

  /**
   * Cancel a booking
   */
  async cancelAdvanceBooking(bookingId, reason = '') {
    await delay(500);

    const index = advanceBookings.findIndex(b => b.id === bookingId);
    if (index === -1) {
      throw new Error('Booking not found');
    }

    advanceBookings[index] = {
      ...advanceBookings[index],
      status: 'cancelled',
      specialRequests: advanceBookings[index].specialRequests
        ? `${advanceBookings[index].specialRequests}\nCancellation reason: ${reason}`
        : `Cancellation reason: ${reason}`,
      updatedAt: new Date().toISOString()
    };

    return clone(advanceBookings[index]);
  },

  /**
   * Get active services
   */
  async getActiveServices() {
    await delay(300);
    return clone(activeServices);
  },

  /**
   * Get active services by room
   */
  async getActiveServicesByRoom(roomId) {
    await delay(300);
    const filtered = activeServices.filter(s => s.roomId === roomId);
    return clone(filtered);
  },

  /**
   * Get pending revenue (pay-after bookings not yet completed)
   */
  async getPendingRevenue() {
    await delay(300);
    const pending = advanceBookings.filter(
      b => b.paymentTiming === 'pay-after' &&
           b.paymentStatus === 'pending' &&
           b.status !== 'cancelled'
    );
    const total = pending.reduce((sum, b) => sum + b.servicePrice, 0);
    return { total, bookings: clone(pending) };
  },

  /**
   * Get today's bookings count
   */
  async getTodaysBookingsCount() {
    await delay(300);
    const today = new Date();
    const todayBookings = advanceBookings.filter(booking => {
      if (booking.status === 'cancelled' || booking.status === 'completed') {
        return false;
      }
      const bookingDate = new Date(booking.bookingDateTime);
      return (
        bookingDate.getFullYear() === today.getFullYear() &&
        bookingDate.getMonth() === today.getMonth() &&
        bookingDate.getDate() === today.getDate()
      );
    });
    return todayBookings.length;
  },

  /**
   * Reset demo data (for testing)
   */
  async resetDemoData() {
    await delay(200);
    initializeDemoData();
    return { success: true };
  }
};

export default advanceBookingApi;
