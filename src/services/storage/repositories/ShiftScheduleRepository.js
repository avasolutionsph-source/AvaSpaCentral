/**
 * ShiftScheduleRepository - Shift schedules storage
 */
import BaseRepository from '../BaseRepository';
import db from '../../../db';

class ShiftScheduleRepository extends BaseRepository {
  constructor() {
    super('shiftSchedules');
  }

  /**
   * Get all schedules
   */
  async getAllSchedules() {
    return this.getAll();
  }

  /**
   * Get active schedules only
   */
  async getActiveSchedules() {
    return this.findByIndex('isActive', true);
  }

  /**
   * Get schedule by employee
   */
  async getScheduleByEmployee(employeeId) {
    const schedule = await this.findOne(s => s.employeeId === employeeId && s.isActive);
    return schedule || null;
  }

  /**
   * Get current user's schedule
   */
  async getMySchedule(userId, employees) {
    // Find the user's employee record
    const userEmployee = employees?.find(e => e.userId === userId);
    if (!userEmployee) return null;

    return this.getScheduleByEmployee(userEmployee._id);
  }

  /**
   * Create new schedule
   */
  async createSchedule(scheduleData, employee = null) {
    // Deactivate existing schedule for this employee
    const existingSchedules = await this.find(s => s.employeeId === scheduleData.employeeId);
    for (const existing of existingSchedules) {
      await this.update(existing._id, { isActive: false });
    }

    const newSchedule = {
      businessId: 'biz_001',
      employeeId: scheduleData.employeeId,
      employeeName: employee ? `${employee.firstName} ${employee.lastName}` : scheduleData.employeeName || 'Unknown',
      employeePosition: employee?.position || scheduleData.employeePosition || '',
      effectiveDate: scheduleData.effectiveDate || new Date().toISOString().split('T')[0],
      weeklySchedule: scheduleData.weeklySchedule,
      isActive: true,
      notes: scheduleData.notes || '',
      createdBy: scheduleData.createdBy || 'user_001'
    };

    return this.create(newSchedule);
  }

  /**
   * Update schedule
   */
  async updateSchedule(scheduleId, updates) {
    return this.update(scheduleId, updates);
  }

  /**
   * Delete/archive schedule (soft delete)
   */
  async deleteSchedule(scheduleId) {
    return this.update(scheduleId, {
      isActive: false,
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Apply template to employee
   */
  async applyTemplate(employeeId, template, employee = null) {
    return this.createSchedule({
      employeeId,
      weeklySchedule: template.weeklySchedule,
      notes: `Applied from template: ${template.name}`
    }, employee);
  }

  /**
   * Get schedules by department
   */
  async getByDepartment(department, employees) {
    const deptEmployeeIds = employees
      .filter(e => e.department === department)
      .map(e => e._id);

    return this.find(s => deptEmployeeIds.includes(s.employeeId) && s.isActive);
  }
}

export default new ShiftScheduleRepository();
