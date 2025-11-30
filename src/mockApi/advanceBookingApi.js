// Mock Advance Booking API
// Frontend-only simulation with localStorage persistence

const delay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to clone objects
const clone = (obj) => JSON.parse(JSON.stringify(obj));

// LocalStorage persistence
const STORAGE_KEY = 'advanceBookings';
const SERVICES_KEY = 'activeServices';

const initAdvanceBookings = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return JSON.parse(stored);

  // Initialize with demo data on first load
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);
  nextWeek.setHours(14, 30, 0, 0);

  const initialData = [
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
      clientAddress: '123 Main St, Philippines',
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

  localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
  return initialData;
};

const saveAdvanceBookings = (bookings) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
};

const initActiveServices = () => {
  const stored = localStorage.getItem(SERVICES_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveActiveServices = (services) => {
  localStorage.setItem(SERVICES_KEY, JSON.stringify(services));
};

let bookingIdCounter = 3;

// API Methods
export const advanceBookingApi = {
  async createAdvanceBooking(bookingInput) {
    await delay(600);
    const bookings = initAdvanceBookings();
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

    bookings.push(newBooking);
    saveAdvanceBookings(bookings);
    return clone(newBooking);
  },

  async listAdvanceBookings() {
    await delay(400);
    return clone(initAdvanceBookings());
  },

  async getAdvanceBooking(id) {
    await delay(300);
    const bookings = initAdvanceBookings();
    const booking = bookings.find(b => b.id === id);
    if (!booking) throw new Error('Booking not found');
    return clone(booking);
  },

  async updateAdvanceBooking(id, updates) {
    await delay(500);
    const bookings = initAdvanceBookings();
    const index = bookings.findIndex(b => b.id === id);
    if (index === -1) throw new Error('Booking not found');

    bookings[index] = {
      ...bookings[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    saveAdvanceBookings(bookings);
    return clone(bookings[index]);
  },

  async listAdvanceBookingsByDate(dateString) {
    await delay(400);
    const bookings = initAdvanceBookings();
    const targetDate = new Date(dateString);
    const filtered = bookings.filter(booking => {
      const bookingDate = new Date(booking.bookingDateTime);
      return (
        bookingDate.getFullYear() === targetDate.getFullYear() &&
        bookingDate.getMonth() === targetDate.getMonth() &&
        bookingDate.getDate() === targetDate.getDate()
      );
    });
    return clone(filtered);
  },

  async startServiceFromBooking(bookingId) {
    await delay(600);
    const bookings = initAdvanceBookings();
    const bookingIndex = bookings.findIndex(b => b.id === bookingId);
    if (bookingIndex === -1) throw new Error('Booking not found');

    const booking = bookings[bookingIndex];
    bookings[bookingIndex] = {
      ...booking,
      status: 'in-progress',
      actualStartTime: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    saveAdvanceBookings(bookings);

    const activeServices = initActiveServices();
    const activeService = {
      id: `service_${Date.now()}`,
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
    saveActiveServices(activeServices);

    return { booking: clone(bookings[bookingIndex]), activeService: clone(activeService) };
  },

  async completeServiceFromBooking(bookingId, paymentData = {}) {
    await delay(700);
    const bookings = initAdvanceBookings();
    const bookingIndex = bookings.findIndex(b => b.id === bookingId);
    if (bookingIndex === -1) throw new Error('Booking not found');

    const booking = bookings[bookingIndex];
    const now = new Date().toISOString();
    bookings[bookingIndex] = {
      ...booking,
      status: 'completed',
      actualEndTime: now,
      paymentStatus: 'paid',
      ...paymentData,
      updatedAt: now
    };
    saveAdvanceBookings(bookings);

    const activeServices = initActiveServices();
    const serviceIndex = activeServices.findIndex(s => s.advanceBookingId === bookingId);
    let activeService = null;
    if (serviceIndex !== -1) {
      activeService = { ...activeServices[serviceIndex], status: 'completed' };
      activeServices.splice(serviceIndex, 1);
      saveActiveServices(activeServices);
    }

    const transaction = {
      id: booking.transactionId,
      date: now,
      bookingDateTime: booking.bookingDateTime,
      total: booking.servicePrice,
      items: [{ name: booking.serviceName, price: booking.servicePrice, quantity: 1, employeeId: booking.employeeId, employeeName: booking.employeeName }],
      customer: { name: booking.clientName, phone: booking.clientPhone },
      paymentMethod: paymentData.paymentMethod || booking.paymentMethod,
      paymentStatus: 'completed',
      paymentTiming: booking.paymentTiming,
      isAdvanceBooking: true,
      advanceBookingId: booking.id
    };

    return { booking: clone(bookings[bookingIndex]), transaction: clone(transaction), activeService: activeService ? clone(activeService) : null };
  },

  async cancelAdvanceBooking(bookingId, reason = '') {
    await delay(500);
    const bookings = initAdvanceBookings();
    const index = bookings.findIndex(b => b.id === bookingId);
    if (index === -1) throw new Error('Booking not found');

    bookings[index] = {
      ...bookings[index],
      status: 'cancelled',
      specialRequests: bookings[index].specialRequests
        ? `${bookings[index].specialRequests}\nCancellation reason: ${reason}`
        : `Cancellation reason: ${reason}`,
      updatedAt: new Date().toISOString()
    };
    saveAdvanceBookings(bookings);
    return clone(bookings[index]);
  },

  async getActiveServices() {
    await delay(300);
    return clone(initActiveServices());
  },

  async getActiveServicesByRoom(roomId) {
    await delay(300);
    const services = initActiveServices();
    return clone(services.filter(s => s.roomId === roomId));
  },

  async getPendingRevenue() {
    await delay(300);
    const bookings = initAdvanceBookings();
    const pending = bookings.filter(
      b => b.paymentTiming === 'pay-after' && b.paymentStatus === 'pending' && b.status !== 'cancelled'
    );
    const total = pending.reduce((sum, b) => sum + b.servicePrice, 0);
    return { total, bookings: clone(pending) };
  },

  async getTodaysBookingsCount() {
    await delay(300);
    const bookings = initAdvanceBookings();
    const today = new Date();
    const todayBookings = bookings.filter(booking => {
      if (booking.status === 'cancelled' || booking.status === 'completed') return false;
      const bookingDate = new Date(booking.bookingDateTime);
      return (
        bookingDate.getFullYear() === today.getFullYear() &&
        bookingDate.getMonth() === today.getMonth() &&
        bookingDate.getDate() === today.getDate()
      );
    });
    return todayBookings.length;
  },

  async resetDemoData() {
    await delay(200);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SERVICES_KEY);
    initAdvanceBookings();
    return { success: true };
  }
};

export default advanceBookingApi;
