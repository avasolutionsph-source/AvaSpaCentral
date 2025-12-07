/**
 * AttendanceRepository - Attendance storage
 */
import BaseRepository from '../BaseRepository';

class AttendanceRepository extends BaseRepository {
  constructor() {
    super('attendance');
  }

  /**
   * Get by employee
   */
  async getByEmployee(employeeId) {
    return this.findByIndex('employeeId', employeeId);
  }

  /**
   * Get by date
   */
  async getByDate(date) {
    const targetDate = new Date(date).toISOString().split('T')[0];
    return this.find(a => {
      const attendanceDate = new Date(a.date).toISOString().split('T')[0];
      return attendanceDate === targetDate;
    });
  }

  /**
   * Get employee attendance for a date
   */
  async getEmployeeAttendance(employeeId, date) {
    const targetDate = new Date(date).toISOString().split('T')[0];
    return this.findOne(a =>
      a.employeeId === employeeId &&
      new Date(a.date).toISOString().split('T')[0] === targetDate
    );
  }

  /**
   * Get attendance by date range
   */
  async getByDateRange(startDate, endDate, employeeId = null) {
    return this.find(a => {
      const attendanceDate = new Date(a.date);
      const inRange = attendanceDate >= new Date(startDate) && attendanceDate <= new Date(endDate);
      if (!inRange) return false;
      if (employeeId) return a.employeeId === employeeId;
      return true;
    });
  }

  /**
   * Clock in
   */
  async clockIn(employeeId) {
    const today = new Date().toISOString().split('T')[0];
    const existing = await this.getEmployeeAttendance(employeeId, today);

    if (existing) {
      throw new Error('Already clocked in today');
    }

    return this.create({
      employeeId,
      date: today,
      clockIn: new Date().toISOString(),
      status: 'present'
    });
  }

  /**
   * Clock out
   */
  async clockOut(employeeId) {
    const today = new Date().toISOString().split('T')[0];
    const attendance = await this.getEmployeeAttendance(employeeId, today);

    if (!attendance) {
      throw new Error('No clock-in record found for today');
    }

    if (attendance.clockOut) {
      throw new Error('Already clocked out today');
    }

    const clockOut = new Date();
    const clockIn = new Date(attendance.clockIn);
    const hoursWorked = (clockOut - clockIn) / (1000 * 60 * 60);

    return this.update(attendance._id, {
      clockOut: clockOut.toISOString(),
      hoursWorked: Math.round(hoursWorked * 100) / 100
    });
  }

  /**
   * Get summary for employee
   */
  async getEmployeeSummary(employeeId, startDate, endDate) {
    const records = await this.getByDateRange(startDate, endDate, employeeId);

    return {
      totalDays: records.length,
      present: records.filter(r => r.status === 'present').length,
      absent: records.filter(r => r.status === 'absent').length,
      late: records.filter(r => r.status === 'late').length,
      totalHours: records.reduce((sum, r) => sum + (r.hoursWorked || 0), 0)
    };
  }
}

export default new AttendanceRepository();
