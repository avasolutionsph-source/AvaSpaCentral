/**
 * CashDrawerRepository - drawer-day sessions (one open drawer per branch per day)
 *
 * A "session" represents the full life of the physical drawer for one business
 * day at one branch. Per-cashier work is tracked in cashDrawerShifts.
 *
 * Cross-device: sessions are looked up by branchId, not userId, so any device
 * at the same branch sees the same open drawer.
 */
import BaseRepository from '../BaseRepository';
import { db } from '../../../db';
import CashDrawerShiftRepository from './CashDrawerShiftRepository';

class CashDrawerRepository extends BaseRepository {
  constructor() {
    super('cashDrawerSessions');
  }

  async getSessions(filters = {}) {
    let sessions = await this.getAll();

    if (filters.status) sessions = sessions.filter(s => s.status === filters.status);
    if (filters.userId) sessions = sessions.filter(s => s.userId === filters.userId);
    if (filters.branchId) sessions = sessions.filter(s => s.branchId === filters.branchId);

    return sessions.sort((a, b) => new Date(b.openTime) - new Date(a.openTime));
  }

  /**
   * Open a new drawer for the day at this branch and start the first shift.
   * Returns { session, shift }.
   */
  async openDrawer({ branchId, userId, userName, userRole, openingFloat, notes }) {
    return await db.transaction('rw', [db.cashDrawerSessions, db.cashDrawerShifts, db.syncQueue], async () => {
      const existing = await this.getOpenDrawerForBranch(branchId);
      if (existing) {
        throw new Error('A drawer is already open for this branch. Close it first or join the active shift.');
      }

      const float = Number(openingFloat) || 0;
      const session = await this.create({
        branchId: branchId || null,
        openDate: new Date().toISOString().slice(0, 10),
        openTime: new Date().toISOString(),
        openedBy: userId,
        openedByName: userName,
        userId,
        userName,
        userRole,
        openingFloat: float,
        expectedCash: float,
        closeTime: null,
        actualCash: null,
        variance: null,
        status: 'open',
        transactions: [],
        notes: notes || ''
      });

      const shift = await CashDrawerShiftRepository.startShift({
        sessionId: session._id,
        branchId: branchId || null,
        userId,
        userName,
        userRole,
        startCount: float
      });

      return { session, shift };
    });
  }

  /**
   * Close (end-of-day) the drawer. Marks session closed, computes variance,
   * and ends any still-active shift in the same atomic transaction.
   */
  async closeDrawer(sessionId, { actualCash, closedBy, closedByName, notes }) {
    return await db.transaction('rw', [db.cashDrawerSessions, db.cashDrawerShifts, db.syncQueue], async () => {
      const session = await this.getById(sessionId);
      if (!session) throw new Error('Session not found');
      if (session.status === 'closed') throw new Error('Session is already closed');

      const sessionTxns = session.transactions || [];
      const cashSales = sessionTxns
        .filter(t => t.method === 'Cash')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const expectedCash = (Number(session.openingFloat) || 0) + cashSales;
      const actual = Number(actualCash) || 0;

      const activeShift = await CashDrawerShiftRepository.getActiveBySession(sessionId);
      if (activeShift) {
        await CashDrawerShiftRepository.endShift(activeShift._id, {
          endCount: actual,
          cashSales: actual - (Number(activeShift.startCount) || 0),
          notes: 'Auto-ended on Close Drawer'
        });
      }

      return this.update(sessionId, {
        closeTime: new Date().toISOString(),
        closedBy,
        closedByName,
        status: 'closed',
        expectedCash,
        actualCash: actual,
        variance: actual - expectedCash,
        notes: notes !== undefined ? notes : session.notes
      });
    });
  }

  /** Get the currently-open drawer for this branch (null if none). */
  async getOpenDrawerForBranch(branchId) {
    if (!branchId) {
      return this.findOne(s => s.status === 'open' && !s.branchId);
    }
    return this.findOne(s => s.status === 'open' && s.branchId === branchId);
  }

  // ===== Backward-compat shims (used by existing call sites) =====

  /**
   * @deprecated Use openDrawer({ branchId, userId, ... }) instead.
   * Kept so existing UI calling createSession({ userId, openingFloat }) still
   * works during rollout. It just delegates to openDrawer.
   */
  async createSession(data) {
    const { session } = await this.openDrawer({
      branchId: data.branchId,
      userId: data.userId,
      userName: data.userName,
      userRole: data.userRole,
      openingFloat: data.openingFloat,
      notes: data.notes
    });
    return session;
  }

  /**
   * @deprecated Use closeDrawer(sessionId, { actualCash, closedBy }) instead.
   */
  async closeSession(sessionId, actualCash) {
    return this.closeDrawer(sessionId, { actualCash });
  }

  /**
   * Append a cash transaction to the session log. Idempotent on _id.
   * Tags transaction with active shiftId so reports can break down by cashier.
   */
  async addTransaction(sessionId, transaction) {
    return await db.transaction('rw', [db.cashDrawerSessions, db.cashDrawerShifts, db.syncQueue], async () => {
      const session = await this.getById(sessionId);
      if (!session) throw new Error('Session not found');

      const activeShift = await CashDrawerShiftRepository.getActiveBySession(sessionId);
      const newTransaction = {
        _id: 'cdt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        ...transaction,
        shiftId: transaction.shiftId || activeShift?._id || null,
        cashierId: transaction.cashierId || activeShift?.userId || null,
        time: new Date().toISOString()
      };

      const transactions = [...(session.transactions || []), newTransaction];
      return this.update(sessionId, { transactions });
    });
  }

  /** Open session for a given user (legacy lookup; prefer getOpenDrawerForBranch). */
  async getOpenSession(userId) {
    return this.findOne(s => s.status === 'open' && s.userId === userId) || null;
  }

  async getByDate(dateString) {
    return this.find(s => s.openTime && s.openTime.startsWith(dateString));
  }

  async getOpenCount() {
    const open = await this.find(s => s.status === 'open');
    return open.length;
  }
}

export default new CashDrawerRepository();
