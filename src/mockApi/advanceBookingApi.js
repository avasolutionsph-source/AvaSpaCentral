// Mock Advance Booking API
// Frontend-only simulation with Dexie (IndexedDB) persistence

import { db } from '../db';

const delay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to clone objects
const clone = (obj) => JSON.parse(JSON.stringify(obj));

// Migration helper - migrate from localStorage to Dexie
const migrateFromLocalStorage = async () => {
  const STORAGE_KEY = 'advanceBookings';
  const SERVICES_KEY = 'activeServices';

  // Migrate advanceBookings
  const storedBookings = localStorage.getItem(STORAGE_KEY);
  if (storedBookings) {
    const bookings = JSON.parse(storedBookings);
    const existingCount = await db.advanceBookings.count();
    if (existingCount === 0 && bookings.length > 0) {
      // Add _id field for Dexie compatibility
      const migrationData = bookings.map(b => ({ ...b, _id: b.id }));
      await db.advanceBookings.bulkPut(migrationData);
      console.log('[AdvanceBookingApi] Migrated advanceBookings from localStorage to Dexie');
    }
    localStorage.removeItem(STORAGE_KEY);
  }

  // Migrate activeServices
  const storedServices = localStorage.getItem(SERVICES_KEY);
  if (storedServices) {
    const services = JSON.parse(storedServices);
    const existingCount = await db.activeServices.count();
    if (existingCount === 0 && services.length > 0) {
      const migrationData = services.map(s => ({ ...s, _id: s.id }));
      await db.activeServices.bulkPut(migrationData);
      console.log('[AdvanceBookingApi] Migrated activeServices from localStorage to Dexie');
    }
    localStorage.removeItem(SERVICES_KEY);
  }
};

// Initialize with demo data if empty
const initAdvanceBookings = async () => {
  // First check for migration
  await migrateFromLocalStorage();

  const bookings = await db.advanceBookings.toArray();
  if (bookings.length > 0) return bookings;

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
      _id: 'booking_001',
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
      _id: 'booking_002',
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

  await db.advanceBookings.bulkPut(initialData);
  return initialData;
};

const initActiveServices = async () => {
  await migrateFromLocalStorage();
  return await db.activeServices.toArray();
};

// Helper to get next booking ID from existing data
const getNextBookingId = async () => {
  const bookings = await db.advanceBookings.toArray();
  if (bookings.length === 0) {
    return 'booking_001';
  }
  // Find the highest numeric ID
  let maxNum = 0;
  for (const booking of bookings) {
    const match = booking._id?.match(/booking_(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return `booking_${String(maxNum + 1).padStart(3, '0')}`;
};

// API Methods
export const advanceBookingApi = {
  async createAdvanceBooking(bookingInput) {
    await delay(600);
    await initAdvanceBookings(); // Ensure initialized
    const id = await getNextBookingId();
    const now = new Date().toISOString();

    const newBooking = {
      _id: id,
      id,
      ...bookingInput,
      status: bookingInput.status || 'scheduled',
      actualStartTime: null,
      actualEndTime: null,
      createdAt: now,
      updatedAt: now
    };

    await db.advanceBookings.put(newBooking);
    return clone(newBooking);
  },

  async listAdvanceBookings() {
    await delay(400);
    const bookings = await initAdvanceBookings();
    return clone(bookings);
  },

  async getAdvanceBooking(id) {
    await delay(300);
    await initAdvanceBookings();
    const booking = await db.advanceBookings.get(id);
    if (!booking) throw new Error('Booking not found');
    return clone(booking);
  },

  async updateAdvanceBooking(id, updates) {
    await delay(500);
    await initAdvanceBookings();
    const booking = await db.advanceBookings.get(id);
    if (!booking) throw new Error('Booking not found');

    const updatedBooking = {
      ...booking,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await db.advanceBookings.put(updatedBooking);
    return clone(updatedBooking);
  },

  async listAdvanceBookingsByDate(dateString) {
    await delay(400);
    const bookings = await initAdvanceBookings();
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
    await initAdvanceBookings();
    const booking = await db.advanceBookings.get(bookingId);
    if (!booking) throw new Error('Booking not found');

    const updatedBooking = {
      ...booking,
      status: 'in-progress',
      actualStartTime: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await db.advanceBookings.put(updatedBooking);

    const serviceId = `service_${Date.now()}`;
    const activeService = {
      _id: serviceId,
      id: serviceId,
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
    await db.activeServices.put(activeService);

    return { booking: clone(updatedBooking), activeService: clone(activeService) };
  },

  async completeServiceFromBooking(bookingId, paymentData = {}) {
    await delay(700);
    await initAdvanceBookings();
    const booking = await db.advanceBookings.get(bookingId);
    if (!booking) throw new Error('Booking not found');

    const now = new Date().toISOString();
    const updatedBooking = {
      ...booking,
      status: 'completed',
      actualEndTime: now,
      paymentStatus: 'paid',
      ...paymentData,
      updatedAt: now
    };
    await db.advanceBookings.put(updatedBooking);

    // Find and remove active service
    const activeServices = await db.activeServices.toArray();
    const activeService = activeServices.find(s => s.advanceBookingId === bookingId);
    let completedService = null;
    if (activeService) {
      completedService = { ...activeService, status: 'completed' };
      await db.activeServices.delete(activeService._id);
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

    return { booking: clone(updatedBooking), transaction: clone(transaction), activeService: completedService ? clone(completedService) : null };
  },

  async cancelAdvanceBooking(bookingId, reason = '') {
    await delay(500);
    await initAdvanceBookings();
    const booking = await db.advanceBookings.get(bookingId);
    if (!booking) throw new Error('Booking not found');

    const updatedBooking = {
      ...booking,
      status: 'cancelled',
      specialRequests: booking.specialRequests
        ? `${booking.specialRequests}\nCancellation reason: ${reason}`
        : `Cancellation reason: ${reason}`,
      updatedAt: new Date().toISOString()
    };
    await db.advanceBookings.put(updatedBooking);
    return clone(updatedBooking);
  },

  async getActiveServices() {
    await delay(300);
    const services = await initActiveServices();
    return clone(services);
  },

  async getActiveServicesByRoom(roomId) {
    await delay(300);
    const services = await db.activeServices.where('roomId').equals(roomId).toArray();
    return clone(services);
  },

  async getPendingRevenue() {
    await delay(300);
    const bookings = await initAdvanceBookings();
    const pending = bookings.filter(
      b => b.paymentTiming === 'pay-after' && b.paymentStatus === 'pending' && b.status !== 'cancelled'
    );
    const total = pending.reduce((sum, b) => sum + b.servicePrice, 0);
    return { total, bookings: clone(pending) };
  },

  async getTodaysBookingsCount() {
    await delay(300);
    const bookings = await initAdvanceBookings();
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
    await db.advanceBookings.clear();
    await db.activeServices.clear();
    await initAdvanceBookings();
    return { success: true };
  }
};

export default advanceBookingApi;
