const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const initializeDatabase = require('./utils/initDatabase');
const initializeSysAdmin = require('./utils/initSysAdmin');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/leaves', require('./routes/leaves'));
app.use('/api/attendance', require('./routes/attendance'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

const PORT = process.env.PORT || 5002;
const HTTPS_PORT = process.env.HTTPS_PORT || 5443;

// SSL Configuration
const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'iiit.ac.in.key')),
  cert: fs.readFileSync(path.join(__dirname, 'iiit.ac.in.pem'))
};

// Initialize database, sysadmin and start server
const startServer = async () => {
  try {
    await initializeDatabase();
    await initializeSysAdmin();
    
    // Start HTTPS server
    https.createServer(sslOptions, app).listen(HTTPS_PORT, () => {
      console.log(`🔒 HTTPS Server running on port ${HTTPS_PORT}`);
      console.log(`🌐 Server accessible at https://smartcitylivinglab.iiit.ac.in:${HTTPS_PORT}`);
    });
    
    // Optionally keep HTTP server for development/health checks
    app.listen(PORT, () => {
      console.log(`🚀 HTTP Server running on port ${PORT}`);
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
