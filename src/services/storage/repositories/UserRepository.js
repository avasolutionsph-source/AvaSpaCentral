/**
 * UserRepository - User account storage
 * Manages employee login accounts with role-based access
 */
import BaseRepository from '../BaseRepository';

class UserRepository extends BaseRepository {
  constructor() {
    super('users');
  }

  /**
   * Get user by email (for login)
   */
  async getByEmail(email) {
    return this.findOne(u => u.email?.toLowerCase() === email?.toLowerCase());
  }

  /**
   * Get user by employee ID (check if employee has account)
   */
  async getByEmployeeId(employeeId) {
    return this.findOne(u => u.employeeId === employeeId);
  }

  /**
   * Get users by role
   */
  async getByRole(role) {
    return this.find(u => u.role === role);
  }

  /**
   * Get active users
   */
  async getActive() {
    return this.find(u => u.status === 'active');
  }

  /**
   * Toggle user active status
   */
  async toggleStatus(id) {
    const user = await this.getById(id);
    if (!user) throw new Error('User not found');

    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    return this.update(id, { status: newStatus });
  }

  /**
   * Update user password
   */
  async updatePassword(id, newPassword) {
    const user = await this.getById(id);
    if (!user) throw new Error('User not found');

    return this.update(id, { password: newPassword });
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(id) {
    return this.update(id, { lastLogin: new Date().toISOString() });
  }

  /**
   * Search users by name or email
   */
  async search(query) {
    const lowerQuery = query.toLowerCase();
    return this.find(u =>
      u.firstName?.toLowerCase().includes(lowerQuery) ||
      u.lastName?.toLowerCase().includes(lowerQuery) ||
      u.email?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Check if email is already taken
   */
  async emailExists(email, excludeId = null) {
    const user = await this.getByEmail(email);
    if (!user) return false;
    if (excludeId && user._id === excludeId) return false;
    return true;
  }
}

export default new UserRepository();
