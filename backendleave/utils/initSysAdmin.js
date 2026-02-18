const bcrypt = require('bcryptjs');
const pool = require('../config/database');

const initializeSysAdmin = async () => {
  try {
    // Check if sysadmin already exists
    const checkQuery = `
      SELECT u.* FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE r.name = 'sysadmin'
    `;
    const { rows } = await pool.query(checkQuery);

    if (rows.length === 0) {
      // Create sysadmin
      const hashedPassword = await bcrypt.hash(process.env.SYSADMIN_PASSWORD, 10);
      
      const insertQuery = `
        INSERT INTO users (username, email, password, full_name, role_id)
        VALUES ($1, $2, $3, $4, (SELECT id FROM roles WHERE name = 'sysadmin'))
        RETURNING *
      `;
      
      await pool.query(insertQuery, [
        process.env.SYSADMIN_USERNAME,
        process.env.SYSADMIN_EMAIL,
        hashedPassword,
        process.env.SYSADMIN_FULLNAME
      ]);

      console.log('✅ System Administrator created successfully');
      console.log(`Email: ${process.env.SYSADMIN_EMAIL}`);
      console.log(`Password: ${process.env.SYSADMIN_PASSWORD}`);
    } else {
      console.log('✅ System Administrator already exists');
    }
  } catch (error) {
    console.error('Error initializing sysadmin:', error);
  }
};

module.exports = initializeSysAdmin;
