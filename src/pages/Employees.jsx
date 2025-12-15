import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { useCrudOperations } from '../hooks';
import { CrudModal, FilterBar, PageHeader, ConfirmDialog, EmptyState } from '../components/shared';

// Constants - 4 positions that map directly to roles
const POSITIONS = [
  { value: 'Owner', label: 'Owner', role: 'Owner', department: 'Management' },
  { value: 'Manager', label: 'Manager', role: 'Manager', department: 'Management' },
  { value: 'Therapist', label: 'Therapist', role: 'Therapist', department: 'Services' },
  { value: 'Receptionist', label: 'Receptionist', role: 'Receptionist', department: 'Front Desk' }
];
const DEPARTMENTS = ['Management', 'Services', 'Front Desk'];
const SKILLS_LIST = ['Swedish Massage', 'Deep Tissue', 'Hot Stone', 'Aromatherapy', 'Facial Treatment', 'Body Scrub', 'Manicure', 'Pedicure', 'Nail Art', 'Waxing'];

// Hours per month for rate calculation (22 working days * 8 hours)
const HOURS_PER_MONTH = 176;

const INITIAL_FORM_DATA = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  position: '',
  department: '',
  role: '',
  commission: { type: 'percentage', value: '' },
  hourlyRate: '',
  monthlyRate: '',
  rateType: 'hourly', // 'hourly' or 'monthly'
  hireDate: '',
  skills: []
};

const Employees = ({ embedded = false, onDataChange }) => {
  const { showToast, canEdit, isManager } = useApp();

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState('cards');

  // Custom validation for employees
  const validateEmployee = useCallback((data) => {
    if (!data.firstName?.trim()) {
      showToast('First name is required', 'error');
      return false;
    }
    if (!data.lastName?.trim()) {
      showToast('Last name is required', 'error');
      return false;
    }
    if (!data.email?.trim()) {
      showToast('Email is required', 'error');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      showToast('Invalid email format', 'error');
      return false;
    }
    if (!data.phone?.trim()) {
      showToast('Phone is required', 'error');
      return false;
    }
    const phoneRegex = /^[\d\s+\-()]{7,15}$/;
    if (!phoneRegex.test(data.phone.trim())) {
      showToast('Please enter a valid phone number', 'error');
      return false;
    }
    if (!data.position) {
      showToast('Position is required', 'error');
      return false;
    }
    // Commission validation
    if (!data.commission?.value || parseFloat(data.commission.value) < 0) {
      showToast('Valid commission is required', 'error');
      return false;
    }
    if (data.commission?.type === 'percentage' && parseFloat(data.commission.value) > 100) {
      showToast('Commission percentage cannot exceed 100%', 'error');
      return false;
    }
    // Rate validation - allow 0 values, just ensure they're valid numbers
    const hourlyRate = parseFloat(data.hourlyRate) || 0;
    const monthlyRate = parseFloat(data.monthlyRate) || 0;
    if (hourlyRate < 0 || monthlyRate < 0) {
      showToast('Rates cannot be negative', 'error');
      return false;
    }
    if (!data.hireDate) {
      showToast('Hire date is required', 'error');
      return false;
    }
    return true;
  }, [showToast]);

  // Transform for edit
  const transformForEdit = useCallback((employee) => {
    const hourlyRate = employee.hourlyRate || 0;
    const monthlyRate = employee.monthlyRate || (hourlyRate * HOURS_PER_MONTH);
    return {
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      phone: employee.phone,
      position: employee.position,
      department: employee.department,
      role: employee.role,
      commission: { type: employee.commission?.type || 'percentage', value: employee.commission?.value?.toString() || '' },
      hourlyRate: hourlyRate.toString(),
      monthlyRate: monthlyRate.toString(),
      rateType: employee.rateType || 'hourly',
      hireDate: employee.hireDate || '',
      skills: employee.skills || []
    };
  }, []);

  // Transform for submit
  const transformForSubmit = useCallback((data) => {
    const hourlyRate = parseFloat(data.hourlyRate) || 0;
    const monthlyRate = parseFloat(data.monthlyRate) || 0;
    return {
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: data.email.trim(),
      phone: data.phone.trim(),
      position: data.position,
      department: data.department,
      role: data.role, // role = position
      commission: { type: data.commission.type, value: parseFloat(data.commission.value) || 0 },
      hourlyRate: hourlyRate,
      monthlyRate: monthlyRate,
      rateType: data.rateType,
      hireDate: data.hireDate,
      skills: data.skills
    };
  }, []);

  // CRUD operations
  const {
    items: employees,
    loading,
    showModal,
    modalMode,
    formData,
    isSubmitting,
    openCreate,
    openEdit,
    closeModal,
    handleInputChange,
    handleSubmit,
    deleteConfirm,
    handleDelete,
    confirmDelete,
    cancelDelete,
    toggleStatus,
    setFormData
  } = useCrudOperations({
    entityName: 'employee',
    api: mockApi.employees,
    initialFormData: INITIAL_FORM_DATA,
    transformForEdit,
    transformForSubmit,
    validateForm: validateEmployee
  });

  // Custom handler for nested commission fields and position-role-department auto-linking
  const handleFieldChange = useCallback((e) => {
    const { name, value } = e.target;
    if (name.startsWith('commission.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({ ...prev, commission: { ...prev.commission, [field]: value } }));
    } else if (name === 'position') {
      // When position changes, auto-set role and department
      const positionConfig = POSITIONS.find(p => p.value === value);
      if (positionConfig) {
        setFormData(prev => ({
          ...prev,
          position: value,
          role: positionConfig.role,
          department: positionConfig.department
        }));
      } else {
        setFormData(prev => ({ ...prev, position: value }));
      }
    } else if (name === 'hourlyRate') {
      // When hourly rate changes, auto-calculate monthly rate
      const hourly = parseFloat(value) || 0;
      const monthly = hourly * HOURS_PER_MONTH;
      setFormData(prev => ({
        ...prev,
        hourlyRate: value,
        monthlyRate: monthly > 0 ? monthly.toFixed(2) : ''
      }));
    } else if (name === 'monthlyRate') {
      // When monthly rate changes, auto-calculate hourly rate
      const monthly = parseFloat(value) || 0;
      const hourly = monthly / HOURS_PER_MONTH;
      setFormData(prev => ({
        ...prev,
        monthlyRate: value,
        hourlyRate: hourly > 0 ? hourly.toFixed(2) : ''
      }));
    } else if (name === 'rateType') {
      setFormData(prev => ({ ...prev, rateType: value }));
    } else {
      handleInputChange(e);
    }
  }, [handleInputChange, setFormData]);

  // Handle skill toggle
  const handleSkillToggle = useCallback((skill) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill]
    }));
  }, [setFormData]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    let filtered = [...employees];

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(e =>
        e.firstName.toLowerCase().includes(search) ||
        e.lastName.toLowerCase().includes(search) ||
        e.email.toLowerCase().includes(search) ||
        e.position.toLowerCase().includes(search)
      );
    }

    if (filterDepartment !== 'all') {
      filtered = filtered.filter(e => e.department === filterDepartment);
    }
    if (filterRole !== 'all') {
      filtered = filtered.filter(e => e.role === filterRole);
    }
    if (filterStatus !== 'all') {
      const isActive = filterStatus === 'active';
      filtered = filtered.filter(e => e.active === isActive);
    }

    return filtered;
  }, [employees, searchTerm, filterDepartment, filterRole, filterStatus]);

  // Filter configuration
  const filters = useMemo(() => [
    {
      key: 'department',
      value: filterDepartment,
      options: [
        { value: 'all', label: 'All Departments' },
        ...DEPARTMENTS.map(dept => ({ value: dept, label: dept }))
      ]
    },
    {
      key: 'role',
      value: filterRole,
      options: [
        { value: 'all', label: 'All Roles' },
        ...POSITIONS.map(pos => ({ value: pos.role, label: pos.label }))
      ]
    },
    {
      key: 'status',
      value: filterStatus,
      options: [
        { value: 'all', label: 'All Status' },
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' }
      ]
    }
  ], [filterDepartment, filterRole, filterStatus]);

  const handleFilterChange = useCallback((key, value) => {
    if (key === 'department') setFilterDepartment(value);
    else if (key === 'role') setFilterRole(value);
    else if (key === 'status') setFilterStatus(value);
  }, []);

  if (loading) {
    return <div className="page-loading"><div className="spinner"></div><p>Loading employees...</p></div>;
  }

  return (
    <div className="employees-page">
      {!embedded && (
        <PageHeader
          title="Employee Management"
          description={canEdit() ? 'Manage your team members and their information' : 'View team members and their information'}
          action={canEdit() ? { label: '+ Add Employee', onClick: openCreate } : null}
        />
      )}

      {/* Embedded header with just the action button */}
      {embedded && canEdit() && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--spacing-md)' }}>
          <button className="btn btn-primary" onClick={openCreate}>+ Add Employee</button>
        </div>
      )}

      <div className="filters-section">
        <FilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search employees..."
          filters={filters}
          onFilterChange={handleFilterChange}
          resultCount={filteredEmployees.length}
          resultLabel="employees"
        >
          <div className="view-toggle">
            <button
              className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('cards')}
            >
              Cards
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('table')}
            >
              Table
            </button>
          </div>
        </FilterBar>
      </div>

      {filteredEmployees.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No employees found"
          description={searchTerm || filterDepartment !== 'all' || filterRole !== 'all' || filterStatus !== 'all'
            ? 'Try adjusting your filters or search term'
            : 'Add your first team member to get started'
          }
          action={canEdit() && !searchTerm ? { label: 'Add Your First Employee', onClick: openCreate } : null}
        />
      ) : viewMode === 'cards' ? (
        <div className="employees-grid">
          {filteredEmployees.map(employee => (
            <div key={employee._id} className={`employee-card ${!employee.active ? 'inactive' : ''}`}>
              <div className="employee-header">
                <div className="employee-avatar">
                  {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
                </div>
                <div className="employee-status-badge">
                  {employee.active ? '✓ Active' : '✕ Inactive'}
                </div>
              </div>
              <h3 className="employee-name">{employee.firstName} {employee.lastName}</h3>
              <p className="employee-position">{employee.position}</p>
              <div className="employee-details">
                <div className="detail-row">
                  <span className="label">Department:</span>
                  <span className="value">{employee.department}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Role:</span>
                  <span className="value role-badge">{employee.role}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Email:</span>
                  <span className="value small">{employee.email}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Phone:</span>
                  <span className="value">{employee.phone}</span>
                </div>
                {!isManager() && (
                  <>
                    <div className="detail-row">
                      <span className="label">Commission:</span>
                      <span className="value">{employee.commission?.value || 0}{employee.commission?.type === 'percentage' ? '%' : ' PHP'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Rate:</span>
                      <span className="value">
                        ₱{employee.hourlyRate?.toLocaleString() || 0}/hr
                        {employee.monthlyRate && ` (₱${employee.monthlyRate?.toLocaleString()}/mo)`}
                      </span>
                    </div>
                  </>
                )}
                {employee.skills && employee.skills.length > 0 && (
                  <div className="employee-skills">
                    {employee.skills.slice(0, 3).map(skill => (
                      <span key={skill} className="skill-badge">{skill}</span>
                    ))}
                    {employee.skills.length > 3 && <span className="skill-badge">+{employee.skills.length - 3}</span>}
                  </div>
                )}
              </div>
              {canEdit() && (
                <div className="employee-actions">
                  <button className="btn btn-sm btn-secondary" onClick={() => openEdit(employee)}>Edit</button>
                  <button
                    className={`btn btn-sm ${employee.status === 'active' ? 'btn-warning' : 'btn-success'}`}
                    onClick={() => toggleStatus(employee)}
                  >
                    {employee.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                  <button className="btn btn-sm btn-error" onClick={() => handleDelete(employee)}>Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Position</th>
                <th>Department</th>
                <th>Role</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Status</th>
                {canEdit() && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map(employee => (
                <tr key={employee._id} className={employee.status !== 'active' ? 'inactive-row' : ''}>
                  <td className="employee-name-cell">
                    <div className="table-avatar">
                      {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
                    </div>
                    <span>{employee.firstName} {employee.lastName}</span>
                  </td>
                  <td>{employee.position}</td>
                  <td>{employee.department}</td>
                  <td><span className="role-badge">{employee.role}</span></td>
                  <td className="small-text">{employee.email}</td>
                  <td>{employee.phone}</td>
                  <td>
                    <span className={`status-badge ${employee.status === 'active' ? 'status-active' : 'status-inactive'}`}>
                      {employee.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {canEdit() && (
                    <td className="actions-cell">
                      <button className="btn btn-xs btn-secondary" onClick={() => openEdit(employee)}>Edit</button>
                      <button
                        className={`btn btn-xs ${employee.status === 'active' ? 'btn-warning' : 'btn-success'}`}
                        onClick={() => toggleStatus(employee)}
                      >
                        {employee.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                      <button className="btn btn-xs btn-error" onClick={() => handleDelete(employee)}>Delete</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Employee Modal */}
      <CrudModal
        isOpen={showModal}
        onClose={closeModal}
        mode={modalMode}
        title="Employee"
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        size="large"
      >
        <div className="form-row">
          <div className="form-group">
            <label>First Name *</label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleFieldChange}
              placeholder="Enter first name"
              className="form-control"
              required
            />
          </div>
          <div className="form-group">
            <label>Last Name *</label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleFieldChange}
              placeholder="Enter last name"
              className="form-control"
              required
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Email *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleFieldChange}
              placeholder="email@example.com"
              className="form-control"
              required
            />
          </div>
          <div className="form-group">
            <label>Phone *</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleFieldChange}
              placeholder="+63 912 345 6789"
              className="form-control"
              required
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Position / Role *</label>
            <select
              name="position"
              value={formData.position}
              onChange={handleFieldChange}
              className="form-control"
              required
            >
              <option value="">Select position...</option>
              {POSITIONS.map(pos => <option key={pos.value} value={pos.value}>{pos.label}</option>)}
            </select>
            {formData.position && (
              <small className="form-help">
                Department: {formData.department} | Role: {formData.role}
              </small>
            )}
          </div>
          <div className="form-group">
            <label>Hire Date *</label>
            <input
              type="date"
              name="hireDate"
              value={formData.hireDate}
              onChange={handleFieldChange}
              className="form-control"
              required
            />
          </div>
        </div>
        <div className="form-group">
          <label>Rate Type *</label>
          <div className="rate-type-toggle">
            <button
              type="button"
              className={`btn btn-sm ${formData.rateType === 'hourly' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handleFieldChange({ target: { name: 'rateType', value: 'hourly' } })}
            >
              Hourly
            </button>
            <button
              type="button"
              className={`btn btn-sm ${formData.rateType === 'monthly' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handleFieldChange({ target: { name: 'rateType', value: 'monthly' } })}
            >
              Monthly
            </button>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Hourly Rate (₱) {formData.rateType === 'hourly' ? '*' : ''}</label>
            <input
              type="number"
              name="hourlyRate"
              value={formData.hourlyRate}
              onChange={handleFieldChange}
              placeholder="0.00"
              className="form-control"
              min="0"
              step="0.01"
              required={formData.rateType === 'hourly'}
            />
            <small className="form-help">Per hour rate</small>
          </div>
          <div className="form-group">
            <label>Monthly Rate (₱) {formData.rateType === 'monthly' ? '*' : ''}</label>
            <input
              type="number"
              name="monthlyRate"
              value={formData.monthlyRate}
              onChange={handleFieldChange}
              placeholder="0.00"
              className="form-control"
              min="0"
              step="0.01"
              required={formData.rateType === 'monthly'}
            />
            <small className="form-help">Based on {HOURS_PER_MONTH} hrs/month</small>
          </div>
        </div>
        <div className="form-group">
          <label>Commission *</label>
          <div className="commission-group">
            <select
              name="commission.type"
              value={formData.commission.type}
              onChange={handleFieldChange}
              className="form-control commission-type"
            >
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed (₱)</option>
            </select>
            <input
              type="number"
              name="commission.value"
              value={formData.commission.value}
              onChange={handleFieldChange}
              placeholder="0"
              className="form-control commission-value"
              min="0"
              step={formData.commission.type === 'percentage' ? '1' : '0.01'}
              required
            />
          </div>
        </div>
        <div className="form-group">
          <label>Skills</label>
          <div className="skills-selector">
            {SKILLS_LIST.map(skill => (
              <label key={skill} className="skill-checkbox">
                <input
                  type="checkbox"
                  checked={formData.skills.includes(skill)}
                  onChange={() => handleSkillToggle(skill)}
                />
                <span>{skill}</span>
              </label>
            ))}
          </div>
        </div>
      </CrudModal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="Delete Employee"
        message={`Are you sure you want to delete "${deleteConfirm.item?.firstName} ${deleteConfirm.item?.lastName}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmVariant="danger"
      />
    </div>
  );
};

export default Employees;
