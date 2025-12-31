/**
 * CashDrawerRepository - Cash drawer sessions storage
 */
import BaseRepository from '../BaseRepository';
import { db } from '../../../db';

class CashDrawerRepository extends BaseRepository {
  constructor() {
    super('cashDrawerSessions');
  }

  /**
   * Get sessions with filters
   */
  async getSessions(filters = {}) {
    let sessions = await this.getAll();

    if (filters.status) {
      sessions = sessions.filter(s => s.status === filters.status);
    }
    if (filters.userId) {
      sessions = sessions.filter(s => s.userId === filters.userId);
    }

    // Sort by openTime descending
    return sessions.sort((a, b) => new Date(b.openTime) - new Date(a.openTime));
  }

  /**
   * Create a new session
   */
  async createSession(data) {
    const session = {
      ...data,
      openTime: new Date().toISOString(),
      closeTime: null,
      status: 'open',
      transactions: [],
      variance: null
    };

    return this.create(session);
  }

  /**
   * Close a session
   * Uses Dexie transaction for atomicity to prevent race conditions
   */
  async closeSession(sessionId, actualCash) {
    return await db.transaction('rw', db.cashDrawerSessions, async () => {
      const session = await this.getById(sessionId);
      if (!session) throw new Error('Session not found');

      // Check if already closed to prevent double-close
      if (session.status === 'closed') {
        throw new Error('Session is already closed');
      }

      const cashTransactions = (session.transactions || []).filter(t => t.method === 'Cash');
      const expectedCash = (session.openingFloat || 0) + cashTransactions.reduce((sum, t) => sum + t.amount, 0);

      return this.update(sessionId, {
        closeTime: new Date().toISOString(),
        status: 'closed',
        expectedCash,
        actualCash,
        variance: actualCash - expectedCash
      });
    });
  }

  /**
   * Add transaction to session
   * Uses Dexie transaction for atomicity to prevent race conditions
   */
  async addTransaction(sessionId, transaction) {
    return await db.transaction('rw', db.cashDrawerSessions, async () => {
      const session = await this.getById(sessionId);
      if (!session) throw new Error('Session not found');

      const newTransaction = {
        _id: 'cdt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        ...transaction,
        time: new Date().toISOString()
      };

      const transactions = [...(session.transactions || []), newTransaction];

      return this.update(sessionId, { transactions });
    });
  }

  /**
   * Get open session for user
   */
  async getOpenSession(userId) {
    const session = await this.findOne(s => s.status === 'open' && s.userId === userId);
    return session || null;
  }

  /**
   * Get sessions by date
   */
  async getByDate(dateString) {
    return this.find(s => s.openTime && s.openTime.startsWith(dateString));
  }

  /**
   * Get open sessions count
   */
  async getOpenCount() {
    const open = await this.find(s => s.status === 'open');
    return open.length;
  }
}

export default new CashDrawerRepository();
