import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI } from '../services/api';
import { leaveAPI } from '../services/api';
import * as XLSX from 'xlsx';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './Dashboard.css';
import axios from 'axios';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [userSummary, setUserSummary] = useState(null);
  const [userLeaveStats, setUserLeaveStats] = useState([]);
  const [leaveTrends, setLeaveTrends] = useState([]);
  const [leaveTypeDistribution, setLeaveTypeDistribution] = useState([]);
  const [attendanceOverview, setAttendanceOverview] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [monthlyLeaveDays, setMonthlyLeaveDays] = useState([]);
  const [monthlyAttendance, setMonthlyAttendance] = useState([]);
  const COLORS = ['#3498db', '#2ecc71', '#f39c12', '#e74c3c', '#9b59b6'];

  // Generate year options (last 5 years + current year + next year)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear - 5 + i);

  useEffect(() => {
    fetchData();
  }, [selectedYear]);

  const fetchData = async () => {
    try {
      if (user.role === 'sysadmin' || user.role === 'admin') {
        const { data } = await dashboardAPI.getStats();
        setStats(data);

        const { data: leaveStats } = await dashboardAPI.getUserLeaveStats(selectedYear);
        setUserLeaveStats(leaveStats);

        const { data: trends } = await dashboardAPI.getLeaveTrends(selectedYear);
        setLeaveTrends(trends);

        const { data: typeDistribution } = await dashboardAPI.getLeaveTypeDistribution(selectedYear);
        setLeaveTypeDistribution(typeDistribution);

        const { data: attendance } = await dashboardAPI.getAttendanceOverview(selectedYear);
        console.log('Attendance data received:', attendance);
        setAttendanceOverview(attendance);
      }

      const { data: summary } = await dashboardAPI.getUserSummary();
      setUserSummary(summary);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const fetchMonthlyLeaveDays = async () => {
    try {
      // Use leaveAPI.getAll() which already handles auth and baseURL
      const { data } = await leaveAPI.getAll();
      const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      const monthMap = {};
      months.forEach((m, i) => { monthMap[i + 1] = { month: m, days: 0 }; });

      data.forEach(leave => {
        const start = new Date(leave.start_date);
        const end = new Date(leave.end_date);
        if (
          leave.status === 'approved' &&
          (!user || leave.user_id === user.id)
        ) {
          const monthNum = start.getMonth() + 1;
          const days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
          if (monthMap[monthNum]) {
            monthMap[monthNum].days += days;
          }
        }
      });

      setMonthlyLeaveDays(Object.values(monthMap));
    } catch (error) {
      console.error('Error fetching monthly leave days:', error);
      setMonthlyLeaveDays([]);
    }
  };

  const fetchMonthlyAttendance = async () => {
    try {
      const token = localStorage.getItem('token');
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      const { data } = await axios.get('http://127.0.0.1:5002/api/attendance/history', config);
      const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      const monthMap = {};
      months.forEach((m, i) => { monthMap[i + 1] = { month: m, present: 0, absent: 0 }; });

      data.forEach(record => {
        const date = new Date(record.date);
        const monthNum = date.getMonth() + 1;
        if (!user || record.user_id === user.id) {
          if (record.status === 'present' && monthMap[monthNum]) {
            monthMap[monthNum].present += 1;
          }
          if (record.status === 'absent' && monthMap[monthNum]) {
            monthMap[monthNum].absent += 1;
          }
        }
      });

      setMonthlyAttendance(Object.values(monthMap));
    } catch (error) {
      console.error('Error fetching monthly attendance:', error);
      setMonthlyAttendance([]);
    }
  };

  useEffect(() => {
    if (user.role === 'user') {
      fetchMonthlyLeaveDays();
      fetchMonthlyAttendance();
    }
  }, [selectedYear, user.role]);

  const downloadLeaveReport = () => {
    // Prepare data for Excel
    const excelData = userLeaveStats.map(userStat => ({
      'Employee Name': userStat.username,
      'Email': userStat.email,
      'Designation': userStat.designation || '-',
      'Total Leave Requests': userStat.total_requests,
      'Days Taken (Approved)': userStat.days_taken,
      'Days Pending': userStat.days_pending,
      'Total Days': parseInt(userStat.days_taken) + parseInt(userStat.days_pending)
    }));

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    ws['!cols'] = [
      { wch: 25 }, // Employee Name
      { wch: 30 }, // Email
      { wch: 20 }, // Designation
      { wch: 20 }, // Total Leave Requests
      { wch: 22 }, // Days Taken
      { wch: 15 }, // Days Pending
      { wch: 15 }  // Total Days
    ];

    // Create workbook and add worksheet
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leave Statistics');

    // Generate filename with current date
    const today = new Date();
    const filename = `Leave_Statistics_${today.getFullYear()}_${String(today.getMonth() + 1).padStart(2, '0')}_${String(today.getDate()).padStart(2, '0')}.xlsx`;

    // Download file
    XLSX.writeFile(wb, filename);
  };

  return (
    <div className="dashboard">


      {(user.role === 'sysadmin' || user.role === 'admin') && stats && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Total Users</h3>
              <p className="stat-value">{stats.totalUsers}</p>
            </div>
            <div className="stat-card">
              <h3>Pending Requests</h3>
              <p className="stat-value">{stats.pendingRequests}</p>
            </div>
            <div className="stat-card">
              <h3>Yearly Leaves</h3>
              <p className="stat-value">12</p>
            </div>
          </div>

          {/* Analytics Section */}
          <div className="analytics-section">

            <div className="analytics-grid">
              {/* Leave Trends Chart */}
              <div className="analytics-card">
                <div className="card-header-with-selector">
                  <h3>User Wise Leave Count</h3>
                  <div className="year-selector">
                    <select
                      id="year-select"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    >
                      {yearOptions.map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={userLeaveStats.filter(
                      stat =>
                        stat.role !== 'admin' &&
                        stat.role !== 'sysadmin' &&
                        stat.role?.toLowerCase() !== 'administrator' &&
                        stat.username?.toLowerCase() !== 'system administrator'
                    )}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="username" label={{ value: 'Username', position: 'insideBottom', offset: -5 }} />
                    <YAxis
                      type="number"
                      label={{ value: 'Days Taken', angle: -90, position: 'insideLeft' }}
                      allowDecimals={false}
                    />
                    <Tooltip cursor={false} />
                    <Legend />
                    <Bar dataKey="days_taken" fill="#3498db" name="Days Taken" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Leave Type Distribution */}
              <div className="analytics-card">
                <h3>Leaves Status</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={leaveTypeDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={90}
                      fill="#8884d8"
                      dataKey="count"
                      nameKey="status"
                      activeShape={null}
                    >
                      {leaveTypeDistribution.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            entry.status === 'Total Requests' ? '#3498db' :
                              entry.status === 'Pending' ? '#f39c12' :
                                entry.status === 'Approved' ? '#2ecc71' :
                                  '#e74c3c'
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Attendance Overview */}
              <div className="analytics-card">
                <div className="card-header-with-selector">
                  <h3>Employee wise Attendance </h3>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={attendanceOverview
                    .filter(item =>
                      item.user_name &&
                      item.user_name.toLowerCase() !== 'sysadmin' &&
                      item.user_name.toLowerCase() !== 'system administrator'
                    )
                    .map((item, index) => ({
                      ...item,
                      index: index + 1,
                      present_percent: Number(item.present_percent) || 0,
                      absent_percent: Number(item.absent_percent) || 0
                    }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="user_name" label={{ value: 'Username', position: 'insideBottom', offset: -5 }} />
                    <YAxis
                      label={{ value: 'Attendance (%)', angle: -90, position: 'insideLeft' }}
                      domain={[0, 100]}
                      ticks={[0, 20, 40, 60, 80, 100]}
                    />
                    <Tooltip
                      cursor={false}
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        padding: '10px'
                      }}
                      formatter={(value, name, props) => {
                        const label = props.dataKey === 'present_percent' ? 'Present (%)' : 'Absent (%)';
                        return [`${value}%`, label];
                      }}
                      labelFormatter={(value) => {
                        return value ? `Username: ${value}` : '';
                      }}
                    />
                    <Legend />
                    <Bar dataKey="present_percent" fill="#2ecc71" name="Present (%)" />
                    <Bar dataKey="absent_percent" fill="#e74c3c" name="Absent (%)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}

      {user.role === 'user' && userSummary && (
        <>
          <div className="stats-grid user-stats-grid">
            <div className="stat-card">
              <h3>Total Leaves</h3>
              <p className="stat-value">{userSummary.totalLeaveDays}</p>
            </div>
            <div className="stat-card">
              <h3>Present Days</h3>
              <p className="stat-value">{userSummary.totalPresent}</p>
            </div>
            <div className="stat-card">
              <h3>Absent Days</h3>
              <p className="stat-value">{userSummary.totalAbsences}</p>
            </div>
            <div className="stat-card">
              <h3>Pending Requests</h3>
              <p className="stat-value">{userSummary.pendingRequests}</p>
            </div>
            <div className="stat-card">
              <h3>Yearly Leaves</h3>
              <p className="stat-value">12</p>
            </div>
          </div>

          <div className="analytics-section">
            <div className="analytics-grid user-analytics-grid">

              {/* Month Wise Leave Taken History */}
              <div className="analytics-card">
                <h3>Month Wise Leave Taken</h3>
                <div style={{ width: "100%", minWidth: 0 }}>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={monthlyLeaveDays}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="days" fill="#3498db" name="Leave Days" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {/* Leave Status Pie Chart */}
              <div className="analytics-card">
                <h3>Leave Status Distribution</h3>
                <div style={{ width: "100%", minWidth: 0 }}>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Approved', value: userSummary.totalLeaves },
                          { name: 'Pending', value: userSummary.pendingRequests },
                          { name: 'Rejected', value: userSummary.totalRejected || 0 }
                        ]}
                        cx="50%"
                        cy="50%"
                        outerRadius={60}
                        dataKey="value"
                        label
                      >
                        <Cell key="approved" fill="#2ecc71" />
                        <Cell key="pending" fill="#f39c12" />
                        <Cell key="rejected" fill="#e74c3c" />
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Month Wise Attendance Present & Absent */}
              <div className="analytics-card">
                <h3>Month Wise Attendance</h3>
                <div style={{ width: "100%", minWidth: 0 }}>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={monthlyAttendance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="present" fill="#2ecc71" name="Present Days" />
                      <Bar dataKey="absent" fill="#e74c3c" name="Absent Days" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {user.role === 'user' && userSummary && (
        <div className="user-leave-stats">
          <h2>Leave Statistics</h2>
          <table className="stats-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Total Requests</th>
                <th>Days Taken</th>
                <th>Days Pending</th>
                <th>Total Days</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>This Year</strong></td>
                <td className="text-center">{userSummary.totalLeaves + (userSummary.pendingRequests || 0)}</td>
                <td className="text-center">
                  <span className="badge badge-success">{userSummary.totalLeaveDays} days</span>
                </td>
                <td className="text-center">
                  <span className="badge badge-warning">{userSummary.pendingDays || 0} days</span>
                </td>
                <td className="text-center">
                  <strong>{userSummary.totalLeaveDays + (userSummary.pendingDays || 0)} days</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {(user.role === 'sysadmin' || user.role === 'admin') && userLeaveStats.length > 0 && (
        <div className="user-leave-stats">
          <div className="stats-header">
            <h2>Employee Leave Statistics</h2>
            <button onClick={downloadLeaveReport} className="btn-download">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </button>
          </div>
          <table className="stats-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Designation</th>
                <th>Total Requests</th>
                <th>Days Taken</th>
                <th>Days Pending</th>
                <th>Total Days</th>
              </tr>
            </thead>
            <tbody>
              {userLeaveStats.map((userStat) => (
                <tr key={userStat.id}>
                  <td>
                    <div className="user-info">
                      <strong>{userStat.username}</strong>
                    </div>
                  </td>
                  <td>{userStat.designation || '-'}</td>
                  <td className="text-center">{userStat.total_requests}</td>
                  <td className="text-center">
                    <span className="badge badge-success">{userStat.days_taken} days</span>
                  </td>
                  <td className="text-center">
                    <span className="badge badge-warning">{userStat.days_pending} days</span>
                  </td>
                  <td className="text-center">
                    <strong>{parseInt(userStat.days_taken) + parseInt(userStat.days_pending)} days</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
