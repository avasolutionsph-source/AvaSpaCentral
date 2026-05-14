/**
 * ServiceRotationRepository - Daily service rotation storage
 */
import BaseRepository from '../BaseRepository';

class ServiceRotationRepository extends BaseRepository {
  constructor() {
    super('serviceRotation', { trackSync: true });
  }

  /**
   * Get rotation by date
   * Note: date is the primary key for serviceRotation table
   */
  async getByDate(date) {
    // Normalize date to YYYY-MM-DD format
    const dateStr = typeof date === 'string' ? date.split('T')[0] : new Date(date).toISOString().split('T')[0];
    return this.table.get(dateStr);
  }

  /**
   * Get today's rotation
   */
  async getToday() {
    const today = new Date().toISOString().split('T')[0];
    return this.getByDate(today);
  }

  /**
   * Set rotation for a date
   * Note: Uses date as primary key
   */
  async setRotation(date, rotationData) {
    const dateStr = typeof date === 'string' ? date.split('T')[0] : new Date(date).toISOString().split('T')[0];
    const existing = await this.getByDate(dateStr);

    if (existing) {
      return this.update(dateStr, {
        ...rotationData,
        date: dateStr
      });
    } else {
      return this.create({
        _id: dateStr,
        date: dateStr,
        ...rotationData
      });
    }
  }

  /**
   * Set today's rotation
   */
  async setToday(rotationData) {
    const today = new Date().toISOString().split('T')[0];
    return this.setRotation(today, rotationData);
  }

  /**
   * Get rotations for date range
   */
  async getByDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    return this.find(rotation => {
      const rotationDate = new Date(rotation.date);
      return rotationDate >= start && rotationDate <= end;
    });
  }

  /**
   * Get current service index for an employee
   */
  async getEmployeeIndex(employeeId, date = null) {
    const rotation = date ? await this.getByDate(date) : await this.getToday();
    if (!rotation || !rotation.employeeOrder) return -1;
    return rotation.employeeOrder.indexOf(employeeId);
  }

  /**
   * Advance rotation (move next employee to front)
   */
  async advanceRotation(date = null) {
    const rotation = date ? await this.getByDate(date) : await this.getToday();
    if (!rotation || !rotation.employeeOrder || rotation.employeeOrder.length < 2) {
      return rotation;
    }

    // Move first employee to end
    const newOrder = [...rotation.employeeOrder];
    newOrder.push(newOrder.shift());

    const targetDate = date || new Date().toISOString().split('T')[0];
    return this.setRotation(targetDate, {
      ...rotation,
      employeeOrder: newOrder,
      lastAdvanced: new Date().toISOString()
    });
  }

  /**
   * Initialize rotation for today if not exists
   */
  async initializeToday(employeeIds) {
    const today = new Date().toISOString().split('T')[0];
    const existing = await this.getByDate(today);

    if (!existing) {
      return this.setRotation(today, {
        employeeOrder: employeeIds,
        currentIndex: 0,
        servicesCompleted: 0,
        lastAdvanced: new Date().toISOString()
      });
    }

    return existing;
  }

  /**
   * Increment services completed
   */
  async incrementServices(date = null) {
    const rotation = date ? await this.getByDate(date) : await this.getToday();
    if (!rotation) return null;

    const targetDate = date || new Date().toISOString().split('T')[0];
    return this.setRotation(targetDate, {
      ...rotation,
      servicesCompleted: (rotation.servicesCompleted || 0) + 1
    });
  }
}

export default new ServiceRotationRepository();
