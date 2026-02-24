const express = require('express');
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

// Dashboard summary stats: total users, on time, late arrivals, early departures
router.get('/dashboard-summary', async (req, res) => {
  try {
    // Total active users
    const totalUsersQuery = 'SELECT COUNT(*) as total FROM users WHERE is_active = true';
    const totalUsersResult = await pool.query(totalUsersQuery);
    const totalEmployees = parseInt(totalUsersResult.rows[0].total);

    // Get today's date (YYYY-MM-DD)
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;


    // On Time: login_time <= 10:30
    const onTimeQuery = `
      SELECT COUNT(DISTINCT a.user_id) as count
      FROM attendance a
      WHERE a.date = $1 AND a.status = 'present' AND a.login_time::time <= '10:30:00'::time
    `;
    const onTimeResult = await pool.query(onTimeQuery, [todayStr]);
    const onTime = parseInt(onTimeResult.rows[0].count);

    // Late Arrival: login_time > 10:30
    const lateArrivalQuery = `
      SELECT COUNT(DISTINCT a.user_id) as count
      FROM attendance a
      WHERE a.date = $1 AND a.status = 'present' AND a.login_time::time > '10:30:00'::time
    `;
    const lateArrivalResult = await pool.query(lateArrivalQuery, [todayStr]);
    const lateArrivals = parseInt(lateArrivalResult.rows[0].count);

    // Early Departures: logout_time < 18:30 (if logout_time exists)
    const earlyDepartureQuery = `
      SELECT COUNT(DISTINCT a.user_id) as count
      FROM attendance a
      WHERE a.date = $1 AND a.status = 'present' AND a.logout_time IS NOT NULL AND a.logout_time::time < '18:30:00'::time
    `;
    const earlyDepartureResult = await pool.query(earlyDepartureQuery, [todayStr]);
    const earlyDepartures = parseInt(earlyDepartureResult.rows[0].count);

    res.json({
      totalEmployees,
      onTime,
      lateArrivals,
      earlyDepartures
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


// Daily login pattern per user
router.get('/daily-login-pattern', authenticate, async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    let query, params;
    // If user is 'user', only fetch their data
    if (req.user && req.user.role_name === 'user') {
      query = `
        SELECT 
          a.date,
          u.username,
          a.login_time
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        WHERE a.status = 'present'
          AND EXTRACT(YEAR FROM a.date) = $1
          AND u.id = $2
        ORDER BY u.username, a.date
      `;
      params = [year, req.user.id];
    } else {
      query = `
        SELECT 
          a.date,
          u.username,
          a.login_time
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        WHERE a.status = 'present'
          AND EXTRACT(YEAR FROM a.date) = $1
        ORDER BY u.username, a.date
      `;
      params = [year];
    }
    const { rows } = await pool.query(query, params);
    const userMap = {};
    rows.forEach(row => {
      const username = row.username;
      const dateLabel = row.date.toISOString().split('T')[0];
      let loginTime = null;
      if (row.login_time) {
        const hours = row.login_time.getHours().toString().padStart(2, '0');
        const minutes = row.login_time.getMinutes().toString().padStart(2, '0');
        loginTime = `${hours}:${minutes}`;
      }
      if (!userMap[username]) userMap[username] = {};
      userMap[username][dateLabel] = loginTime;
    });
    res.json(userMap);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Daily logout pattern per user
router.get('/daily-logout-pattern', authenticate, async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    let query, params;
    if (req.user && req.user.role_name === 'user') {
      query = `
        SELECT 
          a.date,
          u.username,
          a.logout_time
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        WHERE a.status = 'present'
          AND EXTRACT(YEAR FROM a.date) = $1
          AND u.id = $2
        ORDER BY u.username, a.date
      `;
      params = [year, req.user.id];
    } else {
      query = `
        SELECT 
          a.date,
          u.username,
          a.logout_time
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        WHERE a.status = 'present'
          AND EXTRACT(YEAR FROM a.date) = $1
        ORDER BY u.username, a.date
      `;
      params = [year];
    }
    const { rows } = await pool.query(query, params);
    const userMap = {};
    rows.forEach(row => {
      const username = row.username;
      const dateLabel = row.date.toISOString().split('T')[0];
      let logoutTime = null;
      if (row.logout_time) {
        const hours = row.logout_time.getHours().toString().padStart(2, '0');
        const minutes = row.logout_time.getMinutes().toString().padStart(2, '0');
        logoutTime = `${hours}:${minutes}`;
      }
      if (!userMap[username]) userMap[username] = {};
      userMap[username][dateLabel] = logoutTime;
    });
    res.json(userMap);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// User-wise leave taken vs pending vs limit exceed for admin/sysadmin
router.get('/user-leave-taken-pending-exceed', authenticate, authorize('sysadmin', 'admin'), async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    const yearlyLimit = 12; // You can make this dynamic if needed
    const query = `
      SELECT 
        u.id,
        u.username,
        u.full_name,
        u.email,
        u.designation,
        COALESCE(SUM(CASE WHEN lr.status = 'approved' THEN (lr.end_date - lr.start_date + 1) ELSE 0 END), 0) as days_taken,
        COALESCE(SUM(CASE WHEN lr.status = 'pending' THEN (lr.end_date - lr.start_date + 1) ELSE 0 END), 0) as days_pending
      FROM users u
      LEFT JOIN leave_requests lr ON u.id = lr.user_id 
        AND EXTRACT(YEAR FROM lr.start_date) = $1
      WHERE u.is_active = true
      GROUP BY u.id, u.username, u.full_name, u.email, u.designation
      ORDER BY days_taken DESC
    `;
    const { rows } = await pool.query(query, [year]);
    // Add limit_exceed field
    const result = rows.map(row => {
      const days_taken = parseInt(row.days_taken) || 0;
      const limit_exceed = Math.max(days_taken - yearlyLimit, 0);
      return {
        ...row,
        days_taken,
        days_pending: parseInt(row.days_pending) || 0,
        limit_exceed
      };
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


module.exports = router;
