const express = require('express');
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { sendLeaveRequestNotification, sendLeaveStatusUpdateEmail } = require('../utils/emailService');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Get all leave requests (with filtering)
router.get('/', authenticate, async (req, res) => {
  try {
    let query = `
      SELECT lr.*, u.full_name as user_name, a.full_name as approver_name
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      LEFT JOIN users a ON lr.approved_by = a.id
    `;
    
    const params = [];
    
    // Users see only their requests
    if (req.user.role_name === 'user') {
      query += ' WHERE lr.user_id = $1';
      params.push(req.user.id);
    }
    
    query += ' ORDER BY lr.created_at DESC';
    
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create leave request
router.post('/', authenticate, async (req, res) => {
  try {
    const { start_date, end_date, leave_type, reason } = req.body;
    
    const query = `
      INSERT INTO leave_requests (user_id, start_date, end_date, leave_type, reason)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [
      req.user.id, start_date, end_date, leave_type, reason
    ]);
    
    // Send notification email to admin
    await sendLeaveRequestNotification(rows[0], req.user.full_name, req.user.email);
    
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Approve/Reject leave request
router.patch('/:id/status', authenticate, authorize('sysadmin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks, start_date, end_date } = req.body;
    
    // Get original dates before update - use DATE() to get only date part
    const originalQuery = 'SELECT start_date::date as start_date, end_date::date as end_date FROM leave_requests WHERE id = $1';
    const { rows: originalRows } = await pool.query(originalQuery, [id]);
    const originalDates = originalRows[0] ? {
      start_date: originalRows[0].start_date,
      end_date: originalRows[0].end_date
    } : null;
    
    console.log('Original dates from DB:', originalDates);
    console.log('New dates from request:', { start_date, end_date });
    
    const query = `
      UPDATE leave_requests
      SET status = $1, approved_by = $2, approved_at = CURRENT_TIMESTAMP, 
          remarks = $3, start_date = $4, end_date = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *, start_date::date as start_date_only, end_date::date as end_date_only
    `;
    
    const { rows } = await pool.query(query, [
      status, req.user.id, remarks || null, start_date, end_date, id
    ]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    // Get user details
    const userQuery = `
      SELECT u.email, u.full_name 
      FROM users u
      WHERE u.id = $1
    `;
    const { rows: userRows } = await pool.query(userQuery, [rows[0].user_id]);
    
    // Send email notification to user with properly formatted dates
    if (userRows.length > 0) {
      await sendLeaveStatusUpdateEmail(
        userRows[0].email,
        userRows[0].full_name,
        {
          ...rows[0],
          start_date: rows[0].start_date_only,
          end_date: rows[0].end_date_only
        },
        status,
        remarks,
        req.user.full_name,
        originalDates
      );
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error in status update:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update leave request (admin and sysadmin can edit)
router.put('/:id', authenticate, authorize('sysadmin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date, leave_type, reason } = req.body;
    
    const query = `
      UPDATE leave_requests
      SET start_date = $1, end_date = $2, leave_type = $3, reason = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [start_date, end_date, leave_type, reason, id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Leave request not found' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete leave request (sysadmin only)
router.delete('/:id', authenticate, authorize('sysadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM leave_requests WHERE id = $1', [id]);
    res.json({ message: 'Leave request deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Quick action from email (approve/reject)
router.get('/:id/quick-action', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, token, remarks } = req.query;

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.leaveId !== parseInt(id)) {
      return res.status(403).send('<h1>Invalid or expired link</h1>');
    }

    // If rejecting and no remarks provided, show remarks form
    if (action === 'rejected' && !remarks) {
      const remarksFormHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
            .container { background: white; padding: 2.5rem; border-radius: 10px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2); max-width: 500px; width: 90%; }
            h1 { color: #e74c3c; margin-bottom: 1rem; }
            p { color: #555; margin-bottom: 1.5rem; }
            textarea { width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px; font-family: inherit; resize: vertical; min-height: 100px; margin-bottom: 1rem; }
            .buttons { display: flex; gap: 1rem; }
            button { flex: 1; padding: 0.75rem; border: none; border-radius: 4px; font-size: 1rem; cursor: pointer; font-weight: bold; }
            .btn-submit { background: #e74c3c; color: white; }
            .btn-submit:hover { background: #c0392b; }
            .btn-cancel { background: #95a5a6; color: white; }
            .btn-cancel:hover { background: #7f8c8d; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Reject Leave Request</h1>
            <p>Please provide a reason for rejecting this leave request:</p>
            <form method="GET" action="/api/leaves/${id}/quick-action">
              <input type="hidden" name="action" value="rejected">
              <input type="hidden" name="token" value="${token}">
              <textarea name="remarks" placeholder="Enter remarks for rejection..." required></textarea>
              <div class="buttons">
                <button type="submit" class="btn-submit">Submit Rejection</button>
                <button type="button" class="btn-cancel" onclick="window.close()">Cancel</button>
              </div>
            </form>
          </div>
        </body>
        </html>
      `;
      return res.send(remarksFormHtml);
    }

    // Get admin user
    const adminQuery = `
      SELECT u.id, u.full_name FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE r.name = 'sysadmin'
      LIMIT 1
    `;
    const { rows: adminRows } = await pool.query(adminQuery);
    const adminId = adminRows[0]?.id || 1;
    const adminName = adminRows[0]?.full_name || 'Administrator';

    // Update leave request status
    const updateQuery = `
      UPDATE leave_requests
      SET status = $1, approved_by = $2, approved_at = CURRENT_TIMESTAMP, remarks = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `;
    
    const { rows } = await pool.query(updateQuery, [action, adminId, remarks || null, id]);
    
    if (rows.length === 0) {
      return res.status(404).send('<h1>Leave request not found</h1>');
    }

    // Get user details and send notification
    const userQuery = `
      SELECT u.email, u.full_name 
      FROM users u
      WHERE u.id = $1
    `;
    const { rows: userRows } = await pool.query(userQuery, [rows[0].user_id]);
    
    if (userRows.length > 0) {
      await sendLeaveStatusUpdateEmail(
        userRows[0].email,
        userRows[0].full_name,
        rows[0],
        action,
        remarks,
        adminName
      );
    }

    // Send success response
    const successHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
          .container { background: white; padding: 3rem; border-radius: 10px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
          h1 { color: ${action === 'approved' ? '#2ecc71' : '#e74c3c'}; margin-bottom: 1rem; }
          p { color: #555; font-size: 1.1rem; }
          .icon { font-size: 4rem; margin-bottom: 1rem; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">${action === 'approved' ? '✓' : '✗'}</div>
          <h1>Leave Request ${action === 'approved' ? 'Approved' : 'Rejected'}</h1>
          <p>The leave request has been successfully ${action}.</p>
          ${remarks ? `<p style="margin-top: 1rem; color: #777; font-size: 0.9rem;">Remarks: ${remarks}</p>` : ''}
          <p style="margin-top: 2rem; color: #777; font-size: 0.9rem;">You can close this window now.</p>
        </div>
      </body>
      </html>
    `;
    
    res.send(successHtml);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(403).send('<h1>This link has expired</h1>');
    }
    res.status(500).send('<h1>An error occurred</h1>');
  }
});

// Quick action with date editing
router.post('/:id/quick-action', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, token, remarks, start_date, end_date } = req.body;

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.leaveId !== parseInt(id)) {
      return res.status(403).send('<h1>Invalid or expired link</h1>');
    }

    // Get current leave request data
    const currentLeaveQuery = 'SELECT * FROM leave_requests WHERE id = $1';
    const { rows: currentLeave } = await pool.query(currentLeaveQuery, [id]);
    
    if (currentLeave.length === 0) {
      return res.status(404).send('<h1>Leave request not found</h1>');
    }

    const leaveData = currentLeave[0];
    const originalDates = {
      start_date: leaveData.start_date.toISOString().split('T')[0],
      end_date: leaveData.end_date.toISOString().split('T')[0]
    };

    // Get admin user
    const adminQuery = `
      SELECT u.id, u.full_name FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE r.name = 'sysadmin'
      LIMIT 1
    `;
    const { rows: adminRows } = await pool.query(adminQuery);
    const adminId = adminRows[0]?.id || 1;
    const adminName = adminRows[0]?.full_name || 'Administrator';

    // Update leave request status and dates
    const updateQuery = `
      UPDATE leave_requests
      SET status = $1, approved_by = $2, approved_at = CURRENT_TIMESTAMP, 
          remarks = $3, start_date = $4, end_date = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `;
    
    const { rows } = await pool.query(updateQuery, [
      action, 
      adminId, 
      remarks || null, 
      start_date || leaveData.start_date,
      end_date || leaveData.end_date,
      id
    ]);

    // Get user details and send notification
    const userQuery = `
      SELECT u.email, u.full_name 
      FROM users u
      WHERE u.id = $1
    `;
    const { rows: userRows } = await pool.query(userQuery, [rows[0].user_id]);
    
    if (userRows.length > 0) {
      await sendLeaveStatusUpdateEmail(
        userRows[0].email,
        userRows[0].full_name,
        rows[0],
        action,
        remarks,
        adminName,
        originalDates
      );
    }

    // Send success response
    const successHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
          .container { background: white; padding: 3rem; border-radius: 10px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
          h1 { color: ${action === 'approved' ? '#2ecc71' : '#e74c3c'}; margin-bottom: 1rem; }
          p { color: #555; font-size: 1.1rem; }
          .icon { font-size: 4rem; margin-bottom: 1rem; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">${action === 'approved' ? '✓' : '✗'}</div>
          <h1>Leave Request ${action === 'approved' ? 'Approved' : 'Rejected'}</h1>
          <p>The leave request has been successfully ${action}.</p>
          ${remarks ? `<p style="margin-top: 1rem; color: #777; font-size: 0.9rem;">Remarks: ${remarks}</p>` : ''}
          <p style="margin-top: 2rem; color: #777; font-size: 0.9rem;">You can close this window now.</p>
        </div>
      </body>
      </html>
    `;
    
    res.send(successHtml);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(403).send('<h1>This link has expired</h1>');
    }
    res.status(500).send('<h1>An error occurred</h1>');
  }
});

// Quick action GET - show approval form
router.get('/:id/quick-action', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, token } = req.query;

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.leaveId !== parseInt(id)) {
      return res.status(403).send('<h1>Invalid or expired link</h1>');
    }

    // Get leave request details with user info
    const leaveQuery = `
      SELECT lr.*, u.full_name as user_name, u.email as user_email
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      WHERE lr.id = $1
    `;
    const { rows: leaveRows } = await pool.query(leaveQuery, [id]);
    
    if (leaveRows.length === 0) {
      return res.status(404).send('<h1>Leave request not found</h1>');
    }

    const leave = leaveRows[0];
    const formatDateForInput = (date) => {
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const formatDateForDisplay = (date) => {
      const d = new Date(date);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const requestedDays = Math.ceil((new Date(leave.end_date) - new Date(leave.start_date)) / (1000 * 60 * 60 * 24)) + 1;

    // Show form for both approve and reject
    const formHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; }
          .container { background: white; padding: 2rem; border-radius: 10px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); max-width: 600px; width: 100%; }
          h1 { color: ${action === 'approved' ? '#2ecc71' : '#e74c3c'}; margin-bottom: 1rem; text-align: center; }
          .leave-details { background: #f8f9fa; padding: 1.5rem; border-radius: 6px; margin-bottom: 1.5rem; }
          .leave-details h3 { margin-top: 0; color: #333; border-bottom: 2px solid #667eea; padding-bottom: 0.5rem; }
          .leave-details p { margin: 0.75rem 0; color: #555; }
          .leave-details strong { color: #333; }
          .original-dates-box { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 1rem; border-radius: 4px; margin-bottom: 1.5rem; }
          .original-dates-box h4 { margin: 0 0 0.5rem 0; color: #1976d2; font-size: 0.95rem; }
          .original-dates-box p { margin: 0; color: #555; font-size: 0.9rem; }
          .days-requested { background: #fff3cd; border-left: 4px solid #ffc107; padding: 1rem; border-radius: 4px; margin-bottom: 1rem; }
          .days-requested h4 { margin: 0 0 0.5rem 0; color: #856404; font-size: 0.95rem; }
          .days-count { font-size: 2rem; font-weight: bold; color: #856404; text-align: center; margin: 0.5rem 0; }
          label { display: block; margin-bottom: 0.3rem; color: #333; font-weight: 500; font-size: 0.9rem; }
          input, textarea { width: 100%; padding: 0.6rem; border: 1px solid #ddd; border-radius: 4px; font-family: inherit; margin-bottom: 1rem; box-sizing: border-box; }
          textarea { resize: vertical; min-height: 80px; }
          .date-group { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
          .info-text { background: #d1ecf1; border-left: 4px solid #17a2b8; padding: 0.75rem; border-radius: 4px; margin-bottom: 1rem; font-size: 0.85rem; color: #0c5460; }
          .calculated-days { background: #d4edda; border-left: 4px solid #28a745; padding: 0.75rem; border-radius: 4px; margin-bottom: 1rem; text-align: center; }
          .calculated-days span { font-size: 1.5rem; font-weight: bold; color: #155724; }
          .buttons { display: flex; gap: 1rem; margin-top: 1.5rem; }
          button { flex: 1; padding: 0.75rem; border: none; border-radius: 4px; font-size: 1rem; cursor: pointer; font-weight: bold; }
          .btn-submit { background: ${action === 'approved' ? '#2ecc71' : '#e74c3c'}; color: white; }
          .btn-submit:hover { background: ${action === 'approved' ? '#27ae60' : '#c0392b'}; }
          .btn-cancel { background: #95a5a6; color: white; }
          .btn-cancel:hover { background: #7f8c8d; }
        </style>
        <script>
          function calculateDays() {
            const startDate = document.getElementById('start_date').value;
            const endDate = document.getElementById('end_date').value;
            
            if (startDate && endDate) {
              const start = new Date(startDate);
              const end = new Date(endDate);
              const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
              
              if (days > 0) {
                document.getElementById('calculated-days').innerHTML = 
                  '<span>' + days + ' day' + (days > 1 ? 's' : '') + '</span> will be approved';
                document.getElementById('calculated-days').style.display = 'block';
                
                const requestedDays = ${requestedDays};
                if (days < requestedDays) {
                  document.getElementById('calculated-days').style.borderColor = '#ffc107';
                  document.getElementById('calculated-days').style.background = '#fff3cd';
                  document.getElementById('calculated-days').querySelector('span').style.color = '#856404';
                  document.getElementById('calculated-days').innerHTML += 
                    '<br><small style="color: #856404;">(Less than ' + requestedDays + ' days requested)</small>';
                } else if (days > requestedDays) {
                  document.getElementById('calculated-days').style.borderColor = '#17a2b8';
                  document.getElementById('calculated-days').style.background = '#d1ecf1';
                  document.getElementById('calculated-days').querySelector('span').style.color = '#0c5460';
                  document.getElementById('calculated-days').innerHTML += 
                    '<br><small style="color: #0c5460;">(More than ' + requestedDays + ' days requested)</small>';
                } else {
                  document.getElementById('calculated-days').style.borderColor = '#28a745';
                  document.getElementById('calculated-days').style.background = '#d4edda';
                  document.getElementById('calculated-days').querySelector('span').style.color = '#155724';
                }
              }
            }
          }
          
          window.onload = function() {
            calculateDays();
            document.getElementById('start_date').addEventListener('change', calculateDays);
            document.getElementById('end_date').addEventListener('change', calculateDays);
          };
        </script>
      </head>
      <body>
        <div class="container">
          <h1>${action === 'approved' ? 'Approve' : 'Reject'} Leave Request</h1>
          
          <div class="leave-details">
            <h3>Employee Leave Request</h3>
            <p><strong>Employee:</strong> ${leave.user_name}</p>
            <p><strong>Email:</strong> ${leave.user_email}</p>
            <p><strong>Leave Type:</strong> ${leave.leave_type}</p>
            <p><strong>Reason:</strong> ${leave.reason}</p>
          </div>

          <div class="days-requested">
            <h4>📅 Days Requested by Employee:</h4>
            <div class="days-count">${requestedDays} days</div>
            <p style="text-align: center; margin: 0; font-size: 0.85rem;">
              ${formatDateForDisplay(leave.start_date)} to ${formatDateForDisplay(leave.end_date)}
            </p>
          </div>

          ${action === 'approved' ? 
            '<div class="info-text">💡 You can approve for fewer days by adjusting the dates below, or approve the full requested period.</div>' 
            : ''}

          <form method="POST" action="/api/leaves/${id}/quick-action">
            <input type="hidden" name="action" value="${action}">
            <input type="hidden" name="token" value="${token}">
            
            <div class="date-group">
              <div>
                <label>${action === 'approved' ? 'Approve' : 'Reject'} Start Date</label>
                <input type="date" id="start_date" name="start_date" value="${formatDateForInput(leave.start_date)}" required>
              </div>
              <div>
                <label>${action === 'approved' ? 'Approve' : 'Reject'} End Date</label>
                <input type="date" id="end_date" name="end_date" value="${formatDateForInput(leave.end_date)}" required>
              </div>
            </div>

            <div id="calculated-days" class="calculated-days" style="display: none;"></div>
            
            <label>Remarks ${action === 'rejected' ? '(Required)' : '(Optional - explain if approving fewer days)'}</label>
            <textarea name="remarks" placeholder="Enter remarks..." ${action === 'rejected' ? 'required' : ''}></textarea>
            
            <div class="buttons">
              <button type="submit" class="btn-submit">${action === 'approved' ? '✓ Approve' : '✗ Reject'}</button>
              <button type="button" class="btn-cancel" onclick="window.close()">Cancel</button>
            </div>
          </form>
        </div>
      </body>
      </html>
    `;
    
    res.send(formHtml);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(403).send('<h1>This link has expired</h1>');
    }
    console.error('Quick action error:', error);
    res.status(500).send('<h1>An error occurred</h1>');
  }
});

module.exports = router;
