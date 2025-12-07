/**
 * ExpenseRepository - Expense storage
 */
import BaseRepository from '../BaseRepository';

class ExpenseRepository extends BaseRepository {
  constructor() {
    super('expenses');
  }

  /**
   * Get expenses by date range
   */
  async getByDateRange(startDate, endDate) {
    return this.find(e => {
      const expenseDate = new Date(e.date);
      return expenseDate >= new Date(startDate) && expenseDate <= new Date(endDate);
    });
  }

  /**
   * Get expenses by category
   */
  async getByCategory(category) {
    return this.findByIndex('category', category);
  }

  /**
   * Get expenses by expense type
   */
  async getByExpenseType(expenseType) {
    return this.findByIndex('expenseType', expenseType);
  }

  /**
   * Get recurring expenses
   */
  async getRecurring() {
    return this.find(e => e.isRecurring === true);
  }

  /**
   * Calculate total expenses for a period
   */
  async getTotalByPeriod(startDate, endDate) {
    const expenses = await this.getByDateRange(startDate, endDate);
    return expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }

  /**
   * Get expense summary by category
   */
  async getSummaryByCategory(startDate, endDate) {
    const expenses = await this.getByDateRange(startDate, endDate);
    const summary = {};

    for (const expense of expenses) {
      const cat = expense.category || 'Other';
      if (!summary[cat]) {
        summary[cat] = { count: 0, total: 0 };
      }
      summary[cat].count++;
      summary[cat].total += expense.amount || 0;
    }

    return summary;
  }
}

export default new ExpenseRepository();
