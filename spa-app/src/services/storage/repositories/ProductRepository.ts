/**
 * ProductRepository - Products & Services storage
 */
import BaseRepository from '../BaseRepository';
import type { Product } from '../../../types';

class ProductRepository extends BaseRepository<Product> {
  constructor() {
    super('products');
  }

  /**
   * Get all products (type = 'product')
   */
  async getProducts(): Promise<Product[]> {
    return this.find((p) => p.type === 'product' && p.active !== false);
  }

  /**
   * Get all services (type = 'service')
   */
  async getServices(): Promise<Product[]> {
    return this.find((p) => p.type === 'service' && p.active !== false);
  }

  /**
   * Get products by category
   */
  async getByCategory(category: string): Promise<Product[]> {
    return this.findByIndex('category', category);
  }

  /**
   * Get active products/services only
   */
  async getActive(): Promise<Product[]> {
    return this.find((p) => p.active !== false);
  }

  /**
   * Get low stock products
   */
  async getLowStock(): Promise<Product[]> {
    return this.find(
      (p) =>
        p.type === 'product' &&
        p.stock !== undefined &&
        p.lowStockAlert !== undefined &&
        p.stock <= p.lowStockAlert
    );
  }

  /**
   * Update stock level
   */
  async updateStock(
    id: string,
    quantity: number,
    operation: 'set' | 'add' | 'subtract' = 'set'
  ): Promise<Product> {
    const product = await this.getById(id);
    if (!product) throw new Error('Product not found');

    let newStock: number;
    if (operation === 'set') {
      newStock = quantity;
    } else if (operation === 'add') {
      newStock = (product.stock || 0) + quantity;
    } else {
      newStock = Math.max(0, (product.stock || 0) - quantity);
    }

    return this.update(id, { stock: newStock });
  }

  /**
   * Toggle product active status
   */
  async toggleActive(id: string): Promise<Product> {
    const product = await this.getById(id);
    if (!product) throw new Error('Product not found');
    return this.update(id, { active: !product.active });
  }

  /**
   * Search products by name
   */
  async search(query: string): Promise<Product[]> {
    const lowerQuery = query.toLowerCase();
    return this.find(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        Boolean(p.description && p.description.toLowerCase().includes(lowerQuery))
    );
  }
}

export default new ProductRepository();
