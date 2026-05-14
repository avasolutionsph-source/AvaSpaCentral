/**
 * LoyaltyHistoryRepository - Customer loyalty points history storage
 */
import BaseRepository from '../BaseRepository';

class LoyaltyHistoryRepository extends BaseRepository {
  constructor() {
    super('loyaltyHistory', { trackSync: true });
  }

  /**
   * Get loyalty history by customer
   */
  async getByCustomer(customerId) {
    return this.findByIndex('customerId', customerId);
  }

  /**
   * Get loyalty history by date range
   */
  async getByDateRange(startDate, endDate) {
    return this.find(record => {
      const recordDate = new Date(record.date);
      return recordDate >= new Date(startDate) && recordDate <= new Date(endDate);
    });
  }

  /**
   * Get recent history for a customer
   */
  async getRecentForCustomer(customerId, limit = 10) {
    const history = await this.getByCustomer(customerId);
    return history
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, limit);
  }

  /**
   * Add loyalty points record
   */
  async addPoints(customerId, points, type, description, options = {}) {
    return this.create({
      customerId,
      points,
      type, // 'earned', 'redeemed', 'adjusted', 'expired'
      description,
      transactionId: options.transactionId,
      balanceAfter: options.balanceAfter,
      date: new Date().toISOString()
    });
  }

  /**
   * Add earned points
   */
  async addEarned(customerId, points, description, options = {}) {
    return this.addPoints(customerId, points, 'earned', description, options);
  }

  /**
   * Add redeemed points
   */
  async addRedeemed(customerId, points, description, options = {}) {
    return this.addPoints(customerId, -Math.abs(points), 'redeemed', description, options);
  }

  /**
   * Add adjusted points
   */
  async addAdjusted(customerId, points, description, options = {}) {
    return this.addPoints(customerId, points, 'adjusted', description, options);
  }

  /**
   * Get total points earned by customer
   */
  async getTotalEarned(customerId) {
    const history = await this.getByCustomer(customerId);
    return history
      .filter(r => r.type === 'earned')
      .reduce((sum, r) => sum + (r.points || 0), 0);
  }

  /**
   * Get total points redeemed by customer
   */
  async getTotalRedeemed(customerId) {
    const history = await this.getByCustomer(customerId);
    return history
      .filter(r => r.type === 'redeemed')
      .reduce((sum, r) => sum + Math.abs(r.points || 0), 0);
  }
}

export default new LoyaltyHistoryRepository();
