// Advance Booking Type Definitions
// Frontend-only demo types for the SPA ERP advance booking feature

/**
 * @typedef {'pay-now' | 'pay-after'} PaymentTiming
 */

/**
 * @typedef {'paid' | 'pending' | 'unpaid' | 'deposit_paid' | 'fully_paid'} PaymentStatus
 * Note: QRPh full-prepay flow uses 'fully_paid' on webhook success.
 */

/**
 * @typedef {'scheduled' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled'} BookingStatus
 */

/**
 * @typedef {Object} AdvanceBooking
 * @property {string} id - Unique booking identifier
 * @property {string} bookingDateTime - ISO datetime string
 * @property {string} employeeId - Assigned therapist ID
 * @property {string} employeeName - Assigned therapist name
 * @property {string} serviceName - Service name
 * @property {number} estimatedDuration - Duration in minutes
 * @property {number} servicePrice - Service price
 * @property {string|null} [roomId] - Assigned room ID (if not home service)
 * @property {string|null} [roomName] - Assigned room name
 * @property {boolean} isHomeService - Whether this is a home service
 * @property {string} clientName - Client full name
 * @property {string|null} [clientPhone] - Client phone number
 * @property {string|null} [clientEmail] - Client email
 * @property {string|null} [clientAddress] - Client address (required for home service)
 * @property {string} paymentMethod - cash | card | gcash | other
 * @property {PaymentTiming} paymentTiming - When payment is collected
 * @property {PaymentStatus} paymentStatus - Payment status
 * @property {string} transactionId - Related transaction ID
 * @property {string} [paymentIntentId] - Linked NextPay payment intent ID (QRPh prepay)
 * @property {BookingStatus} status - Current booking status
 * @property {string|null} [specialRequests] - Special requests or notes
 * @property {string|null} [actualStartTime] - ISO datetime when service actually started
 * @property {string|null} [actualEndTime] - ISO datetime when service actually ended
 * @property {string} createdAt - ISO datetime when booking was created
 * @property {string} updatedAt - ISO datetime when booking was last updated
 * @property {number} [paxCount] - Number of guests (default 1)
 * @property {Array<{guestNumber:number, serviceName:string, employeeId?:string, employeeName?:string, price:number}>} [guestSummary] - Per-guest denorm summary
 */

/**
 * @typedef {Object} ActiveService
 * @property {string} id - Unique active service identifier
 * @property {string|null} [roomId] - Room ID (if not home service)
 * @property {string|null} [roomName] - Room name
 * @property {boolean} isHomeService - Whether this is a home service
 * @property {string} serviceName - Service name
 * @property {string} clientName - Client name
 * @property {string|null} [clientAddress] - Client address
 * @property {string|null} [clientPhone] - Client phone
 * @property {string} employeeId - Therapist ID
 * @property {string} employeeName - Therapist name
 * @property {string} transactionId - Related transaction ID
 * @property {number} estimatedDuration - Duration in minutes
 * @property {string} startTime - ISO datetime when service started
 * @property {'in-progress' | 'completed'} status - Service status
 * @property {string} advanceBookingId - Related advance booking ID
 */

export {};
