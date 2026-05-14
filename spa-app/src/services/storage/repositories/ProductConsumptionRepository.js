/**
 * ProductConsumptionRepository - Product consumption log storage for AI analysis
 */
import BaseRepository from '../BaseRepository';

class ProductConsumptionRepository extends BaseRepository {
  constructor() {
    super('productConsumption', { trackSync: true });
  }

  /**
   * Get consumption by product
   */
  async getByProduct(productId) {
    return this.findByIndex('productId', productId);
  }

  /**
   * Get consumption by month
   */
  async getByMonth(month) {
    return this.findByIndex('month', month);
  }

  /**
   * Get consumption by date range
   */
  async getByDateRange(startDate, endDate) {
    return this.find(record => {
      const recordDate = new Date(record.date);
      return recordDate >= new Date(startDate) && recordDate <= new Date(endDate);
    });
  }

  /**
   * Log product consumption
   */
  async logConsumption(productId, quantity, type, options = {}) {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return this.create({
      productId,
      quantity,
      type, // 'service', 'sale', 'adjustment', 'waste', 'sample'
      month,
      date: now.toISOString(),
      transactionId: options.transactionId,
      employeeId: options.employeeId,
      customerId: options.customerId,
      notes: options.notes
    });
  }

  /**
   * Log service consumption
   */
  async logServiceConsumption(productId, quantity, options = {}) {
    return this.logConsumption(productId, quantity, 'service', options);
  }

  /**
   * Log sale consumption
   */
  async logSaleConsumption(productId, quantity, options = {}) {
    return this.logConsumption(productId, quantity, 'sale', options);
  }

  /**
   * Log waste/damage
   */
  async logWaste(productId, quantity, reason, options = {}) {
    return this.logConsumption(productId, quantity, 'waste', {
      ...options,
      notes: reason
    });
  }

  /**
   * Get total consumption for a product in date range
   */
  async getTotalConsumption(productId, startDate, endDate) {
    const records = await this.getByProduct(productId);
    return records
      .filter(r => {
        const date = new Date(r.date);
        return date >= new Date(startDate) && date <= new Date(endDate);
      })
      .reduce((sum, r) => sum + (r.quantity || 0), 0);
  }

  /**
   * Get consumption summary by product for a month
   */
  async getMonthlySummary(month) {
    const records = await this.getByMonth(month);
    const summary = {};

    for (const record of records) {
      if (!summary[record.productId]) {
        summary[record.productId] = {
          productId: record.productId,
          total: 0,
          byType: {}
        };
      }
      summary[record.productId].total += record.quantity || 0;

      if (!summary[record.productId].byType[record.type]) {
        summary[record.productId].byType[record.type] = 0;
      }
      summary[record.productId].byType[record.type] += record.quantity || 0;
    }

    return Object.values(summary);
  }

  /**
   * Get top consumed products for a date range
   */
  async getTopConsumed(startDate, endDate, limit = 10) {
    const records = await this.getByDateRange(startDate, endDate);
    const totals = {};

    for (const record of records) {
      if (!totals[record.productId]) {
        totals[record.productId] = 0;
      }
      totals[record.productId] += record.quantity || 0;
    }

    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([productId, total]) => ({ productId, total }));
  }
}

export default new ProductConsumptionRepository();
