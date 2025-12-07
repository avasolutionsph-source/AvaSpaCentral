/**
 * PurchaseOrderRepository - Purchase Order storage
 */
import BaseRepository from '../BaseRepository';

class PurchaseOrderRepository extends BaseRepository {
  constructor() {
    super('purchaseOrders');
  }

  /**
   * Get by supplier
   */
  async getBySupplier(supplierId) {
    return this.findByIndex('supplierId', supplierId);
  }

  /**
   * Get by status
   */
  async getByStatus(status) {
    return this.findByIndex('status', status);
  }

  /**
   * Get pending orders
   */
  async getPending() {
    return this.find(po => po.status === 'pending' || po.status === 'submitted');
  }

  /**
   * Get orders by date range
   */
  async getByDateRange(startDate, endDate) {
    return this.find(po => {
      const orderDate = new Date(po.orderDate);
      return orderDate >= new Date(startDate) && orderDate <= new Date(endDate);
    });
  }

  /**
   * Update status
   */
  async updateStatus(id, status) {
    const updates = { status };
    if (status === 'received') {
      updates.receivedAt = new Date().toISOString();
    }
    return this.update(id, updates);
  }

  /**
   * Generate PO number
   */
  generatePONumber() {
    const year = new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-6);
    return `PO-${year}-${timestamp}`;
  }

  /**
   * Create purchase order with auto-generated number
   */
  async createWithNumber(data) {
    const poNumber = this.generatePONumber();
    return this.create({
      ...data,
      poNumber,
      status: 'draft'
    });
  }

  /**
   * Calculate order total
   */
  calculateTotal(items) {
    return items.reduce((sum, item) => sum + (item.quantity * item.cost), 0);
  }
}

export default new PurchaseOrderRepository();
