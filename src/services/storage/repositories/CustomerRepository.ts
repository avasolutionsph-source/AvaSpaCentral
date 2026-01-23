/**
 * CustomerRepository - Customer storage
 */
import BaseRepository from '../BaseRepository';
import type { Customer } from '../../../types';

class CustomerRepository extends BaseRepository<Customer> {
  constructor() {
    super('customers');
  }

  /**
   * Get active customers
   */
  async getActive(): Promise<Customer[]> {
    return this.find((c) => c.status === 'active');
  }

  /**
   * Get customers by tier
   */
  async getByTier(tier: string): Promise<Customer[]> {
    return this.findByIndex('tier', tier);
  }

  /**
   * Get VIP customers
   */
  async getVIP(): Promise<Customer[]> {
    return this.find((c) => c.tier === 'vip' && c.status === 'active');
  }

  /**
   * Search customers
   */
  async search(query: string): Promise<Customer[]> {
    const lowerQuery = query.toLowerCase();
    return this.find(
      (c) =>
        Boolean(c.name && c.name.toLowerCase().includes(lowerQuery)) ||
        Boolean(c.firstName && c.firstName.toLowerCase().includes(lowerQuery)) ||
        Boolean(c.lastName && c.lastName.toLowerCase().includes(lowerQuery)) ||
        Boolean(c.email && c.email.toLowerCase().includes(lowerQuery)) ||
        Boolean(c.phone && c.phone.includes(query))
    );
  }

  /**
   * Get customer by phone
   */
  async getByPhone(phone: string): Promise<Customer | undefined> {
    return this.findOne((c) => c.phone === phone);
  }

  /**
   * Get customer by email
   */
  async getByEmail(email: string): Promise<Customer | undefined> {
    return this.findOne((c) => c.email?.toLowerCase() === email.toLowerCase());
  }

  /**
   * Update loyalty points
   */
  async updateLoyaltyPoints(
    id: string,
    points: number,
    operation: 'set' | 'add' | 'subtract' = 'add'
  ): Promise<Customer> {
    const customer = await this.getById(id);
    if (!customer) throw new Error('Customer not found');

    let newPoints: number;
    if (operation === 'set') {
      newPoints = points;
    } else if (operation === 'add') {
      newPoints = (customer.loyaltyPoints || 0) + points;
    } else {
      newPoints = Math.max(0, (customer.loyaltyPoints || 0) - points);
    }

    return this.update(id, { loyaltyPoints: newPoints });
  }
}

export default new CustomerRepository();
