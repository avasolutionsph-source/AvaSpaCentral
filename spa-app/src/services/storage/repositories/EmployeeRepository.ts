/**
 * EmployeeRepository - Employee storage
 */
import BaseRepository from '../BaseRepository';
import type { Employee } from '../../../types';

class EmployeeRepository extends BaseRepository<Employee> {
  constructor() {
    super('employees');
  }

  /**
   * Get active employees
   */
  async getActive(): Promise<Employee[]> {
    return this.find((e) => e.status === 'active');
  }

  /**
   * Get employees by department
   */
  async getByDepartment(department: string): Promise<Employee[]> {
    return this.findByIndex('department', department);
  }

  /**
   * Get employees by position
   */
  async getByPosition(position: string): Promise<Employee[]> {
    return this.findByIndex('position', position);
  }

  /**
   * Get therapists (employees who can perform services)
   */
  async getTherapists(): Promise<Employee[]> {
    return this.find(
      (e) =>
        e.status === 'active' &&
        ['Massage Therapist', 'Facial Specialist', 'Body Treatment Specialist', 'Nail Technician'].includes(
          e.position
        )
    );
  }

  /**
   * Toggle employee active status
   */
  async toggleStatus(id: string): Promise<Employee> {
    const employee = await this.getById(id);
    if (!employee) throw new Error('Employee not found');

    const newStatus = employee.status === 'active' ? 'inactive' : 'active';
    return this.update(id, { status: newStatus });
  }

  /**
   * Search employees
   */
  async search(query: string): Promise<Employee[]> {
    const lowerQuery = query.toLowerCase();
    return this.find(
      (e) =>
        e.firstName.toLowerCase().includes(lowerQuery) ||
        e.lastName.toLowerCase().includes(lowerQuery) ||
        Boolean(e.email && e.email.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get employee by email
   */
  async getByEmail(email: string): Promise<Employee | undefined> {
    return this.findOne((e) => e.email?.toLowerCase() === email.toLowerCase());
  }
}

export default new EmployeeRepository();
