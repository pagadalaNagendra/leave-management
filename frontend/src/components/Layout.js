import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

const Layout = ({ children }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [showNotifications, setShowNotifications] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const toggleSidebar = () => {
        setSidebarOpen(!sidebarOpen);
    };

    const isActive = (path) => {
        return location.pathname === path ? 'active' : '';
    };

    return (
        <div className="layout">
            {/* Top Navbar */}
            <nav className="top-navbar">
                <div className="navbar-left">
                    <button className="hamburger" onClick={toggleSidebar}>
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>
                    <div className="logos">
                        <div className="logo-primary">LM</div>
                        <div className="logo-secondary">AS</div>
                    </div>
                </div>

                <div className="navbar-center">
                    <h1 className="app-title">Leave Management & Attendance System</h1>
                </div>

                <div className="navbar-right">
                    <div className="notification-wrapper">
                        <button
                            className="icon-btn notification-btn"
                            onClick={() => setShowNotifications(!showNotifications)}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                            </svg>
                            <span className="notification-badge">3</span>
                        </button>
                        {showNotifications && (
                            <div className="notification-dropdown">
                                <div className="notification-header">Notifications</div>
                                <div className="notification-item">New leave request pending</div>
                                <div className="notification-item">Attendance marked successfully</div>
                                <div className="notification-item">Leave request approved</div>
                            </div>
                        )}
                    </div>

                    <div className="profile-info">
                        <div className="profile-icon">
                            {user?.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="profile-details">
                            <span className="profile-name">{user?.full_name}</span>
                            <span className="profile-role">{user?.role}</span>
                        </div>
                    </div>

                    <button className="btn-logout" onClick={handleLogout}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                        Logout
                    </button>
                </div>
            </nav>

            {/* Sidebar */}
            <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                <nav className="sidebar-nav">
                    <Link
                        to="/dashboard"
                        className={`nav-item ${isActive('/dashboard')}`}
                        title="Dashboard"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="7" height="7"></rect>
                            <rect x="14" y="3" width="7" height="7"></rect>
                            <rect x="14" y="14" width="7" height="7"></rect>
                            <rect x="3" y="14" width="7" height="7"></rect>
                        </svg>
                        <span className="nav-text">Dashboard</span>
                    </Link>

                    {(user?.role === 'sysadmin' || user?.role === 'admin') && (
                        <Link
                            to="/users"
                            className={`nav-item ${isActive('/users')}`}
                            title="User Management"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                            <span className="nav-text">User Management</span>
                        </Link>
                    )}

                    <Link
                        to="/leaves"
                        className={`nav-item ${isActive('/leaves')}`}
                        title="Leave Requests"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        <span className="nav-text">Leave Requests</span>
                    </Link>

                    <Link
                        to="/attendance"
                        className={`nav-item ${isActive('/attendance')}`}
                        title="Attendance"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        <span className="nav-text">Attendance</span>
                    </Link>
                </nav>
            </div>

            {/* Overlay */}
            {sidebarOpen && <div className="overlay" onClick={toggleSidebar}></div>}

            {/* Main Content */}
            <main className={`main-content ${sidebarOpen ? 'sidebar-open' : ''}`}>{children}</main>
        </div>
    );
};

export default Layout;
