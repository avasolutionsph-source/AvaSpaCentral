/**
 * GiftCertificateRepository - Gift Certificate storage
 */
import BaseRepository from '../BaseRepository';

class GiftCertificateRepository extends BaseRepository {
  constructor() {
    super('giftCertificates');
  }

  /**
   * Get by code
   */
  async getByCode(code) {
    return this.findOne(gc => gc.code.toUpperCase() === code.toUpperCase());
  }

  /**
   * Get active certificates (not redeemed, not expired)
   */
  async getActive() {
    const now = new Date();
    return this.find(gc =>
      gc.status !== 'redeemed' &&
      (!gc.expiryDate || new Date(gc.expiryDate) > now)
    );
  }

  /**
   * Get redeemed certificates
   */
  async getRedeemed() {
    return this.find(gc => gc.status === 'redeemed');
  }

  /**
   * Get expired certificates
   */
  async getExpired() {
    const now = new Date();
    return this.find(gc =>
      gc.status !== 'redeemed' &&
      gc.expiryDate &&
      new Date(gc.expiryDate) <= now
    );
  }

  /**
   * Validate a gift certificate code
   */
  async validate(code) {
    const gc = await this.getByCode(code);

    if (!gc) {
      return { valid: false, message: 'Gift certificate not found' };
    }

    if (gc.status === 'redeemed') {
      return { valid: false, message: 'Gift certificate already redeemed', giftCertificate: gc };
    }

    if (gc.expiryDate && new Date(gc.expiryDate) <= new Date()) {
      return { valid: false, message: 'Gift certificate has expired', giftCertificate: gc };
    }

    if (gc.balance <= 0) {
      return { valid: false, message: 'Gift certificate has no remaining balance', giftCertificate: gc };
    }

    return { valid: true, message: 'Gift certificate is valid', giftCertificate: gc };
  }

  /**
   * Redeem a gift certificate
   */
  async redeem(id, amount = null) {
    const gc = await this.getById(id);
    if (!gc) throw new Error('Gift certificate not found');

    const redeemAmount = amount || gc.balance;
    const newBalance = Math.max(0, gc.balance - redeemAmount);
    const status = newBalance === 0 ? 'redeemed' : gc.status;

    return this.update(id, {
      balance: newBalance,
      status,
      redeemedAt: status === 'redeemed' ? new Date().toISOString() : gc.redeemedAt
    });
  }

  /**
   * Generate unique code
   */
  generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'GC-';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Create gift certificate with auto-generated code
   */
  async createWithCode(data) {
    const code = this.generateCode();
    return this.create({
      ...data,
      code,
      balance: data.amount,
      status: 'active'
    });
  }
}

export default new GiftCertificateRepository();
