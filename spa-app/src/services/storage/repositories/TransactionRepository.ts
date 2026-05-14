/**
 * TransactionRepository - Transaction/Sales storage
 */
import BaseRepository from '../BaseRepository';
import type { Transaction } from '../../../types';

// Helper to get local date string (YYYY-MM-DD)
const toLocalDate = (date: Date | string): string => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface DailyTotals {
  count: number;
  total: number;
  cash: number;
  card: number;
  gcoin: number;
}

interface SalesSummary {
  totalTransactions: number;
  totalRevenue: number;
  byPaymentMethod: Record<string, number>;
  byEmployee: Record<string, number>;
}

class TransactionRepository extends BaseRepository<Transaction> {
  constructor() {
    super('transactions');
  }

  /**
   * Get transactions by date
   */
  async getByDate(date: Date | string): Promise<Transaction[]> {
    const targetDate = toLocalDate(date);
    return this.find((t) => {
      const transactionDate = typeof t.date === 'string' ? t.date.split('T')[0] : toLocalDate(t.date);
      return transactionDate === targetDate;
    });
  }

  /**
   * Get transactions by date range
   */
  async getByDateRange(startDate: Date | string, endDate: Date | string): Promise<Transaction[]> {
    const start = toLocalDate(startDate);
    const end = toLocalDate(endDate);
    return this.find((t) => {
      const transactionDate = typeof t.date === 'string' ? t.date.split('T')[0] : toLocalDate(t.date);
      return transactionDate >= start && transactionDate <= end;
    });
  }

  /**
   * Get transactions by status
   */
  async getByStatus(status: string): Promise<Transaction[]> {
    return this.findByIndex('status', status);
  }

  /**
   * Get transactions by employee
   */
  async getByEmployee(employeeId: string): Promise<Transaction[]> {
    return this.findByIndex('employeeId', employeeId);
  }

  /**
   * Get transactions by customer
   */
  async getByCustomer(customerId: string): Promise<Transaction[]> {
    return this.findByIndex('customerId', customerId);
  }

  /**
   * Get today's transactions
   */
  async getToday(): Promise<Transaction[]> {
    const today = toLocalDate(new Date());
    return this.getByDate(today);
  }

  /**
   * Calculate daily totals
   */
  async getDailyTotals(date: Date | string): Promise<DailyTotals> {
    const transactions = await this.getByDate(date);
    const completed = transactions.filter((t) => t.status === 'completed');

    return {
      count: completed.length,
      total: completed.reduce((sum, t) => sum + (t.totalAmount || 0), 0),
      cash: completed
        .filter((t) => t.paymentMethod === 'Cash')
        .reduce((sum, t) => sum + (t.totalAmount || 0), 0),
      card: completed
        .filter((t) => t.paymentMethod === 'Card')
        .reduce((sum, t) => sum + (t.totalAmount || 0), 0),
      gcoin: completed
        .filter((t) => t.paymentMethod === 'GCash')
        .reduce((sum, t) => sum + (t.totalAmount || 0), 0),
    };
  }

  /**
   * Get sales summary by period
   */
  async getSalesSummary(startDate: Date | string, endDate: Date | string): Promise<SalesSummary> {
    const transactions = await this.getByDateRange(startDate, endDate);
    const completed = transactions.filter((t) => t.status === 'completed');

    const byPaymentMethod: Record<string, number> = {};
    const byEmployee: Record<string, number> = {};

    for (const t of completed) {
      // By payment method
      const pm = t.paymentMethod || 'Cash';
      byPaymentMethod[pm] = (byPaymentMethod[pm] || 0) + (t.totalAmount || 0);

      // By employee
      if (t.employeeId) {
        byEmployee[t.employeeId] = (byEmployee[t.employeeId] || 0) + (t.totalAmount || 0);
      }
    }

    return {
      totalTransactions: completed.length,
      totalRevenue: completed.reduce((sum, t) => sum + (t.totalAmount || 0), 0),
      byPaymentMethod,
      byEmployee,
    };
  }
}

export default new TransactionRepository();
