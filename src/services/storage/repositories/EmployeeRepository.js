/**
 * EmployeeRepository - Employee storage
 */
import BaseRepository from '../BaseRepository';

class EmployeeRepository extends BaseRepository {
  constructor() {
    super('employees');
  }

  /**
   * Get active employees
   */
  async getActive() {
    return this.find(e => e.status === 'active' || e.active === true);
  }

  /**
   * Get employees by department
   */
  async getByDepartment(department) {
    return this.findByIndex('department', department);
  }

  /**
   * Get employees by position
   */
  async getByPosition(position) {
    return this.findByIndex('position', position);
  }

  /**
   * Get therapists (employees who can perform services)
   */
  async getTherapists() {
    return this.find(e =>
      (e.status === 'active' || e.active === true) &&
      ['Massage Therapist', 'Facial Specialist', 'Body Treatment Specialist', 'Nail Technician'].includes(e.position)
    );
  }

  /**
   * Toggle employee active status
   */
  async toggleStatus(id) {
    const employee = await this.getById(id);
    if (!employee) throw new Error('Employee not found');

    const newStatus = employee.status === 'active' ? 'inactive' : 'active';
    return this.update(id, {
      status: newStatus,
      active: newStatus === 'active'
    });
  }

  /**
   * Search employees
   */
  async search(query) {
    const lowerQuery = query.toLowerCase();
    return this.find(e =>
      e.firstName.toLowerCase().includes(lowerQuery) ||
      e.lastName.toLowerCase().includes(lowerQuery) ||
      e.email.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get employee by email
   */
  async getByEmail(email) {
    return this.findOne(e => e.email.toLowerCase() === email.toLowerCase());
  }
}

export default new EmployeeRepository();
