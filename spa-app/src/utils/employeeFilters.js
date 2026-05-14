/**
 * Centralized employee filtering utilities
 * Use these instead of inline filters for consistency across the app
 */

/**
 * Check if employee is active
 * Supports both 'active' boolean and status: 'active' string formats
 */
const isActive = (e) => e.active === true || e.status === 'active';

/**
 * Check if employee is a service provider (therapist, specialist, etc.)
 * Matches: Therapist, Senior Therapist, Junior Therapist, Facial Specialist, etc.
 */
const isServiceProvider = (e) => {
  const position = (e.position || '').toLowerCase();
  return position.includes('therapist') ||
         position.includes('specialist') ||
         e.department === 'Massage' ||
         e.department === 'Facial';
};

/**
 * Get all active employees
 * @param {Array} employees - Array of employee objects
 * @returns {Array} Active employees only
 */
export const getActiveEmployees = (employees) =>
  employees.filter(e => isActive(e));

/**
 * Get active therapists/service providers
 * @param {Array} employees - Array of employee objects
 * @returns {Array} Active employees who provide services
 */
export const getTherapists = (employees) =>
  employees.filter(e => isActive(e) && isServiceProvider(e));

/**
 * Get employees qualified for a specific service
 * @param {Array} employees - Array of employee objects
 * @param {Object} service - Service/product object with category
 * @returns {Array} Therapists qualified for the service
 */
export const getEmployeesForService = (employees, service) => {
  const therapists = getTherapists(employees);
  if (!service) return therapists;

  // Try to narrow to therapists who are explicitly compatible:
  // - their `department` matches the service's high-level category
  //   (e.g. department 'Massage' for category 'Massage'), OR
  // - their `skills` array contains the service's category as a literal
  //   entry (rare — service categories are high-level like 'Massage'
  //   while skills are specific techniques like 'Swedish Massage' — but
  //   honour it when it does line up).
  //
  // If the narrow filter yields nothing, fall back to all active
  // therapists. The previous behaviour returned an empty list whenever
  // the skill/category vocabularies didn't overlap, which made the
  // Therapist dropdown disappear the moment a service was picked and
  // blocked appointment creation entirely.
  const compatible = therapists.filter(e => {
    if (service.category && e.department === service.category) return true;
    if (Array.isArray(e.skills) && e.skills.includes(service.category)) return true;
    return false;
  });

  return compatible.length > 0 ? compatible : therapists;
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
  employees.filter(e => isActive(e));
