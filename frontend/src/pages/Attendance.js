import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { attendanceAPI, userAPI } from '../services/api';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import './Attendance.css';

const Attendance = () => {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState([]);
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [showDateRange, setShowDateRange] = useState(false); // Add this missing state
  const [filters, setFilters] = useState({
    user_id: '',
    start_date: '',
    end_date: '',
    month: (new Date().getMonth() + 1).toString(),
    year: new Date().getFullYear().toString()
  });
  const [formData, setFormData] = useState({
    user_ids: [],
    date: new Date().toISOString().split('T')[0],
    login_time: '',
    logout_time: '',
    status: 'present'
  });
  const [selectAll, setSelectAll] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchHistory();
    if (user.role === 'sysadmin' || user.role === 'admin') {
      fetchUsers();
    }
  }, [filters]); // Add filters as dependency to auto-fetch on change

  const fetchUsers = async () => {
    try {
      const { data } = await userAPI.getAll();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const params = {};
      if (filters.user_id) params.user_id = filters.user_id;

      // If month filter is selected, use it; otherwise use date range
      if (filters.month && filters.year) {
        const year = parseInt(filters.year);
        const month = parseInt(filters.month);
        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0);

        params.start_date = firstDay.toISOString().split('T')[0];
        params.end_date = lastDay.toISOString().split('T')[0];
      } else {
        if (filters.start_date) params.start_date = filters.start_date;
        if (filters.end_date) params.end_date = filters.end_date;
      }

      const { data } = await attendanceAPI.getHistory(params);
      setAttendance(data);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  const handleLogin = async () => {
    try {
      await attendanceAPI.login();
      toast.success('Login marked successfully');
      fetchHistory();
    } catch (error) {
      toast.error('Failed to mark login');
    }
  };

  const handleLogout = async () => {
    try {
      await attendanceAPI.logout();
      toast.success('Logout marked successfully');
      fetchHistory();
    } catch (error) {
      toast.error('Failed to mark logout');
    }
  };

  const handleSelectAll = (checked) => {
    setSelectAll(checked);
    if (checked) {
      setFormData({...formData, user_ids: users.map(u => u.id)});
    } else {
      setFormData({...formData, user_ids: []});
    }
  };

  const handleUserToggle = (userId) => {
    const newUserIds = formData.user_ids.includes(userId)
      ? formData.user_ids.filter(id => id !== userId)
      : [...formData.user_ids, userId];
    
    setFormData({...formData, user_ids: newUserIds});
    setSelectAll(newUserIds.length === users.length);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.user_ids.length === 0) {
      toast.error('Please select at least one employee');
      return;
    }

    setIsSubmitting(true);

    try {
      // Mark attendance for each selected user
      const promises = formData.user_ids.map(userId =>
        attendanceAPI.mark({
          user_id: userId,
          date: formData.date,
          login_time: formData.login_time,
          logout_time: formData.logout_time,
          status: formData.status
        })
      );

      await Promise.all(promises);
      
      toast.success(`Attendance marked for ${formData.user_ids.length} employee(s)`);
      setShowModal(false);
      setFormData({
        user_ids: [],
        date: new Date().toISOString().split('T')[0],
        login_time: '',
        logout_time: '',
        status: 'present'
      });
      setSelectAll(false);
      fetchHistory();
    } catch (error) {
      toast.error('Failed to mark attendance');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this attendance record?')) {
      try {
        await attendanceAPI.delete(id);
        toast.success('Attendance deleted successfully');
        fetchHistory();
      } catch (error) {
        toast.error('Failed to delete attendance');
      }
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      toast.error('Please select a file');
      return;
    }

    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const response = await fetch('http://localhost:5000/api/attendance/upload-excel', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(`Upload complete: ${result.successCount} records processed, ${result.errorCount} errors`);
        if (result.errors && result.errors.length > 0) {
          console.log('Upload errors:', result.errors);
        }
        setShowUploadModal(false);
        setUploadFile(null);
        fetchHistory();
      } else {
        toast.error(result.message || 'Upload failed');
      }
    } catch (error) {
      toast.error('Failed to upload file');
      console.error('Upload error:', error);
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      { email: 'user@example.com', username: 'user1', date: '2024-12-01', login_time: '09:00', logout_time: '18:00', status: 'present' },
      { email: 'user@example.com', username: 'user1', date: '2024-12-02', login_time: '09:15', logout_time: '17:45', status: 'present' },
      { email: 'user@example.com', username: 'user1', date: '2024-12-03', login_time: '09:30', logout_time: '18:30', status: 'present' },
      { email: 'user@example.com', username: 'user1', date: '2024-12-04', login_time: '09:00', logout_time: '18:00', status: 'present' },
      { email: 'user@example.com', username: 'user1', date: '2024-12-05', login_time: '', logout_time: '', status: 'absent' },
      { email: 'user@example.com', username: 'user1', date: '2024-12-06', login_time: '10:00', logout_time: '16:00', status: 'half-day' }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [
      { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    XLSX.writeFile(wb, 'attendance_template.xlsx');
  };

  return (
    <div className="attendance">
      <div className="header">
        <h1>Attendance Management</h1>
        <div className="header-buttons">
          {user.role === 'user' && (
            <>
              <button onClick={handleLogin} className="btn-primary">Login</button>
              <button onClick={handleLogout} className="btn-secondary">Logout</button>
            </>
          )}
          {(user.role === 'sysadmin' || user.role === 'admin') && (
            <>
              <button onClick={() => setShowUploadModal(true)} className="btn-upload">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                Upload Excel
              </button>
              <button onClick={() => setShowModal(true)} className="btn-primary">Mark Attendance</button>
            </>
          )}
        </div>
      </div>

      <div className="attendance-history">
        <div className="history-header">
          <div className="inline-filters">
            {(user.role === 'sysadmin' || user.role === 'admin') && (
              <select value={filters.user_id} onChange={(e) => setFilters({...filters, user_id: e.target.value})}>
                <option value="">All Users</option>
                {users.map(u => (<option key={u.id} value={u.id}>{u.full_name}</option>))}
              </select>
            )}
            
            <select value={filters.month} onChange={(e) => setFilters({...filters, month: e.target.value, start_date: '', end_date: ''})}>
              <option value="">Select Month</option>
              <option value="1">January</option>
              <option value="2">February</option>
              <option value="3">March</option>
              <option value="4">April</option>
              <option value="5">May</option>
              <option value="6">June</option>
              <option value="7">July</option>
              <option value="8">August</option>
              <option value="9">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>

            <button 
              className="btn-calendar" 
              onClick={() => setShowDateRange(!showDateRange)}
              title="Filter by date range"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </button>

            {showDateRange && (
              <div className="date-range-inputs">
                <input 
                  type="date" 
                  value={filters.start_date} 
                  onChange={(e) => setFilters({...filters, start_date: e.target.value, month: ''})} 
                />
                <span>to</span>
                <input 
                  type="date" 
                  value={filters.end_date} 
                  onChange={(e) => setFilters({...filters, end_date: e.target.value, month: ''})} 
                />
              </div>
            )}

            <button 
              onClick={() => {
                setShowDateRange(false);
                setFilters({user_id: '', start_date: '', end_date: '', month: (new Date().getMonth() + 1).toString(), year: new Date().getFullYear().toString()});
              }} 
              className="btn-clear-small"
              title="Clear filters"
            >
              Clear
            </button>
          </div>
        </div>

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
              const workingHours = loginTime && logoutTime ? ((logoutTime - loginTime) / (1000 * 60 * 60)).toFixed(2) : '-';

              return (
                <tr key={record.id}>
                  <td>{new Date(record.date).toLocaleDateString()}</td>
                  {(user.role === 'sysadmin' || user.role === 'admin') && <td>{record.user_name}</td>}
                  <td>{loginTime ? loginTime.toLocaleTimeString() : '-'}</td>
                  <td>{logoutTime ? logoutTime.toLocaleTimeString() : '-'}</td>
                  <td>{workingHours} hrs</td>
                  <td><span className={`status-badge status-${record.status}`}>{record.status}</span></td>
                  {user.role === 'sysadmin' && (
                    <td>
                      <button onClick={() => handleDelete(record.id)} className="btn-danger" title="Delete">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
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
          <div className="modal-content modal-large">
            <h2>Mark Attendance</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Select Employees</label>
                <div className="employee-selection">
                  <div className="select-all-option">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                      <span className="checkbox-text">Select All ({users.length})</span>
                    </label>
                  </div>
                  <div className="employee-list">
                    {users.map(u => (
                      <label key={u.id} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={formData.user_ids.includes(u.id)}
                          onChange={() => handleUserToggle(u.id)}
                        />
                        <span className="checkbox-text">{u.full_name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Login Time</label>
                  <input
                    type="time"
                    value={formData.login_time}
                    onChange={(e) => setFormData({ ...formData, login_time: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Logout Time</label>
                  <input
                    type="time"
                    value={formData.logout_time}
                    onChange={(e) => setFormData({ ...formData, logout_time: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="half-day">Half Day</option>
                </select>
              </div>
              
              <div className="modal-actions">
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <span className="spinner"></span>
                      Processing...
                    </>
                  ) : (
                    `Mark Attendance (${formData.user_ids.length} selected)`
                  )}
                </button>
                <button type="button" onClick={() => {
                  setShowModal(false);
                  setSelectAll(false);
                  setFormData({
                    user_ids: [],
                    date: new Date().toISOString().split('T')[0],
                    login_time: '',
                    logout_time: '',
                    status: 'present'
                  });
                }} className="btn-secondary" disabled={isSubmitting}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="modal">
          <div className="modal-content">
            <h2>Upload Attendance Excel File</h2>
            <form onSubmit={handleFileUpload}>
              <div className="upload-info">
                <p>Upload an Excel file (.xlsx) with the following columns:</p>
                <ul>
                  <li><strong>email</strong> or <strong>username</strong> - Employee identifier</li>
                  <li><strong>date</strong> - Format: YYYY-MM-DD (e.g., 2024-01-15)</li>
                  <li><strong>login_time</strong> - Format: HH:MM (e.g., 09:00)</li>
                  <li><strong>logout_time</strong> - Format: HH:MM (e.g., 18:00)</li>
                  <li><strong>status</strong> - present/absent (optional, default: present)</li>
                </ul>
                <button type="button" onClick={downloadTemplate} className="btn-template">
                  Download Template
                </button>
              </div>
              <div className="form-group">
                <label>Select Excel File</label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  required
                />
                {uploadFile && (
                  <p className="file-name">Selected: {uploadFile.name}</p>
                )}
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn-primary">Upload</button>
                <button type="button" onClick={() => { setShowUploadModal(false); setUploadFile(null); }} className="btn-secondary">
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
