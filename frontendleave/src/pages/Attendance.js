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
  const [showDateRange, setShowDateRange] = useState(false);
  const [showDateFilter, setShowDateFilter] = useState(false);
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
  const [editMode, setEditMode] = useState(false);
  const [selectedAttendanceId, setSelectedAttendanceId] = useState(null);
  const [showUserFilter, setShowUserFilter] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [selectAllMonths, setSelectAllMonths] = useState(false);

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
      setFormData({ ...formData, user_ids: users.map(u => u.id) });
    } else {
      setFormData({ ...formData, user_ids: [] });
    }
  };

  const handleUserToggle = (userId) => {
    const newUserIds = formData.user_ids.includes(userId)
      ? formData.user_ids.filter(id => id !== userId)
      : [...formData.user_ids, userId];

    setFormData({ ...formData, user_ids: newUserIds });
    setSelectAll(newUserIds.length === users.length);
  };

  const handleEdit = (record) => {
    setEditMode(true);
    setSelectedAttendanceId(record.id);
    setFormData({
      user_ids: [record.user_id],
      date: record.date.split('T')[0],
      login_time: record.login_time ? new Date(record.login_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
      logout_time: record.logout_time ? new Date(record.logout_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
      status: record.status
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!editMode && formData.user_ids.length === 0) {
      toast.error('Please select at least one employee');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editMode) {
        // Update single attendance record
        await attendanceAPI.update(selectedAttendanceId, {
          date: formData.date,
          login_time: formData.login_time,
          logout_time: formData.logout_time,
          status: formData.status
        });
        toast.success('Attendance updated successfully');
      } else {
        // Mark attendance for multiple users
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
      }

      setShowModal(false);
      setEditMode(false);
      setSelectedAttendanceId(null);
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
      console.error('Submit error:', error);
      toast.error(error.response?.data?.message || 'Failed to process attendance');
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
      const response = await fetch('http://127.0.0.1:8289/api/attendance/upload-excel', {
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

  const downloadAttendanceReport = async () => {
    if (selectedMonths.length === 0) {
      toast.error('Please select at least one month');
      return;
    }

    try {
      const year = new Date().getFullYear();
      
      // Fetch all attendance data for the year
      const { data: allAttendance } = await attendanceAPI.getHistory({
        start_date: `${year}-01-01`,
        end_date: `${year}-12-31`,
        ...(filters.user_id && { user_id: filters.user_id })
      });

      // Fetch all users for summary sheet
      const { data: allUsers } = await userAPI.getAll();

      if (allAttendance.length === 0) {
        toast.error('No attendance data found');
        return;
      }

      // Create workbook
      const wb = XLSX.utils.book_new();
      let hasData = false;

      // Create detailed sheets for selected months (WITH login/logout times)
      selectedMonths.sort((a, b) => a - b).forEach(month => {
        const monthData = allAttendance.filter(record => {
          const recordDate = new Date(record.date);
          return recordDate.getMonth() === month && recordDate.getFullYear() === year;
        });

        if (monthData.length > 0) {
          hasData = true;
          const excelData = monthData.map(record => ({
            'Date': new Date(record.date).toLocaleDateString('en-GB'),
            'Employee': record.user_name,
            'Login Time': record.login_time ? new Date(record.login_time).toLocaleTimeString('en-GB') : '-',
            'Logout Time': record.logout_time ? new Date(record.logout_time).toLocaleTimeString('en-GB') : '-',
            'Working Hours': record.login_time && record.logout_time 
              ? ((new Date(record.logout_time) - new Date(record.login_time)) / (1000 * 60 * 60)).toFixed(2) 
              : '-',
            'Status': record.status
          }));

          const ws = XLSX.utils.json_to_sheet(excelData);
          ws['!cols'] = [
            { wch: 12 }, // Date
            { wch: 25 }, // Employee
            { wch: 12 }, // Login Time
            { wch: 12 }, // Logout Time
            { wch: 15 }, // Working Hours
            { wch: 12 }  // Status
          ];

          XLSX.utils.book_append_sheet(wb, ws, monthNames[month]);
        }
      });

      // Create summary sheets for selected months (WITHOUT login/logout times)
      selectedMonths.sort((a, b) => a - b).forEach(month => {
        const monthData = allAttendance.filter(record => {
          const recordDate = new Date(record.date);
          return recordDate.getMonth() === month && recordDate.getFullYear() === year;
        });

        if (monthData.length > 0) {
          // Get number of days in the month
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          
          // Create summary data structure
          const summaryData = [];
          
          // Group attendance by user
          const userAttendance = {};
          allUsers.forEach(user => {
            userAttendance[user.id] = {
              name: user.username,
              days: {}
            };
          });

          // Fill in attendance data
          monthData.forEach(record => {
            const day = new Date(record.date).getDate();
            if (userAttendance[record.user_id]) {
              userAttendance[record.user_id].days[day] = record.status.charAt(0).toUpperCase(); // P, A, H
            }
          });

          // Create rows for each user
          Object.keys(userAttendance).forEach(userId => {
            const userData = userAttendance[userId];
            const row = { 'Employee': userData.name };
            
            // Add each day of the month
            for (let day = 1; day <= daysInMonth; day++) {
              row[`Day ${day}`] = userData.days[day] || '-';
            }
            
            summaryData.push(row);
          });

          // Create worksheet
          const ws = XLSX.utils.json_to_sheet(summaryData);
          
          // Set column widths
          const cols = [{ wch: 25 }]; // Employee column
          for (let i = 0; i < daysInMonth; i++) {
            cols.push({ wch: 6 }); // Day columns
          }
          ws['!cols'] = cols;

          XLSX.utils.book_append_sheet(wb, ws, `${monthNames[month]}_Summary`);
        }
      });

      if (!hasData) {
        toast.error('No attendance data found for selected months');
        return;
      }

      const filename = selectedMonths.length === 12 
        ? `Attendance_Report_${year}.xlsx`
        : `Attendance_Report_${selectedMonths.map(m => monthNames[m]).join('_')}_${year}.xlsx`;

      XLSX.writeFile(wb, filename);
      toast.success('Attendance report downloaded successfully');
      setShowDownloadModal(false);
      setSelectedMonths([]);
      setSelectAllMonths(false);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download attendance report');
    }
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];

  const handleMonthToggle = (monthIndex) => {
    setSelectedMonths(prev => 
      prev.includes(monthIndex)
        ? prev.filter(m => m !== monthIndex)
        : [...prev, monthIndex]
    );
  };

  const handleSelectAllMonths = (checked) => {
    setSelectAllMonths(checked);
    if (checked) {
      setSelectedMonths([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    } else {
      setSelectedMonths([]);
    }
  };

  return (
    <div className="attendance">
      <div className="header">
        <h1>Attendance Management</h1>
        <div className="header-buttons">
          {user.role === 'user' && (
            <>
              <button onClick={handleLogin} className="btn-login">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                  <polyline points="10 17 15 12 10 7"></polyline>
                  <line x1="15" y1="12" x2="3" y2="12"></line>
                </svg>
                Login
              </button>
              <button onClick={handleLogout} className="btn-login">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                Logout
              </button>
            </>
          )}
          {(user.role === 'sysadmin' || user.role === 'admin') && (
            <>
              <button onClick={() => setShowDownloadModal(true)} className="btn-download">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Download Report
              </button>
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
            {showDateRange && (
              <div className="date-range-inputs">
                <input
                  type="date"
                  value={filters.start_date}
                  onChange={(e) => setFilters({ ...filters, start_date: e.target.value, month: '' })}
                />
                <span>to</span>
                <input
                  type="date"
                  value={filters.end_date}
                  onChange={(e) => setFilters({ ...filters, end_date: e.target.value, month: '' })}
                />
              </div>
            )}

          </div>
        </div>

        <div className="table-wrapper">
          <table className="attendance-table">
            <thead>
              <tr>
                <th>
                  <div className="date-filter-header">
                    <span>Date</span>
                    <button
                      className="filter-toggle-btn"
                      onClick={() => setShowDateFilter(!showDateFilter)}
                      title="Filter by date"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                      </svg>
                    </button>
                    {showDateFilter && (
                      <div className="date-filter-dropdown">
                        <div className="filter-section">
                          <label>Month</label>
                          <select
                            value={filters.month}
                            onChange={(e) => setFilters({ ...filters, month: e.target.value, start_date: '', end_date: '' })}
                          >
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
                        </div>

                        <div className="filter-section">
                          <label>Date Range</label>
                          <div className="date-inputs">
                            <input
                              type="date"
                              value={filters.start_date}
                              onChange={(e) => setFilters({ ...filters, start_date: e.target.value, month: '' })}
                              placeholder="Start"
                            />
                            <span>to</span>
                            <input
                              type="date"
                              value={filters.end_date}
                              onChange={(e) => setFilters({ ...filters, end_date: e.target.value, month: '' })}
                              placeholder="End"
                            />
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setFilters({
                              user_id: filters.user_id,
                              start_date: '',
                              end_date: '',
                              month: (new Date().getMonth() + 1).toString(),
                              year: new Date().getFullYear().toString()
                            });
                            setShowDateFilter(false);
                          }}
                          className="btn-clear-filter"
                        >
                          Clear Date Filters
                        </button>
                      </div>
                    )}
                  </div>
                </th>
                {(user.role === 'sysadmin' || user.role === 'admin') && (
                  <th>
                    <div className="user-filter-header">
                      <span>Employee</span>
                      <button
                        className="filter-toggle-btn"
                        onClick={() => setShowUserFilter(!showUserFilter)}
                        title="Filter by employee"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                        </svg>
                      </button>
                      {showUserFilter && (
                        <div className="user-filter-dropdown">
                          <div className="filter-option" onClick={() => { setFilters({ ...filters, user_id: '' }); setShowUserFilter(false); }}>
                            <span>All Employees</span>
                          </div>
                          {users.map(u => (
                            <div
                              key={u.id}
                              className="filter-option"
                              onClick={() => { setFilters({ ...filters, user_id: u.id }); setShowUserFilter(false); }}
                            >
                              <span>{u.username}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </th>
                )}
                <th>Login Time</th>
                <th>Logout Time</th>
                <th>Working Hours</th>
                <th>Status</th>
                {user.role === 'sysadmin' && (
                  <th>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <span>Actions</span>

                    </div>
                  </th>
                )}
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
                        <div className="action-buttons">
                          <button
                            onClick={() => handleEdit(record)}
                            className="btn-edit"
                            title="Edit"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(record.id)}
                            className="btn-danger"
                            title="Delete"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              <line x1="10" y1="11" x2="10" y2="17"></line>
                              <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal">
          <div className="modal-content modal-large">
            <h2>{editMode ? 'Edit Attendance' : 'Mark Attendance'}</h2>
            <form onSubmit={handleSubmit}>
              {!editMode && (
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
                          <span className="checkbox-text">{u.username}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  disabled={editMode}
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
                      {editMode ? 'Updating...' : 'Processing...'}
                    </>
                  ) : (
                    editMode ? 'Update Attendance' : `Mark Attendance (${formData.user_ids.length} selected)`
                  )}
                </button>
                <button type="button" onClick={() => {
                  setShowModal(false);
                  setEditMode(false);
                  setSelectedAttendanceId(null);
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
            
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ margin: 0 }}>Select Excel File</label>
                  <button type="button" onClick={downloadTemplate} className="btn-template">
                    Download Template
                  </button>
                </div>
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

      {/* Download Month Selection Modal */}
      {showDownloadModal && (
        <div className="modal">
          <div className="modal-content">
            <h2>Select Months to Download</h2>
            <div className="month-selection">
              <div className="select-all-option">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectAllMonths}
                    onChange={(e) => handleSelectAllMonths(e.target.checked)}
                  />
                  <span className="checkbox-text">Select All Months</span>
                </label>
              </div>
              <div className="month-list">
                {monthNames.map((month, index) => (
                  <label key={index} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedMonths.includes(index)}
                      onChange={() => handleMonthToggle(index)}
                    />
                    <span className="checkbox-text">{month}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button 
                onClick={downloadAttendanceReport} 
                className="btn-primary"
                disabled={selectedMonths.length === 0}
              >
                Download ({selectedMonths.length} month{selectedMonths.length !== 1 ? 's' : ''})
              </button>
              <button 
                onClick={() => {
                  setShowDownloadModal(false);
                  setSelectedMonths([]);
                  setSelectAllMonths(false);
                }} 
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;
