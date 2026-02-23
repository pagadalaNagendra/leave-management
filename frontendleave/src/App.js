import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UserManagement from './pages/UserManagement';
import LeaveRequests from './pages/LeaveRequests';
import Attendance from './pages/Attendance';
import Layout from './components/Layout';

const PrivateRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!user) return <Navigate to="/login" />;

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" />;
  }

  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/leavemanagement">
        <Routes>
          {/* Main landing */}
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />

          {/* Login */}
          <Route path="/login" element={<Login />} />

          {/* User Management (protected) */}
          <Route path="/users" element={<PrivateRoute roles={['sysadmin', 'admin']}><UserManagement /></PrivateRoute>} />

          {/* Leave Requests (protected) */}
          <Route path="/leaves" element={<PrivateRoute><LeaveRequests /></PrivateRoute>} />

          {/* Attendance (protected) */}
          <Route path="/attendance" element={<PrivateRoute><Attendance /></PrivateRoute>} />

          {/* Everything else */}
          <Route path="/*" element={<PrivateRoute><Dashboard /></PrivateRoute>} />

          {/* Optional fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ToastContainer position="top-right" autoClose={3000} />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
