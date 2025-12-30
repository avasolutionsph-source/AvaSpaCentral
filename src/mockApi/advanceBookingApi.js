// Mock Advance Booking API
// Frontend-only simulation with Dexie (IndexedDB) persistence
// Now uses repositories for event-driven sync

import { AdvanceBookingRepository, ActiveServiceRepository } from '../services/storage/repositories';

const delay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to clone objects
const clone = (obj) => JSON.parse(JSON.stringify(obj));

// Migration helper - migrate from localStorage to repositories
const migrateFromLocalStorage = async () => {
  const STORAGE_KEY = 'advanceBookings';
  const SERVICES_KEY = 'activeServices';

  // Migrate advanceBookings using repository (triggers sync events)
  const storedBookings = localStorage.getItem(STORAGE_KEY);
  if (storedBookings) {
    const bookings = JSON.parse(storedBookings);
    const existing = await AdvanceBookingRepository.getAll();
    if (existing.length === 0 && bookings.length > 0) {
      for (const booking of bookings) {
        await AdvanceBookingRepository.create({ ...booking, _id: booking.id });
      }
      console.log('[AdvanceBookingApi] Migrated advanceBookings using repository');
    }
    localStorage.removeItem(STORAGE_KEY);
  }

  // Migrate activeServices using repository (triggers sync events)
  const storedServices = localStorage.getItem(SERVICES_KEY);
  if (storedServices) {
    const services = JSON.parse(storedServices);
    const existing = await ActiveServiceRepository.getAll();
    if (existing.length === 0 && services.length > 0) {
      for (const service of services) {
        await ActiveServiceRepository.create({ ...service, _id: service.id });
      }
      console.log('[AdvanceBookingApi] Migrated activeServices using repository');
    }
    localStorage.removeItem(SERVICES_KEY);
  }
};

// Initialize advance bookings (no auto-seeding - starts empty)
const initAdvanceBookings = async () => {
  await migrateFromLocalStorage();
  return await AdvanceBookingRepository.getAll();
};

const initActiveServices = async () => {
  await migrateFromLocalStorage();
  return await ActiveServiceRepository.getAll();
};

// Helper to get next booking ID from existing data
const getNextBookingId = async () => {
  const bookings = await AdvanceBookingRepository.getAll();
  if (bookings.length === 0) {
    return 'booking_001';
  }
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

// API Methods - Using repositories for event-driven sync
export const advanceBookingApi = {
  async createAdvanceBooking(bookingInput) {
    await delay(600);
    await initAdvanceBookings();
    const id = await getNextBookingId();

    // Use repository for event-driven sync
    const newBooking = await AdvanceBookingRepository.createBooking({
      _id: id,
      id,
      ...bookingInput
    });

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
    const booking = await AdvanceBookingRepository.getById(id);
    if (!booking) throw new Error('Booking not found');
    return clone(booking);
  },

  async updateAdvanceBooking(id, updates) {
    await delay(500);
    await initAdvanceBookings();
    // Use repository for event-driven sync
    const updatedBooking = await AdvanceBookingRepository.update(id, updates);
    if (!updatedBooking) throw new Error('Booking not found');
    return clone(updatedBooking);
  },

  async listAdvanceBookingsByDate(dateString) {
    await delay(400);
    // Use repository method for date filtering
    const bookings = await AdvanceBookingRepository.getByDate(dateString);
    return clone(bookings);
  },

  async startServiceFromBooking(bookingId) {
    await delay(600);
    await initAdvanceBookings();
    const booking = await AdvanceBookingRepository.getById(bookingId);
    if (!booking) throw new Error('Booking not found');

    // Use repository for event-driven sync
    const updatedBooking = await AdvanceBookingRepository.checkIn(bookingId);

    // Create active service using repository
    const activeService = await ActiveServiceRepository.startFromBooking({
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
      advanceBookingId: booking.id
    });

    return { booking: clone(updatedBooking), activeService: clone(activeService) };
  },

  async completeServiceFromBooking(bookingId, paymentData = {}) {
    await delay(700);
    await initAdvanceBookings();
    const booking = await AdvanceBookingRepository.getById(bookingId);
    if (!booking) throw new Error('Booking not found');

    const now = new Date().toISOString();

    // Use repository for event-driven sync
    const updatedBooking = await AdvanceBookingRepository.complete(bookingId, paymentData);

    // Find and complete active service using repository
    const activeServices = await ActiveServiceRepository.getByBooking(bookingId);
    let completedService = null;
    if (activeServices.length > 0) {
      completedService = await ActiveServiceRepository.completeService(activeServices[0]._id);
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
    // Use repository for event-driven sync
    const updatedBooking = await AdvanceBookingRepository.cancel(bookingId, reason);
    return clone(updatedBooking);
  },

  async getActiveServices() {
    await delay(300);
    const services = await initActiveServices();
    return clone(services);
  },

  async getActiveServicesByRoom(roomId) {
    await delay(300);
    // Use repository method
    const services = await ActiveServiceRepository.getByRoom(roomId);
    return clone(services);
  },

  async getPendingRevenue() {
    await delay(300);
    // Use repository method
    const pending = await AdvanceBookingRepository.getPendingPayment();
    const total = pending.reduce((sum, b) => sum + b.servicePrice, 0);
    return { total, bookings: clone(pending) };
  },

  async getTodaysBookingsCount() {
    await delay(300);
    // Use repository method
    const todayStr = new Date().toISOString().split('T')[0];
    const todayBookings = await AdvanceBookingRepository.getByDate(todayStr);
    const active = todayBookings.filter(b => b.status !== 'cancelled' && b.status !== 'completed');
    return active.length;
  },

  async resetDemoData() {
    await delay(200);
    // Clear using repositories (this won't trigger sync for clear operations)
    const allBookings = await AdvanceBookingRepository.getAll();
    for (const b of allBookings) {
      await AdvanceBookingRepository.delete(b._id);
    }
    const allServices = await ActiveServiceRepository.getAll();
    for (const s of allServices) {
      await ActiveServiceRepository.delete(s._id);
    }
    return { success: true };
  }
};

export default advanceBookingApi;
