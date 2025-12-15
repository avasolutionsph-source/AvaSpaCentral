/**
 * TransactionRepository - Transaction/Sales storage
 */
import BaseRepository from '../BaseRepository';

// Helper to get local date string (YYYY-MM-DD)
const toLocalDate = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

class TransactionRepository extends BaseRepository {
  constructor() {
    super('transactions');
  }

  /**
   * Get transactions by date
   */
  async getByDate(date) {
    const targetDate = toLocalDate(date);
    return this.find(t => {
      const transactionDate = typeof t.date === 'string' ? t.date : toLocalDate(t.date);
      return transactionDate === targetDate;
    });
  }

  /**
   * Get transactions by date range
   */
  async getByDateRange(startDate, endDate) {
    const start = toLocalDate(startDate);
    const end = toLocalDate(endDate);
    return this.find(t => {
      const transactionDate = typeof t.date === 'string' ? t.date : toLocalDate(t.date);
      return transactionDate >= start && transactionDate <= end;
    });
  }

  /**
   * Get transactions by status
   */
  async getByStatus(status) {
    return this.findByIndex('status', status);
  }

  /**
   * Get transactions by employee
   */
  async getByEmployee(employeeId) {
    return this.findByIndex('employeeId', employeeId);
  }

  /**
   * Get transactions by customer
   */
  async getByCustomer(customerId) {
    return this.findByIndex('customerId', customerId);
  }

  /**
   * Get today's transactions
   */
  async getToday() {
    const today = toLocalDate(new Date());
    return this.getByDate(today);
  }

  /**
   * Calculate daily totals
   */
  async getDailyTotals(date) {
    const transactions = await this.getByDate(date);
    const completed = transactions.filter(t => t.status === 'completed');

    return {
      count: completed.length,
      total: completed.reduce((sum, t) => sum + (t.total || 0), 0),
      cash: completed.filter(t => t.paymentMethod === 'cash').reduce((sum, t) => sum + (t.total || 0), 0),
      card: completed.filter(t => t.paymentMethod === 'card').reduce((sum, t) => sum + (t.total || 0), 0),
      gcoin: completed.filter(t => t.paymentMethod === 'gcoin').reduce((sum, t) => sum + (t.total || 0), 0)
    };
  }

  /**
   * Get sales summary by period
   */
  async getSalesSummary(startDate, endDate) {
    const transactions = await this.getByDateRange(startDate, endDate);
    const completed = transactions.filter(t => t.status === 'completed');

    const byPaymentMethod = {};
    const byEmployee = {};

    for (const t of completed) {
      // By payment method
      const pm = t.paymentMethod || 'cash';
      byPaymentMethod[pm] = (byPaymentMethod[pm] || 0) + (t.total || 0);

      // By employee
      if (t.employeeId) {
        byEmployee[t.employeeId] = (byEmployee[t.employeeId] || 0) + (t.total || 0);
      }
    }

    return {
      totalTransactions: completed.length,
      totalRevenue: completed.reduce((sum, t) => sum + (t.total || 0), 0),
      byPaymentMethod,
      byEmployee
    };
  }
}

export default new TransactionRepository();
