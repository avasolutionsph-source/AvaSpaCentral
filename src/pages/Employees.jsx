import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { useCrudOperations } from '../hooks';
import { CrudModal, FilterBar, PageHeader, ConfirmDialog, EmptyState } from '../components/shared';
import storageService from '../services/storage';

// Constants - 4 positions that map directly to roles
const POSITIONS = [
  { value: 'Owner', label: 'Owner', role: 'Owner', department: 'Management' },
  { value: 'Manager', label: 'Manager', role: 'Manager', department: 'Management' },
  { value: 'Therapist', label: 'Therapist', role: 'Therapist', department: 'Services' },
  { value: 'Receptionist', label: 'Receptionist', role: 'Receptionist', department: 'Front Desk' },
  { value: 'Rider', label: 'Rider', role: 'Rider', department: 'Operations' },
  { value: 'Utility', label: 'Utility', role: 'Utility', department: 'Operations' }
];
const DEPARTMENTS = ['Management', 'Services', 'Front Desk', 'Operations'];
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
  gender: '',
  skills: [],
  branchId: '',
  photoUrl: '',
  _photoFile: null
};

const Employees = ({ embedded = false, onDataChange, onOpenCreateRef }) => {
  const { showToast, canEdit, canManageEmployees, isManager, getUserBranchId, getEffectiveBranchId, user } = useApp();

  // Ref to hold current employees list for duplicate-email check inside validateEmployee
  const employeesRef = useRef([]);

  // Branches for assignment dropdown (Owner/Manager only)
  const [branchesList, setBranchesList] = useState([]);
  useEffect(() => {
    const loadBranches = async () => {
      if (getUserBranchId()) return; // Branch Owner doesn't need dropdown
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !user?.businessId) return;
        const res = await fetch(
          `${supabaseUrl}/rest/v1/branches?business_id=eq.${user.businessId}&is_active=eq.true&order=display_order.asc,name.asc`,
          { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' } }
        );
        if (res.ok) setBranchesList(await res.json());
      } catch (err) { console.error('Failed to load branches:', err); }
    };
    loadBranches();
  }, [user?.businessId]);

  // Service count tracking
  const [serviceCounts, setServiceCounts] = useState({});
  const [serviceFilter, setServiceFilter] = useState('all');

  useEffect(() => {
    const loadServiceCounts = async () => {
      try {
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        let transactions;
        if (serviceFilter === 'today') {
          transactions = await storageService.transactions.getByDate(todayStr);
        } else if (serviceFilter === 'week') {
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          const weekStr = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, '0')}-${String(weekAgo.getDate()).padStart(2, '0')}`;
          transactions = await storageService.transactions.getByDateRange(weekStr, todayStr);
        } else if (serviceFilter === 'month') {
          const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
          transactions = await storageService.transactions.getByDateRange(monthStart, todayStr);
        } else {
          transactions = await storageService.transactions.getAll();
        }

        const completed = (transactions || []).filter(t => t.status === 'completed');
        const counts = {};
        completed.forEach(t => {
          const empId = t.employeeId || t.employee?.id;
          if (empId) counts[empId] = (counts[empId] || 0) + 1;
        });
        setServiceCounts(counts);
      } catch (err) {
        console.warn('Failed to load service counts:', err);
      }
    };
    loadServiceCounts();
  }, [serviceFilter]);

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
    // Check for duplicate email (exclude self when editing)
    const emailLower = data.email.trim().toLowerCase();
    const duplicate = employeesRef.current.find(
      e => e.email?.toLowerCase() === emailLower && e._id !== data._id
    );
    if (duplicate) {
      showToast(`Email is already used by ${duplicate.firstName} ${duplicate.lastName}`, 'error');
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
      _id: employee._id, // for duplicate email exclusion during edit
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
      gender: employee.gender || '',
      skills: employee.skills || [],
      branchId: employee.branchId || '',
      photoUrl: employee.photoUrl || '',
      _photoFile: null
    };
  }, []);

  // Transform for submit
  const transformForSubmit = useCallback((data) => {
    const hourlyRate = parseFloat(data.hourlyRate) || 0;
    const monthlyRate = parseFloat(data.monthlyRate) || 0;
    // Branch Owner: auto-assign their branch. Owner/Manager: use selected branch from form.
    const branchId = getUserBranchId() || data.branchId || null;
    return {
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: data.email.trim(),
      phone: data.phone.trim(),
      position: data.position,
      department: data.department,
      role: data.role,
      commission: { type: data.commission.type, value: parseFloat(data.commission.value) || 0 },
      hourlyRate: hourlyRate,
      monthlyRate: monthlyRate,
      rateType: data.rateType,
      hireDate: data.hireDate,
      gender: data.gender || null,
      skills: data.skills,
      ...(branchId && { branchId }),
      ...(data.photoUrl && { photoUrl: data.photoUrl })
    };
  }, [getUserBranchId]);

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

  // Photo upload handler
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const handleSubmitWithPhoto = async () => {
    if (formData._photoFile) {
      try {
        setUploadingPhoto(true);
        const { supabase } = await import('../services/supabase/supabaseClient');
        if (!supabase) throw new Error('Supabase not configured');
        const file = formData._photoFile;
        const ext = file.name.split('.').pop().toLowerCase();
        const safeName = `${formData.firstName}-${formData.lastName}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const path = `${user.businessId}/employees/${safeName}-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from('branding').upload(path, file, { upsert: true, contentType: file.type });
        if (error) throw error;
        const { data } = supabase.storage.from('branding').getPublicUrl(path);
        const photoUrl = `${data.publicUrl}?t=${Date.now()}`;
        formData.photoUrl = photoUrl;
        setFormData(prev => ({ ...prev, photoUrl, _photoFile: null }));
      } catch (err) {
        showToast('Failed to upload photo: ' + err.message, 'error');
        setUploadingPhoto(false);
        return;
      }
      setUploadingPhoto(false);
    }
    handleSubmit();
  };

  // Keep employeesRef in sync for duplicate email validation
  useEffect(() => {
    employeesRef.current = employees;
  }, [employees]);

  // Expose openCreate to parent via ref
  React.useEffect(() => {
    if (onOpenCreateRef) {
      onOpenCreateRef.current = openCreate;
    }
  }, [onOpenCreateRef, openCreate]);

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

    // Filter by branch - only show employees from the current branch
    const effectiveBranchId = getEffectiveBranchId();
    if (effectiveBranchId) {
      filtered = filtered.filter(e => e.branchId === effectiveBranchId);
    }

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
      filtered = filtered.filter(e => e.status === filterStatus);
    }

    return filtered;
  }, [employees, searchTerm, filterDepartment, filterRole, filterStatus, getEffectiveBranchId]);

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
          description={canManageEmployees() ? 'Manage your team members and their information' : 'View team members and their information'}
          action={canManageEmployees() ? { label: '+ Add Employee', onClick: openCreate } : null}
        />
      )}


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

      <div className="service-filter-bar">
        <span className="service-filter-label">Services:</span>
        {[
          { key: 'today', label: 'Today' },
          { key: 'week', label: 'This Week' },
          { key: 'month', label: 'This Month' },
          { key: 'all', label: 'All Time' }
        ].map(f => (
          <button
            key={f.key}
            className={`service-filter-btn ${serviceFilter === f.key ? 'active' : ''}`}
            onClick={() => setServiceFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filteredEmployees.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No employees found"
          description={searchTerm || filterDepartment !== 'all' || filterRole !== 'all' || filterStatus !== 'all'
            ? 'Try adjusting your filters or search term'
            : 'Add your first team member to get started'
          }
          action={canManageEmployees() && !searchTerm ? { label: 'Add Your First Employee', onClick: openCreate } : null}
        />
      ) : viewMode === 'cards' ? (
        <div className="employees-grid">
          {filteredEmployees.map(employee => (
            <div key={employee._id} className={`employee-card ${employee.status !== 'active' ? 'inactive' : ''}`}>
              <div className="employee-header">
                <div className="employee-avatar">
                  {employee.firstName?.charAt(0)}{employee.lastName?.charAt(0)}
                </div>
                <div className="employee-status-badge">
                  {employee.status === 'active' ? '✓ Active' : '✕ Inactive'}
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
                <div className="employee-service-count">
                  <span className="service-count-number">{serviceCounts[employee._id] || 0}</span>
                  <span className="service-count-label">services ({serviceFilter === 'today' ? 'today' : serviceFilter === 'week' ? 'this week' : serviceFilter === 'month' ? 'this month' : 'all time'})</span>
                </div>
              </div>
              {canManageEmployees() && (
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
                {canManageEmployees() && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map(employee => (
                <tr key={employee._id} className={employee.status !== 'active' ? 'inactive-row' : ''}>
                  <td className="employee-name-cell">
                    <div className="table-avatar">
                      {employee.firstName?.charAt(0)}{employee.lastName?.charAt(0)}
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
                  {canManageEmployees() && (
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
        onSubmit={handleSubmitWithPhoto}
        isSubmitting={isSubmitting || uploadingPhoto}
        size="large"
      >
        {/* Employee Photo */}
        <div className="form-group">
          <label>Employee Photo</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            {(formData.photoUrl || formData._photoFile) ? (
              <div style={{ position: 'relative' }}>
                <img
                  src={formData._photoFile ? URL.createObjectURL(formData._photoFile) : formData.photoUrl}
                  alt="Preview"
                  style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '50%', border: '2px solid #e5e7eb' }}
                />
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, photoUrl: '', _photoFile: null }))}
                  style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >✕</button>
              </div>
            ) : (
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#f3f4f6', border: '2px dashed #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '0.7rem' }}>
                No photo
              </div>
            )}
            <label style={{ cursor: 'pointer', padding: '0.4rem 0.8rem', background: '#f3f4f6', borderRadius: '6px', fontSize: '0.8rem', color: '#333', border: '1px solid #d1d5db' }}>
              {formData.photoUrl || formData._photoFile ? 'Change' : 'Upload'}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    if (file.size > 5 * 1024 * 1024) { showToast('Image must be less than 5MB', 'error'); return; }
                    setFormData(prev => ({ ...prev, _photoFile: file }));
                  }
                }}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>

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

        <div className="form-row">
          {/* Branch Assignment — Owner/Manager only (Branch Owner auto-assigns) */}
          {!getUserBranchId() && branchesList.length > 0 && (
            <div className="form-group">
              <label>Assign to Branch *</label>
              <select
                name="branchId"
                value={formData.branchId}
                onChange={handleFieldChange}
                className="form-control"
              >
                <option value="">Select branch...</option>
                {branchesList.map(b => (
                  <option key={b.id} value={b.id}>{b.name}{b.city ? ` — ${b.city}` : ''}</option>
                ))}
              </select>
            </div>
          )}
          <div className="form-group">
            <label>Gender</label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleFieldChange}
              className="form-control"
            >
              <option value="">Select...</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
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
