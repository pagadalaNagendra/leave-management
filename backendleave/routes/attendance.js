const express = require('express');
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const multer = require('multer');
const XLSX = require('xlsx');
const router = express.Router();

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.mimetype === 'text/csv') {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) and CSV files are allowed'));
    }
  }
});

// Helper function to convert Excel date number to YYYY-MM-DD
const excelDateToJSDate = (excelDate) => {
  if (!excelDate) {
    throw new Error('Date is required');
  }

  // If it's already a string in YYYY-MM-DD format
  if (typeof excelDate === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(excelDate)) {
      return excelDate;
    }
    // Try parsing DD/MM/YYYY format
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(excelDate)) {
      const [day, month, year] = excelDate.split('/');
      return `${year}-${month}-${day}`;
    }
  }

  // If it's a number (Excel serial date)
  if (typeof excelDate === 'number') {
    // Excel dates start from 1900-01-01 as day 1
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  throw new Error(`Invalid date format: ${excelDate}`);
};

// Mark attendance (for admin/sysadmin to mark for others)
router.post('/mark', authenticate, authorize('sysadmin', 'admin'), async (req, res) => {
  try {
    const { user_id, date, login_time, logout_time, status } = req.body;

    // Convert time strings to timestamp format
    const loginTimestamp = login_time ? `${date} ${login_time}:00` : null;
    const logoutTimestamp = logout_time ? `${date} ${logout_time}:00` : null;

    const query = `
      INSERT INTO attendance (user_id, date, login_time, logout_time, status, marked_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id, date) 
      DO UPDATE SET 
        login_time = EXCLUDED.login_time,
        logout_time = EXCLUDED.logout_time,
        status = EXCLUDED.status,
        marked_by = EXCLUDED.marked_by,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const { rows } = await pool.query(query, [
      user_id,
      date,
      loginTimestamp,
      logoutTimestamp,
      status,
      req.user.id
    ]);

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Mark attendance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Auto login (for current user)
router.post('/login', authenticate, async (req, res) => {
  try {
    // Get current UTC time and convert to IST (UTC + 5:30)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC + 5:30
    const istTime = new Date(now.getTime() + istOffset);
    
    // Format date as YYYY-MM-DD in IST
    const year = istTime.getUTCFullYear();
    const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(istTime.getUTCDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    // Format timestamp as YYYY-MM-DD HH:MM:SS in IST
    const hours = String(istTime.getUTCHours()).padStart(2, '0');
    const minutes = String(istTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(istTime.getUTCSeconds()).padStart(2, '0');
    const loginTimestamp = `${dateStr} ${hours}:${minutes}:${seconds}`;

    const query = `
      INSERT INTO attendance (user_id, date, login_time, status, marked_by)
      VALUES ($1, $2, $3, 'present', $1)
      ON CONFLICT (user_id, date)
      DO UPDATE SET login_time = EXCLUDED.login_time, updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const { rows } = await pool.query(query, [req.user.id, dateStr, loginTimestamp]);
    res.json(rows[0]);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Auto logout (for current user)
router.post('/logout', authenticate, async (req, res) => {
  try {
    // Get current UTC time and convert to IST (UTC + 5:30)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC + 5:30
    const istTime = new Date(now.getTime() + istOffset);
    
    // Format date as YYYY-MM-DD in IST
    const year = istTime.getUTCFullYear();
    const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(istTime.getUTCDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    // Format timestamp as YYYY-MM-DD HH:MM:SS in IST
    const hours = String(istTime.getUTCHours()).padStart(2, '0');
    const minutes = String(istTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(istTime.getUTCSeconds()).padStart(2, '0');
    const logoutTimestamp = `${dateStr} ${hours}:${minutes}:${seconds}`;

    const query = `
      UPDATE attendance
      SET logout_time = $1, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $2 AND date = $3
      RETURNING *
    `;

    const { rows } = await pool.query(query, [logoutTimestamp, req.user.id, dateStr]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No login record found for today' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get attendance history
router.get('/history', authenticate, async (req, res) => {
  try {
    const { user_id, start_date, end_date } = req.query;

    let query = `
      SELECT a.*, u.username as user_name
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
    const { date, login_time, logout_time, status } = req.body;

    // Get the existing record to get the date
    const existingQuery = 'SELECT date FROM attendance WHERE id = $1';
    const { rows: existingRows } = await pool.query(existingQuery, [id]);
    
    if (existingRows.length === 0) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    const recordDate = date || existingRows[0].date.toISOString().split('T')[0];

    // Convert time strings to timestamp format
    const loginTimestamp = login_time ? `${recordDate} ${login_time}:00` : null;
    const logoutTimestamp = logout_time ? `${recordDate} ${logout_time}:00` : null;

    const query = `
      UPDATE attendance
      SET login_time = $1, logout_time = $2, status = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `;

    const { rows } = await pool.query(query, [loginTimestamp, logoutTimestamp, status, id]);

    res.json(rows[0]);
  } catch (error) {
    console.error('Update attendance error:', error);
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

// Upload attendance from Excel file
router.post('/upload-excel', authenticate, authorize('sysadmin', 'admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    console.log('Processing file:', req.file.originalname);

    // Parse Excel or CSV file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log('Total rows to process:', data.length);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        console.log(`Processing row ${i + 1}:`, row);

        // Expected columns: email/username, date, login_time, logout_time, status
        let { email, username, date, login_time, logout_time, status } = row;

        if (!email && !username) {
          throw new Error('Email or username is required');
        }

        // Convert Excel date number to proper date format
        date = excelDateToJSDate(date);
        console.log(`Converted date: ${date}`);

        // Find user by email or username
        const userQuery = `
          SELECT id FROM users 
          WHERE email = $1 OR username = $2
          LIMIT 1
        `;
        const { rows: userRows } = await pool.query(userQuery, [email || '', username || '']);

        if (userRows.length === 0) {
          throw new Error(`User not found: ${email || username}`);
        }

        const userId = userRows[0].id;
        console.log(`Found user ID: ${userId}`);

        const loginTimestamp = login_time ? `${date} ${login_time}:00` : null;
        const logoutTimestamp = logout_time ? `${date} ${logout_time}:00` : null;

        console.log(`Login: ${loginTimestamp}, Logout: ${logoutTimestamp}, Status: ${status || 'present'}`);

        // Insert or update attendance
        const query = `
          INSERT INTO attendance (user_id, date, login_time, logout_time, status, marked_by)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (user_id, date) 
          DO UPDATE SET 
            login_time = EXCLUDED.login_time,
            logout_time = EXCLUDED.logout_time,
            status = EXCLUDED.status,
            marked_by = EXCLUDED.marked_by,
            updated_at = CURRENT_TIMESTAMP
        `;

        await pool.query(query, [
          userId,
          date,
          loginTimestamp,
          logoutTimestamp,
          status || 'present',
          req.user.id
        ]);

        successCount++;
        console.log(`Row ${i + 1} processed successfully`);
      } catch (error) {
        console.error(`Error processing row ${i + 1}:`, error.message);
        errors.push({
          row: i + 1,
          data: row,
          error: error.message
        });
        errorCount++;
      }
    }

    console.log(`Processing complete: ${successCount} success, ${errorCount} errors`);

    res.json({
      message: 'File processed',
      successCount,
      errorCount,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined // Limit to first 10 errors
    });
  } catch (error) {
    console.error('Excel upload error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
