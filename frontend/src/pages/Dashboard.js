import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI } from '../services/api';
import './Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [userSummary, setUserSummary] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      if (user.role === 'sysadmin' || user.role === 'admin') {
        const { data } = await dashboardAPI.getStats();
        setStats(data);
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

      {userSummary && (
        <div className="user-summary">
          <h2>Your Summary</h2>
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
    </div>
  );
};

export default Dashboard;
