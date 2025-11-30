/**
 * Centralized employee filtering utilities
 * Use these instead of inline filters for consistency across the app
 */

/**
 * Get all active employees
 * @param {Array} employees - Array of employee objects
 * @returns {Array} Active employees only
 */
export const getActiveEmployees = (employees) =>
  employees.filter(e => e.active);

/**
 * Get active therapists only
 * @param {Array} employees - Array of employee objects
 * @returns {Array} Active employees with position === 'Therapist'
 */
export const getTherapists = (employees) =>
  employees.filter(e => e.active && e.position === 'Therapist');

/**
 * Get employees qualified for a specific service
 * @param {Array} employees - Array of employee objects
 * @param {Object} service - Service/product object with category
 * @returns {Array} Therapists qualified for the service
 */
export const getEmployeesForService = (employees, service) => {
  if (!service) return getTherapists(employees);

  return employees.filter(e => {
    if (!e.active || e.position !== 'Therapist') return false;
    // If employee has skills array, check if service category matches
    if (e.skills && e.skills.length > 0) {
      return e.skills.includes(service.category);
    }
    // Default: therapist can perform any service
    return true;
  });
};

/**
 * Get employees who can be assigned to rooms (therapists only)
 * @param {Array} employees - Array of employee objects
 * @returns {Array} Active therapists
 */
export const getEmployeesForRoom = (employees) =>
  getTherapists(employees);

/**
 * Get all employees for attendance display (includes inactive for history)
 * @param {Array} employees - Array of employee objects
 * @returns {Array} All employees
 */
export const getAllForAttendance = (employees) =>
  employees;

/**
 * Get employees who can clock in (active only)
 * @param {Array} employees - Array of employee objects
 * @returns {Array} Active employees only
 */
export const getActiveForClockIn = (employees) =>
  employees.filter(e => e.active);
