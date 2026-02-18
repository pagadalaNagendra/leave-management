const pool = require('../config/database');

const initializeDatabase = async () => {
  try {
    console.log('🔧 Initializing database...');

    // Create roles table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        level INTEGER UNIQUE NOT NULL
      )
    `);

    // Insert default roles
    await pool.query(`
      INSERT INTO roles (name, level) VALUES 
        ('sysadmin', 1),
        ('admin', 2),
        ('user', 3)
      ON CONFLICT (name) DO NOTHING
    `);

    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        designation VARCHAR(100),
        role_id INTEGER REFERENCES roles(id) NOT NULL,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT true
      )
    `);

    // Add designation column if it doesn't exist (for existing tables)
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='users' AND column_name='designation'
    `;
    const { rows: columnCheck } = await pool.query(checkColumnQuery);
    
    if (columnCheck.length === 0) {
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN designation VARCHAR(100)
      `);
      console.log('✅ Designation column added to users table');
    }

    // Create leave_requests table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        leave_type VARCHAR(50) NOT NULL,
        reason TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        approved_by INTEGER REFERENCES users(id),
        approved_at TIMESTAMP,
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add remarks column if it doesn't exist (for existing tables)
    const checkRemarksColumn = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='leave_requests' AND column_name='remarks'
    `;
    const { rows: remarksCheck } = await pool.query(checkRemarksColumn);
    
    if (remarksCheck.length === 0) {
      await pool.query(`
        ALTER TABLE leave_requests 
        ADD COLUMN remarks TEXT
      `);
      console.log('✅ Remarks column added to leave_requests table');
    }

    // Create attendance table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) NOT NULL,
        date DATE NOT NULL,
        login_time TIMESTAMP,
        logout_time TIMESTAMP,
        marked_by INTEGER REFERENCES users(id),
        status VARCHAR(20) DEFAULT 'present',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date)
      )
    `);

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_leave_requests_user 
      ON leave_requests(user_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_leave_requests_status 
      ON leave_requests(status)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_attendance_user_date 
      ON attendance(user_id, date)
    `);

    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    throw error;
  }
};

module.exports = initializeDatabase;
