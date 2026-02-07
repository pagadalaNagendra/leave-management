import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { attendanceAPI, userAPI } from '../services/api';
import { toast } from 'react-toastify';
import './Attendance.css';

const Attendance = () => {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState([]);
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [filters, setFilters] = useState({
    user_id: '',
    start_date: '',
    end_date: ''
  });
  const [formData, setFormData] = useState({
    user_id: '',
    date: new Date().toISOString().split('T')[0],
    login_time: '',
    logout_time: '',
    status: 'present'
  });

  useEffect(() => {
    fetchAttendance();
    if (user.role === 'sysadmin' || user.role === 'admin') {
      fetchUsers();
    }
  }, []);

  const fetchUsers = async () => {
    try {
      const { data } = await userAPI.getAll();
      setUsers(data);
    } catch (error) {
      toast.error('Failed to fetch users');
    }
  };

  const fetchAttendance = async () => {
    try {
      const { data } = await attendanceAPI.getHistory(filters);
      setAttendance(data);
    } catch (error) {
      toast.error('Failed to fetch attendance');
    }
  };

  const handleLogin = async () => {
    try {
      await attendanceAPI.login();
      toast.success('Login marked successfully');
      fetchAttendance();
    } catch (error) {
      toast.error('Failed to mark login');
    }
  };

  const handleLogout = async () => {
    try {
      await attendanceAPI.logout();
      toast.success('Logout marked successfully');
      fetchAttendance();
    } catch (error) {
      toast.error('Failed to mark logout');
    }
  };

  const handleManualMark = async (e) => {
    e.preventDefault();
    try {
      await attendanceAPI.mark(formData);
      toast.success('Attendance marked successfully');
      setShowModal(false);
      setFormData({
        user_id: '',
        date: new Date().toISOString().split('T')[0],
        login_time: '',
        logout_time: '',
        status: 'present'
      });
      fetchAttendance();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to mark attendance');
    }
  };

  const handleFilter = () => {
    fetchAttendance();
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this attendance record?')) {
      try {
        await attendanceAPI.delete(id);
        toast.success('Attendance deleted successfully');
        fetchAttendance();
      } catch (error) {
        toast.error('Failed to delete attendance');
      }
    }
  };

  return (
    <div className="attendance">
      <div className="header">
        <h1>Attendance Management</h1>
        <div className="header-actions">
          {user.role === 'user' && (
            <>
              <button onClick={handleLogin} className="btn-login">Mark Login</button>
              <button onClick={handleLogout} className="btn-logout">Mark Logout</button>
            </>
          )}
          {(user.role === 'sysadmin' || user.role === 'admin') && (
            <button onClick={() => setShowModal(true)} className="btn-primary">
              Mark Attendance
            </button>
          )}
        </div>
      </div>

      <div className="filters">
        <h3>Filter Attendance</h3>
        <div className="filter-form">
          {(user.role === 'sysadmin' || user.role === 'admin') && (
            <select
              value={filters.user_id}
              onChange={(e) => setFilters({...filters, user_id: e.target.value})}
            >
              <option value="">All Users</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          )}
          <input
            type="date"
            placeholder="Start Date"
            value={filters.start_date}
            onChange={(e) => setFilters({...filters, start_date: e.target.value})}
          />
          <input
            type="date"
            placeholder="End Date"
            value={filters.end_date}
            onChange={(e) => setFilters({...filters, end_date: e.target.value})}
          />
          <button onClick={handleFilter} className="btn-filter">Apply Filter</button>
        </div>
      </div>

      <div className="attendance-history">
        <h3>Attendance History</h3>
        <table className="attendance-table">
          <thead>
            <tr>
              <th>Date</th>
              {(user.role === 'sysadmin' || user.role === 'admin') && <th>Employee</th>}
              <th>Login Time</th>
              <th>Logout Time</th>
              <th>Working Hours</th>
              <th>Status</th>
              {user.role === 'sysadmin' && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {attendance.map((record) => {
              const loginTime = record.login_time ? new Date(record.login_time) : null;
              const logoutTime = record.logout_time ? new Date(record.logout_time) : null;
              const workingHours = loginTime && logoutTime 
                ? ((logoutTime - loginTime) / (1000 * 60 * 60)).toFixed(2)
                : '-';

              return (
                <tr key={record.id}>
                  <td>{new Date(record.date).toLocaleDateString()}</td>
                  {(user.role === 'sysadmin' || user.role === 'admin') && <td>{record.user_name}</td>}
                  <td>{loginTime ? loginTime.toLocaleTimeString() : '-'}</td>
                  <td>{logoutTime ? logoutTime.toLocaleTimeString() : '-'}</td>
                  <td>{workingHours} hrs</td>
                  <td>
                    <span className={`status-badge status-${record.status}`}>
                      {record.status}
                    </span>
                  </td>
                  {user.role === 'sysadmin' && (
                    <td>
                      <button onClick={() => handleDelete(record.id)} className="btn-danger">
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <h2>Mark Attendance</h2>
            <form onSubmit={handleManualMark}>
              <div className="form-group">
                <label>Employee</label>
                <select
                  value={formData.user_id}
                  onChange={(e) => setFormData({...formData, user_id: e.target.value})}
                  required
                >
                  <option value="">Select Employee</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Login Time</label>
                <input
                  type="time"
                  value={formData.login_time}
                  onChange={(e) => setFormData({...formData, login_time: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Logout Time</label>
                <input
                  type="time"
                  value={formData.logout_time}
                  onChange={(e) => setFormData({...formData, logout_time: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="half-day">Half Day</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn-primary">Mark Attendance</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
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

export default Attendance;
