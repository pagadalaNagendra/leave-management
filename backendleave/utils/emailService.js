const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const sendWelcomeEmail = async (userEmail, username, password, fullName) => {
    try {
        const mailOptions = {
            from: `"Leave Management System" <${process.env.SMTP_USER}>`,
            to: userEmail,
            subject: 'Welcome to Leave Management & Attendance System',
            html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .credentials { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #667eea; }
            .credentials p { margin: 10px 0; }
            .credentials strong { color: #667eea; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 20px; color: #777; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Leave Management System</h1>
            </div>
            <div class="content">
              <h2>Dear ${fullName},</h2>
              <p>Your account has been created successfully! You can now access the Leave Management & Attendance System.</p>
              
              <div class="credentials">
                <h3>Your Login Credentials:</h3>
                <p><strong>Username:</strong> ${username}</p>
                <p><strong>Email:</strong> ${userEmail}</p>
                <p><strong>Password:</strong> ${password}</p>
                <p><strong>Platform URL:</strong> <a href="${process.env.APP_URL}">${process.env.APP_URL}</a></p>
              </div>
              
              <p><strong>Important:</strong> Please change your password after your first login for security purposes.</p>
              
              <a href="${process.env.APP_URL}/login" class="button">Login to Your Account</a>
              
              <div class="footer">
                <p>This is an automated email. Please do not reply to this message.</p>
                <p>If you have any questions, please contact your administrator.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
        };

        await transporter.sendMail(mailOptions);
        console.log(`✉️ Welcome email sent to ${userEmail}`);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
};

const formatDate = (dateInput) => {
    console.log('Formatting date input:', dateInput, 'Type:', typeof dateInput);
    
    let dateStr;
    if (dateInput instanceof Date) {
        // If it's a Date object, get YYYY-MM-DD
        const year = dateInput.getFullYear();
        const month = String(dateInput.getMonth() + 1).padStart(2, '0');
        const day = String(dateInput.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
    } else if (typeof dateInput === 'string') {
        // If it's already a string, extract date part
        dateStr = dateInput.split('T')[0];
    } else {
        console.error('Invalid date input:', dateInput);
        return 'Invalid Date';
    }
    
    const [year, month, day] = dateStr.split('-');
    console.log('Formatted result:', `${day}/${month}/${year}`);
    return `${day}/${month}/${year}`; // DD/MM/YYYY format
};

const sendLeaveRequestNotification = async (leaveRequest, userName, userEmail) => {
    try {
        const { id, start_date, end_date, leave_type, reason } = leaveRequest;
        const approveLink = `${process.env.BACKEND_URL}/api/leaves/${id}/quick-action?action=approved&token=${generateToken(id)}`;
        const rejectLink = `${process.env.BACKEND_URL}/api/leaves/${id}/quick-action?action=rejected&token=${generateToken(id)}`;

        const mailOptions = {
            from: `"Leave Management System" <${process.env.SMTP_USER}>`,
            to: process.env.ADMIN_EMAIL,
            subject: `New Leave Request from ${userName}`,
            html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.5; color: #333; margin: 0; padding: 0; }
            .container { max-width: 550px; margin: 0 auto; padding: 15px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; text-align: center; border-radius: 6px 6px 0 0; }
            .header h1 { margin: 0; font-size: 1.3rem; }
            .content { background: #fff; padding: 20px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 6px 6px; }
            .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
            .info-row:last-child { border-bottom: none; }
            .info-label { color: #666; font-size: 0.85rem; font-weight: 500; }
            .info-value { color: #333; font-size: 0.85rem; font-weight: 600; }
            .reason-box { background: #f8f9fa; padding: 10px; border-radius: 4px; margin: 10px 0; border-left: 3px solid #667eea; }
            .reason-box .label { color: #666; font-size: 0.8rem; margin-bottom: 5px; }
            .reason-box .text { color: #333; font-size: 0.85rem; margin: 0; }
            .action-buttons { text-align: center; margin: 20px 0 10px 0; }
            .button { display: inline-block; padding: 10px 24px; margin: 0 6px; text-decoration: none; border-radius: 4px; font-weight: 600; font-size: 0.9rem; }
            .approve-btn { background: #2ecc71; color: white; }
            .reject-btn { background: #e74c3c; color: white; }
            .footer { text-align: center; margin-top: 15px; color: #999; font-size: 0.75rem; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📋 New Leave Request</h1>
            </div>
            <div class="content">
              <div class="info-row">
                <span class="info-label">Employee</span>
                <span class="info-value">${userName}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Email</span>
                <span class="info-value">${userEmail}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Leave Type</span>
                <span class="info-value">${leave_type}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Start Date</span>
                <span class="info-value">${formatDate(start_date)}</span>
              </div>
              <div class="info-row">
                <span class="info-label">End Date</span>
                <span class="info-value">${formatDate(end_date)}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Duration</span>
                <span class="info-value">${Math.ceil((new Date(end_date) - new Date(start_date)) / (1000 * 60 * 60 * 24)) + 1} days</span>
              </div>
              
              <div class="reason-box">
                <div class="label">Reason:</div>
                <p class="text">${reason}</p>
              </div>
              
              <div class="action-buttons">
                <a href="${approveLink}" class="button approve-btn">✓ Approve</a>
                <a href="${rejectLink}" class="button reject-btn">✗ Reject</a>
              </div>
              
              <div class="footer">
                <p>Leave Management System - Automated Notification</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
        };

        await transporter.sendMail(mailOptions);
        console.log(`✉️ Leave request notification sent to ${process.env.ADMIN_EMAIL}`);
        return true;
    } catch (error) {
        console.error('Error sending leave notification email:', error);
        return false;
    }
};

const generateToken = (leaveId) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign({ leaveId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const sendLeaveStatusUpdateEmail = async (userEmail, userName, leaveRequest, status, remarks, approverName, originalDates) => {
    try {
        const { start_date, end_date, leave_type, reason } = leaveRequest;
        const isApproved = status === 'approved';
        const datesModified = originalDates && (
            originalDates.start_date !== new Date(start_date).toISOString().split('T')[0] ||
            originalDates.end_date !== new Date(end_date).toISOString().split('T')[0]
        );

        const mailOptions = {
            from: `"Leave Management System" <${process.env.SMTP_USER}>`,
            to: userEmail,
            subject: `Leave Request ${isApproved ? 'Approved' : 'Rejected'}`,
            html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 1.3rem; }
            .content { background: #fff; padding: 20px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 6px 6px; }
            .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
            .info-row:last-child { border-bottom: none; }
            .info-label { color: #666; font-size: 0.85rem; font-weight: 500; }
            .info-value { color: #333; font-size: 0.85rem; font-weight: 600; }
            .reason-box { background: #f8f9fa; padding: 10px; border-radius: 4px; margin: 10px 0; border-left: 3px solid #667eea; }
            .reason-box .label { color: #666; font-size: 0.8rem; margin-bottom: 5px; }
            .reason-box .text { color: #333; font-size: 0.85rem; margin: 0; }
            .action-buttons { text-align: center; margin: 20px 0 10px 0; }
            .button { display: inline-block; padding: 10px 24px; margin: 0 6px; text-decoration: none; border-radius: 4px; font-weight: 600; font-size: 0.9rem; }
            .approve-btn { background: #2ecc71; color: white; }
            .reject-btn { background: #e74c3c; color: white; }
            .footer { text-align: center; margin-top: 15px; color: #999; font-size: 0.75rem; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Leave Request ${isApproved ? 'Approved' : 'Rejected'}</h1>
            </div>
            <div class="content">
              <div class="status-icon">${isApproved ? '✓' : '✗'}</div>
              <p>Dear ${userName},</p>
              <p>Your leave request has been <strong>${status}</strong> by ${approverName}.</p>
              
              ${datesModified ? `
                <div class="modified-dates">
                  <h4 style="margin-top: 0; color: #1976d2;">⚠️ Dates Modified by Approver</h4>
                  <div class="date-comparison">
                    <div class="date-box">
                      <div class="date-label">Originally Requested:</div>
                      <strong>${formatDate(originalDates.start_date)} - ${formatDate(originalDates.end_date)}</strong>
                    </div>
                    <div class="date-box">
                      <div class="date-label">Approved Dates:</div>
                      <strong>${formatDate(start_date)} - ${formatDate(end_date)}</strong>
                    </div>
                  </div>
                </div>
              ` : ''}
              
              <div class="details">
                <h3>Leave Request Details:</h3>
                <p><strong>Leave Type:</strong> ${leave_type}</p>
                <p><strong>Start Date:</strong> ${formatDate(start_date)}</p>
                <p><strong>End Date:</strong> ${formatDate(end_date)}</p>
                <p><strong>Duration:</strong> ${Math.ceil((new Date(end_date) - new Date(start_date)) / (1000 * 60 * 60 * 24)) + 1} days</p>
                <p><strong>Your Reason:</strong> ${reason}</p>
              </div>
              
              ${remarks ? `
                <div class="remarks-box">
                  <h4 style="margin-top: 0; color: #856404;">Remarks from Approver:</h4>
                  <p style="margin-bottom: 0;">${remarks}</p>
                </div>
              ` : ''}
              
              <p style="margin-top: 20px;">You can view your leave history by logging into the system.</p>
              
              <div class="footer">
                <p>This is an automated email from Leave Management System.</p>
                <p>If you have any questions, please contact your administrator.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
        };

        await transporter.sendMail(mailOptions);
        console.log(`✉️ Leave status update email sent to ${userEmail}`);
        return true;
    } catch (error) {
        console.error('Error sending status update email:', error);
        return false;
    }
};

module.exports = { sendWelcomeEmail, sendLeaveRequestNotification, sendLeaveStatusUpdateEmail };
