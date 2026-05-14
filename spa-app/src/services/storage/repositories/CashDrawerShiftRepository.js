/**
 * CashDrawerShiftRepository - per-cashier shifts within a drawer day
 *
 * One drawer-day session can contain multiple shifts (one per cashier turn).
 * A separate table (rather than embedded array) keeps cross-device merges safe:
 * sync uses LWW per row, so two devices appending shifts won't clobber each other.
 */
import BaseRepository from '../BaseRepository';
import { db } from '../../../db';

class CashDrawerShiftRepository extends BaseRepository {
  constructor() {
    super('cashDrawerShifts');
  }

  async getBySession(sessionId) {
    const shifts = await this.find(s => s.sessionId === sessionId);
    return shifts.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  }

  async getActiveBySession(sessionId) {
    return this.findOne(s => s.sessionId === sessionId && s.status === 'active');
  }

  async startShift({ sessionId, branchId, userId, userName, userRole, startCount, notes }) {
    return await db.transaction('rw', [db.cashDrawerShifts, db.syncQueue], async () => {
      const existing = await this.getActiveBySession(sessionId);
      if (existing) {
        throw new Error(`Shift already active for ${existing.userName || existing.userId}. End that shift first.`);
      }
      return this.create({
        sessionId,
        branchId,
        userId,
        userName,
        userRole,
        startTime: new Date().toISOString(),
        startCount: Number(startCount) || 0,
        status: 'active',
        notes: notes || ''
      });
    });
  }

  async endShift(shiftId, { endCount, cashSales, notes }) {
    return await db.transaction('rw', [db.cashDrawerShifts, db.syncQueue], async () => {
      const shift = await this.getById(shiftId);
      if (!shift) throw new Error('Shift not found');
      if (shift.status === 'ended') throw new Error('Shift is already ended');

      const start = Number(shift.startCount) || 0;
      const sales = Number(cashSales) || 0;
      const end = Number(endCount) || 0;
      const variance = end - (start + sales);

      return this.update(shiftId, {
        endTime: new Date().toISOString(),
        endCount: end,
        cashSales: sales,
        variance,
        status: 'ended',
        notes: notes !== undefined ? notes : shift.notes
      });
    });
  }
}

export default new CashDrawerShiftRepository();
