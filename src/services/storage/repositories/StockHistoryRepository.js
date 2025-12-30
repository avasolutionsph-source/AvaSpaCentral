/**
 * StockHistoryRepository - Inventory stock history storage
 */
import BaseRepository from '../BaseRepository';

class StockHistoryRepository extends BaseRepository {
  constructor() {
    super('stockHistory', { trackSync: true });
  }

  /**
   * Get stock history by product
   */
  async getByProduct(productId) {
    return this.findByIndex('productId', productId);
  }

  /**
   * Get stock history by date range
   */
  async getByDateRange(startDate, endDate) {
    return this.find(record => {
      const recordDate = new Date(record.date);
      return recordDate >= new Date(startDate) && recordDate <= new Date(endDate);
    });
  }

  /**
   * Get recent history for a product
   */
  async getRecentForProduct(productId, limit = 10) {
    const history = await this.getByProduct(productId);
    return history
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, limit);
  }

  /**
   * Get history by type
   */
  async getByType(type) {
    return this.findByIndex('type', type);
  }

  /**
   * Add stock adjustment record
   */
  async addAdjustment(productId, quantityBefore, quantityAfter, type, reason, options = {}) {
    return this.create({
      productId,
      quantityBefore,
      quantityAfter,
      quantityChange: quantityAfter - quantityBefore,
      type, // 'adjustment', 'sale', 'purchase', 'return', 'damage', 'transfer'
      reason,
      userId: options.userId,
      userName: options.userName,
      transactionId: options.transactionId,
      purchaseOrderId: options.purchaseOrderId,
      date: new Date().toISOString()
    });
  }

  /**
   * Add sale stock record
   */
  async addSale(productId, quantityBefore, quantitySold, options = {}) {
    return this.addAdjustment(
      productId,
      quantityBefore,
      quantityBefore - quantitySold,
      'sale',
      options.reason || 'Sale transaction',
      options
    );
  }

  /**
   * Add purchase stock record
   */
  async addPurchase(productId, quantityBefore, quantityAdded, options = {}) {
    return this.addAdjustment(
      productId,
      quantityBefore,
      quantityBefore + quantityAdded,
      'purchase',
      options.reason || 'Purchase order received',
      options
    );
  }

  /**
   * Add manual adjustment record
   */
  async addManualAdjustment(productId, quantityBefore, quantityAfter, reason, options = {}) {
    return this.addAdjustment(
      productId,
      quantityBefore,
      quantityAfter,
      'adjustment',
      reason,
      options
    );
  }

  /**
   * Get total quantity change for a product in date range
   */
  async getTotalChange(productId, startDate, endDate) {
    const history = await this.getByProduct(productId);
    return history
      .filter(r => {
        const date = new Date(r.date);
        return date >= new Date(startDate) && date <= new Date(endDate);
      })
      .reduce((sum, r) => sum + (r.quantityChange || 0), 0);
  }
}

export default new StockHistoryRepository();
