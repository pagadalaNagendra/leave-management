const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { sendWelcomeEmail } = require('../utils/emailService');
const router = express.Router();

// Get all users
router.get('/', authenticate, authorize('sysadmin', 'admin'), async (req, res) => {
  try {
    const query = `
      SELECT u.id, u.username, u.email, u.full_name, u.designation, u.is_active, 
             r.name as role_name, u.created_at
      FROM users u
      JOIN roles r ON u.role_id = r.id
      ORDER BY u.created_at DESC
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create user
router.post('/', authenticate, authorize('sysadmin', 'admin'), async (req, res) => {
  try {
    const { username, email, password, full_name, designation, role } = req.body;
    
    // Role validation based on creator's role
    if (req.user.role_name === 'admin' && role === 'sysadmin') {
      return res.status(403).json({ message: 'Admins cannot create sysadmin users' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const query = `
      INSERT INTO users (username, email, password, full_name, designation, role_id, created_by)
      VALUES ($1, $2, $3, $4, $5, (SELECT id FROM roles WHERE name = $6), $7)
      RETURNING id, username, email, full_name, designation
    `;
    
    const { rows } = await pool.query(query, [
      username, email, hashedPassword, full_name, designation, role, req.user.id
    ]);
    
    // Send welcome email with credentials
    await sendWelcomeEmail(email, username, password, full_name);
    
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ message: 'Username or email already exists' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update user
router.put('/:id', authenticate, authorize('sysadmin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, full_name, designation, password } = req.body;
    
    let query;
    let params;
    
    if (password && password.trim() !== '') {
      // Update with new password
      const hashedPassword = await bcrypt.hash(password, 10);
      query = `
        UPDATE users 
        SET username = $1, email = $2, full_name = $3, designation = $4, password = $5, updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
        RETURNING id, username, email, full_name, designation
      `;
      params = [username, email, full_name, designation, hashedPassword, id];
    } else {
      // Update without password change
      query = `
        UPDATE users 
        SET username = $1, email = $2, full_name = $3, designation = $4, updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING id, username, email, full_name, designation
      `;
      params = [username, email, full_name, designation, id];
    }
    
    const { rows } = await pool.query(query, params);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete user (sysadmin only)
router.delete('/:id', authenticate, authorize('sysadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
