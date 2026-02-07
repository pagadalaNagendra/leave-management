const express = require('express');
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

// Dashboard stats for sysadmin and admin
router.get('/stats', authenticate, authorize('sysadmin', 'admin'), async (req, res) => {
  try {
    // Total users
    const usersQuery = 'SELECT COUNT(*) as total FROM users WHERE is_active = true';
    const usersResult = await pool.query(usersQuery);
    
    // Pending leave requests
    const pendingQuery = 'SELECT COUNT(*) as total FROM leave_requests WHERE status = $1';
    const pendingResult = await pool.query(pendingQuery, ['pending']);
    
    // Today's attendance
    const attendanceQuery = `
      SELECT COUNT(*) as total 
      FROM attendance 
      WHERE date = CURRENT_DATE
    `;
    const attendanceResult = await pool.query(attendanceQuery);
    
    // This month's leaves
    const monthLeavesQuery = `
      SELECT COUNT(*) as total 
      FROM leave_requests 
      WHERE EXTRACT(MONTH FROM start_date) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM CURRENT_DATE)
    `;
    const monthLeavesResult = await pool.query(monthLeavesQuery);

    res.json({
      totalUsers: parseInt(usersResult.rows[0].total),
      pendingRequests: parseInt(pendingResult.rows[0].total),
      todayAttendance: parseInt(attendanceResult.rows[0].total),
      monthlyLeaves: parseInt(monthLeavesResult.rows[0].total)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// User summary
router.get('/user-summary', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Total approved leaves
    const leavesQuery = `
      SELECT COUNT(*) as total_leaves,
             COALESCE(SUM(end_date - start_date + 1), 0) as total_days
      FROM leave_requests
      WHERE user_id = $1 AND status = 'approved'
      AND EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM CURRENT_DATE)
    `;
    const leavesResult = await pool.query(leavesQuery, [userId]);
    
    // Total absences (days not marked present)
    const absenceQuery = `
      SELECT COUNT(*) as total_absences
      FROM attendance
      WHERE user_id = $1 AND status = 'absent'
      AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM CURRENT_DATE)
    `;
    const absenceResult = await pool.query(absenceQuery, [userId]);
    
    // Present days
    const presentQuery = `
      SELECT COUNT(*) as total_present
      FROM attendance
      WHERE user_id = $1 AND status = 'present'
      AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM CURRENT_DATE)
    `;
    const presentResult = await pool.query(presentQuery, [userId]);

    res.json({
      totalLeaves: parseInt(leavesResult.rows[0].total_leaves),
      totalLeaveDays: parseInt(leavesResult.rows[0].total_days),
      totalAbsences: parseInt(absenceResult.rows[0].total_absences),
      totalPresent: parseInt(presentResult.rows[0].total_present)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
