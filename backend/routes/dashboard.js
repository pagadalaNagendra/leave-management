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
    
    // Pending leaves
    const pendingLeavesQuery = `
      SELECT COUNT(*) as pending_requests,
             COALESCE(SUM(end_date - start_date + 1), 0) as pending_days
      FROM leave_requests
      WHERE user_id = $1 AND status = 'pending'
      AND EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM CURRENT_DATE)
    `;
    const pendingResult = await pool.query(pendingLeavesQuery, [userId]);
    
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
      pendingRequests: parseInt(pendingResult.rows[0].pending_requests),
      pendingDays: parseInt(pendingResult.rows[0].pending_days),
      totalAbsences: parseInt(absenceResult.rows[0].total_absences),
      totalPresent: parseInt(presentResult.rows[0].total_present)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// User-wise leave statistics for admin/sysadmin
router.get('/user-leave-stats', authenticate, authorize('sysadmin', 'admin'), async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    
    const query = `
      SELECT 
        u.id,
        u.full_name,
        u.email,
        u.designation,
        COUNT(DISTINCT lr.id) as total_requests,
        COALESCE(SUM(CASE WHEN lr.status = 'approved' THEN (lr.end_date - lr.start_date + 1) ELSE 0 END), 0) as days_taken,
        COALESCE(SUM(CASE WHEN lr.status = 'pending' THEN (lr.end_date - lr.start_date + 1) ELSE 0 END), 0) as days_pending
      FROM users u
      LEFT JOIN leave_requests lr ON u.id = lr.user_id 
        AND EXTRACT(YEAR FROM lr.start_date) = $1
      WHERE u.is_active = true
      GROUP BY u.id, u.full_name, u.email, u.designation
      ORDER BY days_taken DESC
    `;
    
    const { rows } = await pool.query(query, [year]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Monthly leave trends
router.get('/leave-trends', authenticate, authorize('sysadmin', 'admin'), async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    
    const query = `
      WITH months AS (
        SELECT 
          generate_series(1, 12) AS month_num,
          TO_CHAR(DATE '2024-01-01' + (generate_series(1, 12) - 1) * INTERVAL '1 month', 'Mon') AS month
      )
      SELECT 
        m.month,
        m.month_num,
        COALESCE(COUNT(lr.id), 0) as total_leaves
      FROM months m
      LEFT JOIN leave_requests lr ON 
        EXTRACT(MONTH FROM lr.start_date) = m.month_num
        AND EXTRACT(YEAR FROM lr.start_date) = $1
        AND lr.status = 'approved'
      GROUP BY m.month, m.month_num
      ORDER BY m.month_num
    `;
    const { rows } = await pool.query(query, [year]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Leave type distribution - Overall stats
router.get('/leave-type-distribution', authenticate, authorize('sysadmin', 'admin'), async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    
    const query = `
      SELECT 
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected
      FROM leave_requests
      WHERE EXTRACT(YEAR FROM start_date) = $1
    `;
    const { rows } = await pool.query(query, [year]);
    
    // Transform to array format for chart
    const result = [
      { status: 'Total Requests', count: parseInt(rows[0].total_requests) },
      { status: 'Pending', count: parseInt(rows[0].pending) },
      { status: 'Approved', count: parseInt(rows[0].approved) },
      { status: 'Rejected', count: parseInt(rows[0].rejected) }
    ];
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Attendance overview - User-wise for the year
router.get('/attendance-overview', authenticate, authorize('sysadmin', 'admin'), async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    
    const query = `
      SELECT 
        u.full_name as user_name,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END)::INTEGER as present,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END)::INTEGER as absent,
        COUNT(*)::INTEGER as total_days
      FROM users u
      LEFT JOIN attendance a ON u.id = a.user_id 
        AND EXTRACT(YEAR FROM a.date) = $1
        AND a.date <= CURRENT_DATE
      WHERE u.is_active = true
      GROUP BY u.id, u.full_name
      HAVING COUNT(*) > 0
      ORDER BY COUNT(CASE WHEN a.status = 'present' THEN 1 END) DESC
      LIMIT 10
    `;
    const { rows } = await pool.query(query, [year]);
    
    // Ensure numeric values
    const formattedRows = rows.map(row => ({
      user_name: row.user_name,
      present: Number(row.present),
      absent: Number(row.absent),
      total_days: Number(row.total_days)
    }));
    
    console.log('Attendance data being sent:', formattedRows);
    
    res.json(formattedRows);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
