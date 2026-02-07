const express = require('express');
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

// Mark attendance
router.post('/mark', authenticate, async (req, res) => {
  try {
    const { user_id, date, login_time, logout_time, status } = req.body;
    
    // Users can only mark their own attendance
    const targetUserId = req.user.role_name === 'user' ? req.user.id : user_id;
    
    const query = `
      INSERT INTO attendance (user_id, date, login_time, logout_time, status, marked_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id, date)
      DO UPDATE SET 
        logout_time = EXCLUDED.logout_time,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [
      targetUserId,
      date || new Date().toISOString().split('T')[0],
      login_time || new Date(),
      logout_time,
      status || 'present',
      req.user.id
    ]);
    
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Auto login (for current user)
router.post('/login', authenticate, async (req, res) => {
  try {
    const query = `
      INSERT INTO attendance (user_id, date, login_time, status, marked_by)
      VALUES ($1, CURRENT_DATE, CURRENT_TIMESTAMP, 'present', $1)
      ON CONFLICT (user_id, date)
      DO UPDATE SET login_time = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [req.user.id]);
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Auto logout (for current user)
router.post('/logout', authenticate, async (req, res) => {
  try {
    const query = `
      UPDATE attendance
      SET logout_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND date = CURRENT_DATE
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [req.user.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'No login record found for today' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get attendance history
router.get('/history', authenticate, async (req, res) => {
  try {
    const { user_id, start_date, end_date } = req.query;
    
    let query = `
      SELECT a.*, u.full_name as user_name
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    // Users can only see their own attendance
    if (req.user.role_name === 'user') {
      query += ` AND a.user_id = $${paramIndex++}`;
      params.push(req.user.id);
    } else if (user_id) {
      query += ` AND a.user_id = $${paramIndex++}`;
      params.push(user_id);
    }
    
    if (start_date) {
      query += ` AND a.date >= $${paramIndex++}`;
      params.push(start_date);
    }
    
    if (end_date) {
      query += ` AND a.date <= $${paramIndex++}`;
      params.push(end_date);
    }
    
    query += ' ORDER BY a.date DESC, a.login_time DESC';
    
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update attendance (sysadmin only for full CRUD)
router.put('/:id', authenticate, authorize('sysadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { login_time, logout_time, status } = req.body;
    
    const query = `
      UPDATE attendance
      SET login_time = $1, logout_time = $2, status = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [login_time, logout_time, status, id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete attendance (sysadmin only)
router.delete('/:id', authenticate, authorize('sysadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM attendance WHERE id = $1', [id]);
    res.json({ message: 'Attendance record deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
