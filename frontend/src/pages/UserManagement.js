import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../services/api';
import { toast } from 'react-toastify';
import './UserManagement.css';

const UserManagement = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    designation: '',
    role: 'user'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data } = await userAPI.getAll();
      setUsers(data);
    } catch (error) {
      toast.error('Failed to fetch users');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editMode) {
        const updateData = { 
          username: formData.username,
          email: formData.email,
          full_name: formData.full_name,
          designation: formData.designation
        };
        // Include password only if it's provided
        if (formData.password && formData.password.trim() !== '') {
          updateData.password = formData.password;
        }
        await userAPI.update(selectedUserId, updateData);
        toast.success('User updated successfully');
      } else {
        await userAPI.create(formData);
        toast.success('User created successfully! Welcome email sent to ' + formData.email);
      }
      setShowModal(false);
      resetForm();
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || `Failed to ${editMode ? 'update' : 'create'} user`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (userData) => {
    setEditMode(true);
    setSelectedUserId(userData.id);
    setFormData({
      username: userData.username,
      email: userData.email,
      password: '',
      full_name: userData.full_name,
      designation: userData.designation || '',
      role: userData.role_name
    });
    setShowModal(true);
  };

  const handleAddNew = () => {
    setEditMode(false);
    setSelectedUserId(null);
    setFormData({ username: '', email: '', password: '', full_name: '', designation: '', role: 'user' });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await userAPI.delete(id);
        toast.success('User deleted successfully');
        fetchUsers();
      } catch (error) {
        toast.error('Failed to delete user');
      }
    }
  };

  const resetForm = () => {
    setFormData({ username: '', email: '', password: '', full_name: '', designation: '', role: 'user' });
  };

  return (
    <div className="user-management">
      <div className="header">
        <h1>
          User Management
        </h1>
        <button onClick={handleAddNew} className="btn-add-user" title="Add New User">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="8.5" cy="7" r="4"></circle>
            <line x1="20" y1="8" x2="20" y2="14"></line>
            <line x1="23" y1="11" x2="17" y2="11"></line>
          </svg>
          <span>Add User</span>
        </button>
      </div>

      <table className="users-table">
        <thead>
          <tr>
            <th>Full Name</th>
            <th>Email</th>
            <th>Designation</th>
            <th>Role</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.full_name}</td>
              <td>{u.email}</td>
              <td>{u.designation || '-'}</td>
              <td><span className={`role-badge ${u.role_name}`}>{u.role_name}</span></td>
              <td>
                <div className="action-buttons">
                  <button onClick={() => handleEdit(u)} className="btn-edit" title="Edit User">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  {user.role === 'sysadmin' && (
                    <button onClick={() => handleDelete(u.id)} className="btn-danger" title="Delete User">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <h2>{editMode ? 'Edit User' : 'Add New User'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    placeholder="Enter full name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Username</label>
                  <input
                    type="text"
                    placeholder="Enter username"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    placeholder="Enter email address"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Designation</label>
                  <select
                    value={formData.designation}
                    onChange={(e) => setFormData({...formData, designation: e.target.value})}
                    required
                  >
                    <option value="">Select Designation</option>
                    <option value="Research Engineer">Research Engineer</option>
                    <option value="Jr Research Engineer">Jr Research Engineer</option>
                    <option value="Research Intern">Research Intern</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Password {editMode && <span className="optional-text">(Leave blank to keep current)</span>}</label>
                  <input
                    type="password"
                    placeholder={editMode ? "Enter new password (optional)" : "Enter password"}
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    required={!editMode}
                  />
                </div>
                {!editMode && (
                  <div className="form-group">
                    <label>Role</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({...formData, role: e.target.value})}
                    >
                      {user.role === 'sysadmin' && <option value="admin">Admin</option>}
                      <option value="user">User</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <span className="spinner"></span>
                      {editMode ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    editMode ? 'Update User' : 'Add User'
                  )}
                </button>
                <button 
                  type="button" 
                  onClick={() => { setShowModal(false); resetForm(); }} 
                  className="btn-secondary"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
