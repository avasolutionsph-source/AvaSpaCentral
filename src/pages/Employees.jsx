import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi/mockApi';

const Employees = () => {
  const { showToast, canEdit, isManager } = useApp();

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    position: '',
    department: '',
    role: 'employee',
    commission: { type: 'percentage', value: '' },
    hourlyRate: '',
    hireDate: '',
    skills: []
  });

  const departments = ['Massage', 'Facial', 'Body Treatment', 'Nails', 'Reception', 'Management', 'Housekeeping'];
  const roles = ['employee', 'manager', 'owner'];
  const positions = ['Massage Therapist', 'Facial Specialist', 'Body Treatment Specialist', 'Nail Technician', 'Receptionist', 'Manager', 'Supervisor', 'Housekeeper'];
  const skillsList = ['Swedish Massage', 'Deep Tissue', 'Hot Stone', 'Aromatherapy', 'Facial Treatment', 'Body Scrub', 'Manicure', 'Pedicure', 'Nail Art', 'Waxing'];

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    filterEmployeesList();
  }, [employees, searchTerm, filterDepartment, filterRole, filterStatus]);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const data = await mockApi.employees.getEmployees();
      setEmployees(data);
      setLoading(false);
    } catch (error) {
      showToast('Failed to load employees', 'error');
      setLoading(false);
    }
  };

  const filterEmployeesList = () => {
    let filtered = [...employees];

    if (searchTerm.trim()) {
      filtered = filtered.filter(e =>
        e.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.position.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterDepartment !== 'all') filtered = filtered.filter(e => e.department === filterDepartment);
    if (filterRole !== 'all') filtered = filtered.filter(e => e.role === filterRole);
    if (filterStatus !== 'all') {
      const isActive = filterStatus === 'active';
      filtered = filtered.filter(e => e.active === isActive);
    }

    setFilteredEmployees(filtered);
  };

  const openCreateModal = () => {
    setModalMode('create');
    setFormData({
      firstName: '', lastName: '', email: '', phone: '', position: '', department: '',
      role: 'employee', commission: { type: 'percentage', value: '' }, hourlyRate: '',
      hireDate: '', skills: []
    });
    setShowModal(true);
  };

  const openEditModal = (employee) => {
    setModalMode('edit');
    setSelectedEmployee(employee);
    setFormData({
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      phone: employee.phone,
      position: employee.position,
      department: employee.department,
      role: employee.role,
      commission: { type: employee.commission.type, value: employee.commission.value.toString() },
      hourlyRate: employee.hourlyRate?.toString() || '',
      hireDate: employee.hireDate || '',
      skills: employee.skills || []
    });
    setShowModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('commission.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({ ...prev, commission: { ...prev.commission, [field]: value } }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSkillToggle = (skill) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill]
    }));
  };

  const validateForm = () => {
    if (!formData.firstName.trim()) { showToast('First name is required', 'error'); return false; }
    if (!formData.lastName.trim()) { showToast('Last name is required', 'error'); return false; }
    if (!formData.email.trim()) { showToast('Email is required', 'error'); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) { showToast('Invalid email format', 'error'); return false; }
    if (!formData.phone.trim()) { showToast('Phone is required', 'error'); return false; }
    if (!formData.position) { showToast('Position is required', 'error'); return false; }
    if (!formData.department) { showToast('Department is required', 'error'); return false; }
    if (!formData.commission.value || parseFloat(formData.commission.value) < 0) {
      showToast('Valid commission is required', 'error'); return false;
    }
    if (!formData.hourlyRate || parseFloat(formData.hourlyRate) < 0) {
      showToast('Valid hourly rate is required', 'error'); return false;
    }
    if (!formData.hireDate) { showToast('Hire date is required', 'error'); return false; }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const employeeData = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        position: formData.position,
        department: formData.department,
        role: formData.role,
        commission: { type: formData.commission.type, value: parseFloat(formData.commission.value) },
        hourlyRate: parseFloat(formData.hourlyRate),
        hireDate: formData.hireDate,
        skills: formData.skills
      };

      if (modalMode === 'create') {
        await mockApi.employees.createEmployee(employeeData);
        showToast('Employee created!', 'success');
      } else {
        await mockApi.employees.updateEmployee(selectedEmployee._id, employeeData);
        showToast('Employee updated!', 'success');
      }
      setShowModal(false);
      loadEmployees();
    } catch (error) {
      showToast('Failed to save employee', 'error');
    }
  };

  const handleToggleStatus = async (employee) => {
    try {
      await mockApi.employees.toggleStatus(employee._id);
      showToast(`Employee ${employee.active ? 'deactivated' : 'activated'}`, 'success');
      loadEmployees();
    } catch (error) {
      showToast('Failed to update status', 'error');
    }
  };

  const handleDelete = async (employee) => {
    if (!window.confirm(`Delete "${employee.firstName} ${employee.lastName}"?`)) return;
    try {
      await mockApi.employees.deleteEmployee(employee._id);
      showToast('Employee deleted', 'success');
      loadEmployees();
    } catch (error) {
      showToast('Failed to delete', 'error');
    }
  };

  if (loading) {
    return <div className="page-loading"><div className="spinner"></div><p>Loading employees...</p></div>;
  }

  return (
    <div className="employees-page">
      <div className="page-header">
        <div>
          <h1>Employee Management</h1>
          <p>{canEdit() ? 'Manage your team members and their information' : 'View team members and their information'}</p>
        </div>
        {canEdit() && (
          <button className="btn btn-primary" onClick={openCreateModal}>+ Add Employee</button>
        )}
      </div>

      <div className="filters-section">
        <div className="search-box">
          <input type="text" placeholder="Search employees..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
        </div>
        <div className="filters-row">
          <select value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)} className="filter-select">
            <option value="all">All Departments</option>
            {departments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
          </select>
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="filter-select">
            <option value="all">All Roles</option>
            {roles.map(role => <option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="filter-select">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <div className="view-toggle">
            <button className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('cards')}>Cards</button>
            <button className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('table')}>Table</button>
          </div>
          <div className="results-count">{filteredEmployees.length} employees</div>
        </div>
      </div>

      {filteredEmployees.length === 0 ? (
        <div className="empty-state">
          <p>No employees found</p>
          {canEdit() && (
            <button className="btn btn-primary" onClick={openCreateModal}>Add Your First Employee</button>
          )}
        </div>
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
                      <span className="value">{employee.commission.value}{employee.commission.type === 'percentage' ? '%' : ' PHP'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Hourly Rate:</span>
                      <span className="value">₱{employee.hourlyRate?.toLocaleString() || 0}</span>
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
                  <button className="btn btn-sm btn-secondary" onClick={() => openEditModal(employee)}>Edit</button>
                  <button className={`btn btn-sm ${employee.active ? 'btn-warning' : 'btn-success'}`}
                    onClick={() => handleToggleStatus(employee)}>{employee.active ? 'Deactivate' : 'Activate'}</button>
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
                <tr key={employee._id} className={!employee.active ? 'inactive-row' : ''}>
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
                    <span className={`status-badge ${employee.active ? 'status-active' : 'status-inactive'}`}>
                      {employee.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {canEdit() && (
                    <td className="actions-cell">
                      <button className="btn btn-xs btn-secondary" onClick={() => openEditModal(employee)}>Edit</button>
                      <button className={`btn btn-xs ${employee.active ? 'btn-warning' : 'btn-success'}`}
                        onClick={() => handleToggleStatus(employee)}>{employee.active ? 'Deactivate' : 'Activate'}</button>
                      <button className="btn btn-xs btn-error" onClick={() => handleDelete(employee)}>Delete</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal employee-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === 'create' ? 'Add Employee' : 'Edit Employee'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>First Name *</label>
                    <input type="text" name="firstName" value={formData.firstName} onChange={handleInputChange}
                      placeholder="Enter first name" className="form-control" required />
                  </div>
                  <div className="form-group">
                    <label>Last Name *</label>
                    <input type="text" name="lastName" value={formData.lastName} onChange={handleInputChange}
                      placeholder="Enter last name" className="form-control" required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Email *</label>
                    <input type="email" name="email" value={formData.email} onChange={handleInputChange}
                      placeholder="email@example.com" className="form-control" required />
                  </div>
                  <div className="form-group">
                    <label>Phone *</label>
                    <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange}
                      placeholder="+63 912 345 6789" className="form-control" required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Position *</label>
                    <select name="position" value={formData.position} onChange={handleInputChange} className="form-control" required>
                      <option value="">Select position...</option>
                      {positions.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Department *</label>
                    <select name="department" value={formData.department} onChange={handleInputChange} className="form-control" required>
                      <option value="">Select department...</option>
                      {departments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Role *</label>
                  <select name="role" value={formData.role} onChange={handleInputChange} className="form-control" required>
                    {roles.map(role => <option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Hourly Rate (₱) *</label>
                    <input type="number" name="hourlyRate" value={formData.hourlyRate} onChange={handleInputChange}
                      placeholder="0.00" className="form-control" min="0" step="0.01" required />
                  </div>
                  <div className="form-group">
                    <label>Hire Date *</label>
                    <input type="date" name="hireDate" value={formData.hireDate} onChange={handleInputChange}
                      className="form-control" required />
                  </div>
                </div>
                <div className="form-group">
                  <label>Commission *</label>
                  <div className="commission-group">
                    <select name="commission.type" value={formData.commission.type} onChange={handleInputChange}
                      className="form-control commission-type">
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed (₱)</option>
                    </select>
                    <input type="number" name="commission.value" value={formData.commission.value} onChange={handleInputChange}
                      placeholder="0" className="form-control commission-value" min="0"
                      step={formData.commission.type === 'percentage' ? '1' : '0.01'} required />
                  </div>
                </div>
                <div className="form-group">
                  <label>Skills</label>
                  <div className="skills-selector">
                    {skillsList.map(skill => (
                      <label key={skill} className="skill-checkbox">
                        <input type="checkbox" checked={formData.skills.includes(skill)}
                          onChange={() => handleSkillToggle(skill)} />
                        <span>{skill}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{modalMode === 'create' ? 'Create' : 'Update'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Employees;
