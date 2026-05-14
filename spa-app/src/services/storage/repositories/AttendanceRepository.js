/**
 * AttendanceRepository - Attendance storage
 */
import BaseRepository from '../BaseRepository';

// Helper to get local date string (YYYY-MM-DD)
const toLocalDate = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

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
    const targetDate = toLocalDate(date);
    return this.find(a => {
      // Handle both string dates and Date objects
      const attendanceDate = typeof a.date === 'string' ? a.date : toLocalDate(a.date);
      return attendanceDate === targetDate;
    });
  }

  /**
   * Get employee attendance for a date
   */
  async getEmployeeAttendance(employeeId, date) {
    const targetDate = toLocalDate(date);
    return this.findOne(a => {
      const attendanceDate = typeof a.date === 'string' ? a.date : toLocalDate(a.date);
      return a.employeeId === employeeId && attendanceDate === targetDate;
    });
  }

  /**
   * Get attendance by date range
   */
  async getByDateRange(startDate, endDate, employeeId = null) {
    const start = toLocalDate(startDate);
    const end = toLocalDate(endDate);
    return this.find(a => {
      const attendanceDate = typeof a.date === 'string' ? a.date : toLocalDate(a.date);
      const inRange = attendanceDate >= start && attendanceDate <= end;
      if (!inRange) return false;
      if (employeeId) return a.employeeId === employeeId;
      return true;
    });
  }

  /**
   * Clock in
   */
  async clockIn(employeeId) {
    const today = toLocalDate(new Date());
    const existing = await this.getEmployeeAttendance(employeeId, today);

    if (existing) {
      throw new Error('Already clocked in today');
    }

    return this.create({
      employeeId,
      date: today,
      clockIn: new Date().toTimeString().slice(0, 5), // HH:mm format
      status: 'present'
    });
  }

  /**
   * Clock out
   */
  async clockOut(employeeId) {
    const today = toLocalDate(new Date());
    let attendance = await this.getEmployeeAttendance(employeeId, today);

    // If not found today, check yesterday (overnight shift)
    if (!attendance || attendance.clockOut) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = toLocalDate(yesterday);
      const yesterdayRecord = await this.getEmployeeAttendance(employeeId, yesterdayStr);
      if (yesterdayRecord && yesterdayRecord.clockIn && !yesterdayRecord.clockOut) {
        attendance = yesterdayRecord;
      }
    }

    if (!attendance) {
      throw new Error('No clock-in record found');
    }

    if (attendance.clockOut) {
      throw new Error('Already clocked out');
    }

    const nowTime = new Date().toTimeString().slice(0, 5); // HH:mm format

    return this.update(attendance._id, {
      clockOut: nowTime
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
