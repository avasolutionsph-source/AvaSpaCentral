import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { usersApi } from '../mockApi/offlineApi';

// Import shared components and hooks
import { useCrudOperations } from '../hooks';
import {
  ConfirmDialog,
  PageHeader,
  FilterBar,
  CrudModal,
  PageLoading,
  EmptyState
} from '../components/shared';

const EmployeeAccounts = ({ embedded = false, onDataChange }) => {
  const { user, showToast, isOwner } = useApp();

  // Filter state
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Employees list for dropdown
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  // Password visibility toggle
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Available roles
  const roles = ['Owner', 'Manager', 'Therapist', 'Receptionist'];

  // Initial form data for user accounts
  const initialFormData = {
    employeeId: '',
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    role: 'Therapist',
    status: 'active'
  };

  // Load employees for dropdown
  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const emps = await mockApi.employees.getEmployees();
      setEmployees(emps.filter(e => e.status === 'active'));
    } catch (error) {
      console.error('Failed to load employees:', error);
    } finally {
      setLoadingEmployees(false);
    }
  };

  // Validation function
  const validateForm = (data) => {
    const errors = {};

    if (!data.employeeId) {
      errors.employeeId = 'Please select an employee';
    }
    if (!data.email || !data.email.includes('@')) {
      errors.email = 'Valid email is required';
    }
    if (!data.firstName?.trim()) {
      errors.firstName = 'First name is required';
    }
    if (!data.lastName?.trim()) {
      errors.lastName = 'Last name is required';
    }
    if (!data.role) {
      errors.role = 'Role is required';
    }

    // Password validation only for create mode or if password is being changed
    if (modalMode === 'create') {
      if (!data.password || data.password.length < 4) {
        errors.password = 'Password must be at least 4 characters';
      }
      if (data.password !== data.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }
    } else if (data.password) {
      // Edit mode with password change
      if (data.password.length < 4) {
        errors.password = 'Password must be at least 4 characters';
      }
      if (data.password !== data.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }
    }

    if (Object.keys(errors).length > 0) {
      const firstError = Object.values(errors)[0];
      showToast(firstError, 'error');
      return { isValid: false, errors };
    }

    return { isValid: true, errors: {} };
  };

  // Use the unified CRUD hook
  const {
    items: users,
    loading,
    showModal,
    modalMode,
    formData,
    formErrors,
    isSubmitting,
    openCreate,
    openEdit,
    closeModal,
    handleInputChange,
    setFieldValue,
    setFormData,
    handleSubmit,
    deleteConfirm,
    handleDelete,
    confirmDelete,
    cancelDelete,
    isDeleting,
    loadData: loadUsers
  } = useCrudOperations({
    entityName: 'account',
    api: usersApi,
    initialFormData,
    transformForEdit: (user) => ({
      employeeId: user.employeeId || '',
      email: user.email || '',
      password: '',
      confirmPassword: '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      role: user.role || 'Therapist',
      status: user.status || 'active'
    }),
    transformForSubmit: (data, mode) => {
      const submitData = {
        employeeId: data.employeeId,
        email: data.email.trim().toLowerCase(),
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        role: data.role,
        status: data.status
      };

      // Only include password if it's set
      if (data.password) {
        submitData.password = data.password;
      }

      return submitData;
    },
    validateForm,
    onSuccess: () => {
      if (onDataChange) onDataChange();
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  });

  // Handle employee selection - auto-fill name and email
  const handleEmployeeSelect = (e) => {
    const empId = e.target.value;
    setFieldValue('employeeId', empId);

    if (empId) {
      const emp = employees.find(e => e._id === empId);
      if (emp) {
        setFormData(prev => ({
          ...prev,
          employeeId: empId,
          firstName: emp.firstName || '',
          lastName: emp.lastName || '',
          email: emp.email || ''
        }));
      }
    }
  };

  // Filter users
  const filteredUsers = useMemo(() => {
    let filtered = users;

    if (filterRole !== 'all') {
      filtered = filtered.filter(u => u.role === filterRole);
    }
    if (filterStatus !== 'all') {
      filtered = filtered.filter(u => u.status === filterStatus);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(u =>
        u.firstName?.toLowerCase().includes(term) ||
        u.lastName?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [users, filterRole, filterStatus, searchTerm]);

  // Get employees without accounts (for create dropdown)
  const availableEmployees = useMemo(() => {
    const usedEmployeeIds = new Set(users.map(u => u.employeeId).filter(Boolean));
    return employees.filter(e => !usedEmployeeIds.has(e._id));
  }, [employees, users]);

  // Handle toggle status
  const handleToggleStatus = async (userAccount) => {
    try {
      await usersApi.toggleStatus(userAccount._id);
      showToast(`Account ${userAccount.status === 'active' ? 'deactivated' : 'activated'}`, 'success');
      loadUsers();
      if (onDataChange) onDataChange();
    } catch (error) {
      showToast('Failed to update status', 'error');
    }
  };

  // Get role badge color
  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'Owner': return 'role-owner';
      case 'Manager': return 'role-manager';
      case 'Therapist': return 'role-therapist';
      case 'Receptionist': return 'role-receptionist';
      default: return '';
    }
  };

  // Get initials for avatar
  const getInitials = (firstName, lastName) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  // Filter configuration
  const filterConfig = [
    {
      key: 'role',
      value: filterRole,
      options: [
        { value: 'all', label: 'All Roles' },
        ...roles.map(r => ({ value: r, label: r }))
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
  ];

  // Check if user is Owner
  if (!isOwner()) {
    return (
      <EmptyState
        icon="🔒"
        title="Access Denied"
        description="Only Owners can manage employee accounts"
      />
    );
  }

  // Loading state
  if (loading || loadingEmployees) {
    return <PageLoading message="Loading accounts..." />;
  }

  return (
    <div className="employee-accounts-page">
      {/* Page Header */}
      {!embedded && (
        <PageHeader
          title="Employee Accounts"
          description="Create and manage employee login accounts"
          action={{ label: '+ Create Account', onClick: openCreate }}
        />
      )}

      {/* Embedded Add Button */}
      {embedded && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--spacing-md)' }}>
          <button className="btn btn-primary" onClick={openCreate}>+ Create Account</button>
        </div>
      )}

      {/* Filters */}
      <FilterBar
        searchPlaceholder="Search by name or email..."
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        filters={filterConfig}
        onFilterChange={(key, value) => {
          if (key === 'role') setFilterRole(value);
          if (key === 'status') setFilterStatus(value);
        }}
        resultCount={filteredUsers.length}
        resultLabel="accounts"
      />

      {/* Accounts Grid or Empty State */}
      {filteredUsers.length === 0 ? (
        <EmptyState
          icon="👤"
          title="No accounts found"
          description={users.length === 0 ? "Create your first employee account to get started" : "Try adjusting your filters"}
          action={users.length === 0 ? { label: 'Create First Account', onClick: openCreate } : null}
        />
      ) : (
        <div className="accounts-grid">
          {filteredUsers.map(account => (
            <div key={account._id} className={`account-card ${account.status}`}>
              <div className="account-header">
                <div className="account-avatar">
                  {getInitials(account.firstName, account.lastName)}
                </div>
                <div className="account-badges">
                  <span className={`role-badge ${getRoleBadgeClass(account.role)}`}>
                    {account.role}
                  </span>
                  <span className={`status-badge ${account.status}`}>
                    {account.status}
                  </span>
                </div>
              </div>

              <div className="account-body">
                <h3 className="account-name">
                  {account.firstName} {account.lastName}
                </h3>
                <p className="account-email">{account.email}</p>
                {account.employee && (
                  <p className="account-position">
                    {account.employee.position}
                  </p>
                )}
                {account.lastLogin && (
                  <p className="account-last-login">
                    Last login: {new Date(account.lastLogin).toLocaleDateString()}
                  </p>
                )}
              </div>

              <div className="account-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => openEdit(account)}
                >
                  Edit
                </button>
                <button
                  className={`btn ${account.status === 'active' ? 'btn-warning' : 'btn-success'}`}
                  onClick={() => handleToggleStatus(account)}
                >
                  {account.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
                {/* Prevent deleting own account */}
                {account._id !== user?._id && (
                  <button
                    className="btn btn-error"
                    onClick={() => handleDelete(account)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Account Modal */}
      <CrudModal
        isOpen={showModal}
        onClose={closeModal}
        mode={modalMode}
        title={{ create: 'Create Account', edit: 'Edit Account' }}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        className="account-modal"
      >
        <div className="form-group">
          <label>Employee *</label>
          <select
            name="employeeId"
            value={formData.employeeId}
            onChange={handleEmployeeSelect}
            className={`form-control ${formErrors.employeeId ? 'error' : ''}`}
            disabled={modalMode === 'edit'}
            required
          >
            <option value="">Select an employee...</option>
            {modalMode === 'edit' ? (
              // Show all employees in edit mode (current selection)
              employees.map(emp => (
                <option key={emp._id} value={emp._id}>
                  {emp.firstName} {emp.lastName} - {emp.position}
                </option>
              ))
            ) : (
              // Show only available employees in create mode
              availableEmployees.map(emp => (
                <option key={emp._id} value={emp._id}>
                  {emp.firstName} {emp.lastName} - {emp.position}
                </option>
              ))
            )}
          </select>
          {availableEmployees.length === 0 && modalMode === 'create' && (
            <small className="form-hint warning">
              All active employees already have accounts
            </small>
          )}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>First Name *</label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              className={`form-control ${formErrors.firstName ? 'error' : ''}`}
              placeholder="John"
              required
            />
          </div>
          <div className="form-group">
            <label>Last Name *</label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              className={`form-control ${formErrors.lastName ? 'error' : ''}`}
              placeholder="Doe"
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label>Email *</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            className={`form-control ${formErrors.email ? 'error' : ''}`}
            placeholder="john.doe@example.com"
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Role *</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              className={`form-control ${formErrors.role ? 'error' : ''}`}
              required
            >
              {roles.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Status</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              className="form-control"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>
            {modalMode === 'create' ? 'Password *' : 'New Password'}
            {modalMode === 'edit' && <small> (leave blank to keep current)</small>}
          </label>
          <div className="password-input-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              className={`form-control ${formErrors.password ? 'error' : ''}`}
              placeholder={modalMode === 'create' ? 'Enter password' : 'Enter new password'}
              required={modalMode === 'create'}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <div className="form-group">
          <label>
            {modalMode === 'create' ? 'Confirm Password *' : 'Confirm New Password'}
          </label>
          <div className="password-input-wrapper">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              className={`form-control ${formErrors.confirmPassword ? 'error' : ''}`}
              placeholder="Confirm password"
              required={modalMode === 'create' || formData.password}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? '🙈' : '👁️'}
            </button>
          </div>
        </div>
      </CrudModal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="Delete Account"
        message={`Are you sure you want to delete the account for "${deleteConfirm.item?.firstName} ${deleteConfirm.item?.lastName}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmVariant="danger"
        isLoading={isDeleting}
      />

      <style>{`
        .employee-accounts-page {
          padding: var(--spacing-md);
        }

        .accounts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: var(--spacing-md);
        }

        .account-card {
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: var(--spacing-md);
          transition: all 0.2s ease;
        }

        .account-card:hover {
          box-shadow: var(--shadow-md);
          transform: translateY(-2px);
        }

        .account-card.inactive {
          opacity: 0.7;
        }

        .account-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: var(--spacing-md);
        }

        .account-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: var(--accent-gradient);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 1.1rem;
        }

        .account-badges {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
          align-items: flex-end;
        }

        .role-badge {
          padding: 4px 8px;
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        .role-owner {
          background: linear-gradient(135deg, #ffd700, #ffb700);
          color: #333;
        }

        .role-manager {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
        }

        .role-therapist {
          background: linear-gradient(135deg, #11998e, #38ef7d);
          color: white;
        }

        .role-receptionist {
          background: linear-gradient(135deg, #ee9ca7, #ffdde1);
          color: #333;
        }

        .status-badge {
          padding: 2px 6px;
          border-radius: var(--radius-xs);
          font-size: 0.7rem;
          font-weight: 500;
        }

        .status-badge.active {
          background: var(--success-bg);
          color: var(--success);
        }

        .status-badge.inactive {
          background: var(--error-bg);
          color: var(--error);
        }

        .account-body {
          margin-bottom: var(--spacing-md);
        }

        .account-name {
          font-size: 1.1rem;
          font-weight: 600;
          margin: 0 0 var(--spacing-xs) 0;
          color: var(--text-primary);
        }

        .account-email {
          font-size: 0.9rem;
          color: var(--text-secondary);
          margin: 0 0 var(--spacing-xs) 0;
        }

        .account-position {
          font-size: 0.85rem;
          color: var(--text-tertiary);
          margin: 0;
        }

        .account-last-login {
          font-size: 0.8rem;
          color: var(--text-tertiary);
          margin: var(--spacing-xs) 0 0 0;
        }

        .account-actions {
          display: flex;
          gap: var(--spacing-xs);
          flex-wrap: wrap;
        }

        .account-actions .btn {
          flex: 1;
          min-width: 80px;
        }

        .password-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .password-input-wrapper input {
          padding-right: 40px;
        }

        .password-toggle {
          position: absolute;
          right: 10px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          font-size: 1rem;
          opacity: 0.7;
        }

        .password-toggle:hover {
          opacity: 1;
        }

        .form-hint.warning {
          color: var(--warning);
        }

        @media (max-width: 768px) {
          .accounts-grid {
            grid-template-columns: 1fr;
          }

          .account-actions {
            flex-direction: column;
          }

          .account-actions .btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default EmployeeAccounts;
