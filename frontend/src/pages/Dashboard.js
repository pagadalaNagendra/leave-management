import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI } from '../services/api';
import './Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [userSummary, setUserSummary] = useState(null);
  const [userLeaveStats, setUserLeaveStats] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      if (user.role === 'sysadmin' || user.role === 'admin') {
        const { data } = await dashboardAPI.getStats();
        setStats(data);

        const { data: leaveStats } = await dashboardAPI.getUserLeaveStats();
        setUserLeaveStats(leaveStats);
      }

      const { data: summary } = await dashboardAPI.getUserSummary();
      setUserSummary(summary);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  return (
    <div className="dashboard">
      <h1>Welcome, {user.full_name}!</h1>

      {(user.role === 'sysadmin' || user.role === 'admin') && stats && (
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
            <h3>Today's Attendance</h3>
            <p className="stat-value">{stats.todayAttendance}</p>
          </div>
          <div className="stat-card">
            <h3>Monthly Leaves</h3>
            <p className="stat-value">{stats.monthlyLeaves}</p>
          </div>
        </div>
      )}

      {user.role === 'user' && userSummary && (
        <div className="user-summary">
          <h2>Summary</h2>
          <div className="summary-grid">
            <div className="summary-card">
              <h4>Total Leaves Taken</h4>
              <p>{userSummary.totalLeaves} requests</p>
              <p className="sub-text">{userSummary.totalLeaveDays} days</p>
            </div>
            <div className="summary-card">
              <h4>Total Present</h4>
              <p>{userSummary.totalPresent} days</p>
            </div>
            <div className="summary-card">
              <h4>Total Absences</h4>
              <p>{userSummary.totalAbsences} days</p>
            </div>
          </div>
        </div>
      )}

      {user.role === 'user' && userSummary && (
        <div className="user-leave-stats">
          <h2>Your Leave Statistics</h2>
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
          <h2>Employee Leave Statistics</h2>
          <table className="stats-table">
            <thead>
              <tr>
                <th>Employee</th>
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
                      <strong>{userStat.full_name}</strong>
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
