// src/services/notifications/triggers/posTriggers.js
import dataChangeEmitter from '../../sync/DataChangeEmitter';
import NotificationService from '../NotificationService';
import mockApi from '../../../mockApi';

const seenPaid = new Set();
const seenOnline = new Set();

export function startPosTriggers() {
  return dataChangeEmitter.subscribe(async (change) => {
    // QRPh transaction completion
    if (change.entityType === 'transactions' && change.operation === 'update' && change.entityId) {
      try {
        const t = await mockApi.transactions.getTransaction(change.entityId);
        if (t?.paymentMethod === 'QRPh' && t.status === 'completed' && !seenPaid.has(t._id)) {
          seenPaid.add(t._id);
          if (t.cashierId) {
            await NotificationService.notify({
              type: NotificationService.TYPES.POS_QRPH_PAID,
              targetUserId: t.cashierId,
              title: 'Payment received',
              message: `${t.receiptNumber || 'Transaction'} • ₱${(t.totalAmount || 0).toLocaleString()}`,
              action: '/pos',
              soundClass: 'oneshot',
              payload: { transactionId: t._id },
              branchId: t.branchId,
            });
          }
        }
      } catch (e) { /* swallow */ }
    }

    // Online booking arrived (note: 'onlineBookings' may not be a standard
    // Dexie table; this is a placeholder. If your codebase uses a different
    // entity for online bookings, adapt accordingly. Skip silently when no
    // such entity exists.)
    if (change.entityType === 'onlineBookings' && change.operation === 'create' && change.entityId) {
      if (seenOnline.has(change.entityId)) return;
      seenOnline.add(change.entityId);
      await NotificationService.notify({
        type: NotificationService.TYPES.POS_ONLINE_BOOKING,
        targetRole: ['Receptionist', 'Manager', 'Owner', 'Branch Owner'],
        title: 'New online booking',
        message: 'A new online booking has arrived',
        action: '/appointments',
        soundClass: 'loop',
        payload: { bookingId: change.entityId },
      });
    }
  });
}
