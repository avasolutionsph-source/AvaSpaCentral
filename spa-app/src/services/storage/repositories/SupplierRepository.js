/**
 * SupplierRepository - Supplier storage
 */
import BaseRepository from '../BaseRepository';

class SupplierRepository extends BaseRepository {
  constructor() {
    super('suppliers');
  }

  /**
   * Get active suppliers
   */
  async getActive() {
    return this.find(s => s.status === 'active');
  }

  /**
   * Toggle supplier status
   */
  async toggleStatus(id) {
    const supplier = await this.getById(id);
    if (!supplier) throw new Error('Supplier not found');
    const newStatus = supplier.status === 'active' ? 'inactive' : 'active';
    return this.update(id, { status: newStatus });
  }

  /**
   * Search suppliers
   */
  async search(query) {
    const lowerQuery = query.toLowerCase();
    return this.find(s =>
      s.name.toLowerCase().includes(lowerQuery) ||
      (s.contactPerson && s.contactPerson.toLowerCase().includes(lowerQuery)) ||
      (s.email && s.email.toLowerCase().includes(lowerQuery))
    );
  }
}

export default new SupplierRepository();
