/**
 * ProductRepository - Products & Services storage
 */
import BaseRepository from '../BaseRepository';

class ProductRepository extends BaseRepository {
  constructor() {
    super('products');
  }

  /**
   * Get all products (type = 'product')
   */
  async getProducts() {
    return this.find(p => p.type === 'product' && p.active !== false);
  }

  /**
   * Get all services (type = 'service')
   */
  async getServices() {
    return this.find(p => p.type === 'service' && p.active !== false);
  }

  /**
   * Get products by category
   */
  async getByCategory(category) {
    return this.findByIndex('category', category);
  }

  /**
   * Get active products/services only
   */
  async getActive() {
    return this.find(p => p.active !== false);
  }

  /**
   * Get low stock products
   */
  async getLowStock() {
    return this.find(p =>
      p.type === 'product' &&
      p.stock !== undefined &&
      p.lowStockAlert !== undefined &&
      p.stock <= p.lowStockAlert
    );
  }

  /**
   * Update stock level
   */
  async updateStock(id, quantity, operation = 'set') {
    const product = await this.getById(id);
    if (!product) throw new Error('Product not found');

    let newStock;
    if (operation === 'set') {
      newStock = quantity;
    } else if (operation === 'add') {
      newStock = (product.stock || 0) + quantity;
    } else if (operation === 'subtract') {
      newStock = Math.max(0, (product.stock || 0) - quantity);
    }

    return this.update(id, { stock: newStock });
  }

  /**
   * Toggle product active status
   */
  async toggleActive(id) {
    const product = await this.getById(id);
    if (!product) throw new Error('Product not found');
    return this.update(id, { active: !product.active });
  }

  /**
   * Search products by name
   */
  async search(query) {
    const lowerQuery = query.toLowerCase();
    return this.find(p =>
      p.name.toLowerCase().includes(lowerQuery) ||
      (p.description && p.description.toLowerCase().includes(lowerQuery))
    );
  }
}

export default new ProductRepository();
