// src/services/notifications/triggers/inventoryTriggers.js
import dataChangeEmitter from '../../sync/DataChangeEmitter';
import NotificationService from '../NotificationService';
import mockApi from '../../../mockApi';

const seenOOS = new Set();
const seenLow = new Set();

export function startInventoryTriggers() {
  return dataChangeEmitter.subscribe(async (change) => {
    if (change.entityType !== 'products' || !change.entityId) return;
    if (change.operation === 'delete') return;

    let p;
    try {
      p = await mockApi.products.getProduct(change.entityId);
    } catch { return; }
    if (!p || p.type !== 'product') return;

    const threshold = p.lowStockAlert || 5;
    if (p.stock === 0 && !seenOOS.has(p._id)) {
      seenOOS.add(p._id); seenLow.delete(p._id);
      await NotificationService.notify({
        type: NotificationService.TYPES.INVENTORY_OUT_OF_STOCK,
        targetRole: ['Manager', 'Owner', 'Branch Owner'],
        title: 'Out of stock',
        message: `${p.name} is out of stock`,
        action: '/inventory',
        soundClass: 'oneshot',
        payload: { productId: p._id },
        branchId: p.branchId,
      });
    } else if (p.stock > 0 && p.stock <= threshold && !seenLow.has(p._id)) {
      seenLow.add(p._id);
      await NotificationService.notify({
        type: NotificationService.TYPES.INVENTORY_LOW_STOCK,
        targetRole: ['Manager', 'Owner', 'Branch Owner'],
        title: 'Low stock',
        message: `${p.name} • ${p.stock} left`,
        action: '/inventory',
        soundClass: 'oneshot',
        payload: { productId: p._id },
        branchId: p.branchId,
      });
    } else if (p.stock > threshold) {
      seenLow.delete(p._id); seenOOS.delete(p._id);
    }
  });
}
