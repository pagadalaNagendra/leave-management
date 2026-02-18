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
  
  if (!user) return <Navigate to="/leavemanagement/login" />;
  
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" />;
  }

  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/leavemanagement/login" element={<Login />} />
          <Route path="/leavemanagement/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/leavemanagement/users" element={<PrivateRoute roles={['sysadmin', 'admin']}><UserManagement /></PrivateRoute>} />
          <Route path="/leavemanagement/leaves" element={<PrivateRoute><LeaveRequests /></PrivateRoute>} />
          <Route path="/leavemanagement/attendance" element={<PrivateRoute><Attendance /></PrivateRoute>} />
          <Route path="/leavemanagement" element={<Navigate to="/leavemanagement/dashboard" />} />
        </Routes>
        <ToastContainer position="top-right" autoClose={3000} />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
