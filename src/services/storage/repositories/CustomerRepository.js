/**
 * CustomerRepository - Customer storage
 */
import BaseRepository from '../BaseRepository';

class CustomerRepository extends BaseRepository {
  constructor() {
    super('customers');
  }

  /**
   * Get active customers
   */
  async getActive() {
    return this.find(c => c.status !== 'inactive');
  }

  /**
   * Get customers by tier
   */
  async getByTier(tier) {
    return this.findByIndex('tier', tier);
  }

  /**
   * Search customers
   */
  async search(query) {
    const lowerQuery = query.toLowerCase();
    return this.find(c =>
      c.name.toLowerCase().includes(lowerQuery) ||
      (c.email && c.email.toLowerCase().includes(lowerQuery)) ||
      (c.phone && c.phone.includes(query))
    );
  }

  /**
   * Get customer by phone
   */
  async getByPhone(phone) {
    return this.findOne(c => c.phone === phone);
  }

  /**
   * Get customer by email
   */
  async getByEmail(email) {
    return this.findOne(c => c.email && c.email.toLowerCase() === email.toLowerCase());
  }

  /**
   * Update loyalty points
   */
  async updateLoyaltyPoints(id, points, operation = 'add') {
    const customer = await this.getById(id);
    if (!customer) throw new Error('Customer not found');

    let newPoints;
    if (operation === 'add') {
      newPoints = (customer.loyaltyPoints || 0) + points;
    } else if (operation === 'subtract') {
      newPoints = Math.max(0, (customer.loyaltyPoints || 0) - points);
    } else {
      newPoints = points;
    }

    return this.update(id, { loyaltyPoints: newPoints });
  }

  /**
   * Update total spent and visits
   */
  async recordTransaction(id, amount) {
    const customer = await this.getById(id);
    if (!customer) throw new Error('Customer not found');

    const totalSpent = (customer.totalSpent || 0) + amount;
    const visitCount = (customer.visitCount || 0) + 1;

    // Calculate tier based on total spent
    let tier = 'NEW';
    if (totalSpent >= 50000) tier = 'VIP';
    else if (totalSpent >= 20000) tier = 'REGULAR';

    return this.update(id, {
      totalSpent,
      visitCount,
      tier,
      lastVisit: new Date().toISOString()
    });
  }

  /**
   * Get customers with birthdays in a date range
   */
  async getBirthdaysInRange(startDate, endDate) {
    return this.find(c => {
      if (!c.birthday) return false;
      const bday = new Date(c.birthday);
      const start = new Date(startDate);
      const end = new Date(endDate);
      // Compare month and day only
      const bdayMonthDay = bday.getMonth() * 100 + bday.getDate();
      const startMonthDay = start.getMonth() * 100 + start.getDate();
      const endMonthDay = end.getMonth() * 100 + end.getDate();
      return bdayMonthDay >= startMonthDay && bdayMonthDay <= endMonthDay;
    });
  }
}

export default new CustomerRepository();
