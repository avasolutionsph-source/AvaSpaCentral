import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { usersApi } from '../mockApi/offlineApi';
import { authService, isSupabaseConfigured } from '../services/supabase';
import { db } from '../db';

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

const EmployeeAccounts = ({ embedded = false, onDataChange, onOpenCreateRef }) => {
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
    username: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    role: 'Therapist',
    status: 'active'
  };

  // Track if we're creating via Supabase
  const [isCreatingSupabase, setIsCreatingSupabase] = useState(false);

  // Username validation state
  const [usernameStatus, setUsernameStatus] = useState({ checking: false, available: null, message: '' });
  const usernameCheckTimeout = useRef(null);

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
      // Silent fail for employees load
    } finally {
      setLoadingEmployees(false);
    }
  };

  // Generate username suggestion from employee name
  const generateUsername = (firstName, lastName) => {
    if (!firstName || !lastName) return '';
    const base = `${firstName.toLowerCase()}_${lastName.toLowerCase()}`.replace(/[^a-z0-9_]/g, '');
    return base.substring(0, 20);
  };

  // Check username availability (debounced)
  const checkUsernameAvailability = async (username) => {
    if (!username || username.length < 3) {
      setUsernameStatus({ checking: false, available: null, message: '' });
      return;
    }

    // Clear previous timeout
    if (usernameCheckTimeout.current) {
      clearTimeout(usernameCheckTimeout.current);
    }

    setUsernameStatus({ checking: true, available: null, message: 'Checking...' });

    // Debounce the check
    usernameCheckTimeout.current = setTimeout(async () => {
      try {
        // First check local Dexie for existing usernames
        const localUsers = await db.users.where('username').equals(username.toLowerCase()).toArray();
        if (localUsers.length > 0) {
          setUsernameStatus({ checking: false, available: false, message: 'Username already taken' });
          return;
        }

        // Then check Supabase if configured
        if (isSupabaseConfigured()) {
          const isAvailable = await authService.isUsernameAvailable(username);
          if (isAvailable) {
            setUsernameStatus({ checking: false, available: true, message: 'Username available' });
          } else {
            setUsernameStatus({ checking: false, available: false, message: 'Username already taken' });
          }
        } else {
          // Offline mode - only local check was done
          setUsernameStatus({ checking: false, available: true, message: 'Username available (offline)' });
        }
      } catch (error) {
        console.error('Username check error:', error);
        setUsernameStatus({ checking: false, available: null, message: 'Could not verify username' });
      }
    }, 500); // 500ms debounce
  };

  // Handle username input change
  const handleUsernameChange = (e) => {
    const value = e.target.value;
    handleInputChange(e);
    checkUsernameAvailability(value);
  };

  // Validation function
  const validateForm = (data) => {
    const errors = {};

    if (!data.employeeId) {
      errors.employeeId = 'Please select an employee';
    }

    // Username validation
    if (!data.username?.trim()) {
      errors.username = 'Username is required';
    } else if (data.username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    } else if (data.username.length > 30) {
      errors.username = 'Username must be 30 characters or less';
    } else if (!/^[a-zA-Z0-9_]+$/.test(data.username)) {
      errors.username = 'Username can only contain letters, numbers, and underscores';
    } else if (modalMode === 'create' && usernameStatus.available === false) {
      errors.username = 'Username is already taken';
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
      username: user.username || '',
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
        username: data.username.trim().toLowerCase(),
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        role: data.role,
        status: data.status,
        businessId: user?.businessId // Inherit businessId from current owner
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

  // Expose openCreate to parent via ref
  React.useEffect(() => {
    if (onOpenCreateRef) {
      onOpenCreateRef.current = openCreate;
    }
  }, [onOpenCreateRef, openCreate]);

  // Handle employee selection - auto-fill name and generate username suggestion
  const handleEmployeeSelect = (e) => {
    const empId = e.target.value;
    setFieldValue('employeeId', empId);

    if (empId) {
      const emp = employees.find(e => e._id === empId);
      if (emp) {
        const suggestedUsername = generateUsername(emp.firstName, emp.lastName);
        setFormData(prev => ({
          ...prev,
          employeeId: empId,
          firstName: emp.firstName || '',
          lastName: emp.lastName || '',
          username: suggestedUsername
        }));
        // Check if suggested username is available
        checkUsernameAvailability(suggestedUsername);
      }
    }
  };

  // Custom submit handler for Supabase integration
  const handleCreateAccount = async () => {
    // Validate form first
    const validation = validateForm(formData);
    if (!validation.isValid) {
      return;
    }

    // Check if username is still being checked or is taken
    if (usernameStatus.checking) {
      showToast('Please wait for username check to complete', 'warning');
      return;
    }

    if (usernameStatus.available === false) {
      showToast('Username is already taken. Please choose a different one.', 'error');
      return;
    }

    // Get the selected employee's email for Supabase auth
    const selectedEmployee = employees.find(e => e._id === formData.employeeId);
    if (!selectedEmployee) {
      showToast('Please select an employee', 'error');
      return;
    }

    // Check if employee has email (required for Supabase auth)
    const employeeEmail = selectedEmployee.email;
    if (!employeeEmail) {
      showToast('Selected employee must have an email address for account creation', 'error');
      return;
    }

    // Check Supabase availability
    if (!isSupabaseConfigured()) {
      showToast('Account creation requires internet connection', 'error');
      return;
    }

    setIsCreatingSupabase(true);

    try {
      console.log('[EmployeeAccounts] Creating account for:', formData.username);

      // Create account via Supabase auth service with timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Please try again.')), 30000)
      );

      const createPromise = authService.createStaffAccount({
        username: formData.username.trim().toLowerCase(),
        password: formData.password,
        email: employeeEmail.toLowerCase(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        role: formData.role,
        employeeId: formData.employeeId,
        businessId: user?.businessId || 'default'
      });

      const result = await Promise.race([createPromise, timeoutPromise]);

      console.log('[EmployeeAccounts] Account created:', result);

      // Also save to local Dexie for offline access
      await db.users.put({
        _id: result.user._id,
        email: employeeEmail.toLowerCase(),
        username: formData.username.trim().toLowerCase(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        role: formData.role,
        employeeId: formData.employeeId,
        businessId: user?.businessId || 'default',
        status: 'active',
        password: formData.password // Store for offline login
      });

      showToast('Account created successfully!', 'success');
      setUsernameStatus({ checking: false, available: null, message: '' }); // Reset username status
      closeModal();
      loadUsers();
      if (onDataChange) onDataChange();
    } catch (error) {
      console.error('[EmployeeAccounts] Failed to create account:', error);

      // Provide more specific error messages
      let errorMessage = error.message || 'Failed to create account';

      if (errorMessage.includes('duplicate') || errorMessage.includes('already exists')) {
        errorMessage = 'An account with this email or username already exists';
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (errorMessage.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.';
      }

      showToast(errorMessage, 'error');
    } finally {
      setIsCreatingSupabase(false);
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
        u.username?.toLowerCase().includes(term)
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


      {/* Filters */}
      <FilterBar
        searchPlaceholder="Search by name or username..."
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
                <p className="account-username">@{account.username}</p>
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
        onSubmit={modalMode === 'create' ? handleCreateAccount : handleSubmit}
        isSubmitting={isSubmitting || isCreatingSupabase}
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
            autoComplete="off"
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
          <label>Username *</label>
          <div className="username-input-wrapper">
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleUsernameChange}
              className={`form-control ${formErrors.username ? 'error' : ''} ${usernameStatus.available === true ? 'success' : ''} ${usernameStatus.available === false ? 'error' : ''}`}
              placeholder="john_doe"
              required
              autoComplete="off"
              disabled={modalMode === 'edit'}
            />
            {modalMode === 'create' && usernameStatus.checking && (
              <span className="username-status checking">⏳</span>
            )}
            {modalMode === 'create' && usernameStatus.available === true && (
              <span className="username-status available">✓</span>
            )}
            {modalMode === 'create' && usernameStatus.available === false && (
              <span className="username-status taken">✗</span>
            )}
          </div>
          <small className={`form-hint ${usernameStatus.available === false ? 'error' : ''} ${usernameStatus.available === true ? 'success' : ''}`}>
            {usernameStatus.message || 'Letters, numbers, and underscores only. This will be used to log in.'}
          </small>
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
              autoComplete="new-password"
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
              autoComplete="new-password"
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
          background: var(--primary);
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

        .account-username {
          font-size: 0.9rem;
          color: var(--text-secondary);
          margin: 0 0 var(--spacing-xs) 0;
          font-family: monospace;
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

        .form-hint.error {
          color: var(--error);
        }

        .form-hint.success {
          color: var(--success);
        }

        .username-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .username-input-wrapper input {
          padding-right: 35px;
        }

        .username-status {
          position: absolute;
          right: 10px;
          font-size: 1rem;
        }

        .username-status.checking {
          animation: pulse 1s infinite;
        }

        .username-status.available {
          color: var(--success);
        }

        .username-status.taken {
          color: var(--error);
        }

        .form-control.success {
          border-color: var(--success);
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
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
