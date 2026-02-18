import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { leaveAPI } from '../services/api';
import './Layout.css';

const Layout = ({ children }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState([]);

    const handleLogout = () => {
        logout();
        navigate('/leavemanagement/login');
    };

    const toggleSidebar = () => {
        setSidebarOpen(!sidebarOpen);
    };

    const isActive = (path) => {
        return location.pathname === path ? 'active' : '';
    };

    useEffect(() => {
        fetchNotifications();
        // Refresh notifications every 30 seconds
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, [user]);

    const fetchNotifications = async () => {
        try {
            const { data } = await leaveAPI.getAll();

            // Get read notifications from localStorage
            const readNotifications = JSON.parse(localStorage.getItem('readNotifications') || '[]');

            // For admin/sysadmin: show recent pending requests
            if (user?.role === 'sysadmin' || user?.role === 'admin') {
                const pendingRequests = data
                    .filter(leave => leave.status === 'pending')
                    .filter(leave => !readNotifications.includes(leave.id))
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                    .slice(0, 5);

                setNotifications(pendingRequests.map(leave => ({
                    id: leave.id,
                    message: `${leave.user_name} requested ${leave.leave_type} leave`,
                    date: leave.created_at,
                    type: 'pending',
                    leaveId: leave.id
                })));
            } else {
                // For users: show their recent requests and status updates
                const userRequests = data
                    .filter(leave => leave.user_id === user?.id)
                    .filter(leave => !readNotifications.includes(leave.id))
                    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
                    .slice(0, 5);

                setNotifications(userRequests.map(leave => ({
                    id: leave.id,
                    message: leave.status === 'pending'
                        ? `Your ${leave.leave_type} leave request is pending`
                        : `Your ${leave.leave_type} leave was ${leave.status}`,
                    date: leave.updated_at,
                    type: leave.status,
                    leaveId: leave.id
                })));
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    };

    const handleNotificationClick = (leaveId) => {
        setShowNotifications(false);
        navigate('/leavemanagement/leaves');
    };

    const markAsRead = (notificationId, event) => {
        event.stopPropagation();

        // Get existing read notifications
        const readNotifications = JSON.parse(localStorage.getItem('readNotifications') || '[]');

        // Add this notification to read list
        if (!readNotifications.includes(notificationId)) {
            readNotifications.push(notificationId);
            localStorage.setItem('readNotifications', JSON.stringify(readNotifications));
        }

        // Remove from current notifications
        setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
    };

    const markAllAsRead = () => {
        // Get existing read notifications
        const readNotifications = JSON.parse(localStorage.getItem('readNotifications') || '[]');

        // Add all current notifications to read list
        notifications.forEach(notif => {
            if (!readNotifications.includes(notif.id)) {
                readNotifications.push(notif.id);
            }
        });

        localStorage.setItem('readNotifications', JSON.stringify(readNotifications));
        setNotifications([]);
        setShowNotifications(false);
    };

    const formatTimeAgo = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
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
                        <img
                            src="https://ctop.iiit.ac.in/static/media/iiithlogo_white.41d3c101439124b07ef0.png"
                            alt="IIIT Hyderabad Logo"
                            className="logo-img logo-secondary-img"
                        />
                        <img
                            src="https://ctop.iiit.ac.in/static/media/scrclogo.1d3166a27968c4078cbf.png"
                            alt="SCRC Logo"
                            className="logo-img logo-primary-img"
                        />
                    </div>
                </div>

                <div className="navbar-center">
                    <h1 className="app-title">Leave & Attendance Management System</h1>
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
                            {notifications.length > 0 && (
                                <span className="notification-badge">{notifications.length}</span>
                            )}
                        </button>
                        {showNotifications && (
                            <div className="notification-dropdown">
                                <div className="notification-header">
                                    <span>Recent Notifications
                                        {notifications.length > 0 && (
                                            <span className="notification-count"> ({notifications.length})</span>
                                        )}
                                    </span>

                                </div>
                                <div className="notification-list">
                                    {notifications.length > 0 ? (
                                        notifications.map((notif) => (
                                            <div
                                                key={notif.id}
                                                className={`notification-item ${notif.type}`}
                                            >
                                                <div
                                                    className="notification-content"
                                                    onClick={() => handleNotificationClick(notif.leaveId)}
                                                >
                                                    <span className="notification-message">{notif.message}</span>
                                                    <span className="notification-time">{formatTimeAgo(notif.date)}</span>
                                                </div>
                                                <div className="notification-actions">
                                                    <div className={`notification-indicator ${notif.type}`}></div>
                                                    <button
                                                        className="mark-read-btn-single"
                                                        onClick={(e) => markAsRead(notif.id, e)}
                                                        title="Mark as read"
                                                    >
                                                        Mark as Read
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="notification-empty">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <circle cx="12" cy="12" r="10"></circle>
                                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                            </svg>
                                            <p>No notifications</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="profile-info">
                        <div className="profile-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                        </div>
                        <div className="profile-details-hover">
                            <span className="profile-name">{user?.full_name}</span>
                            <span className="profile-role">{user?.role}</span>
                        </div>
                    </div>

                    <button className="btn-logout" onClick={handleLogout} title="Logout">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                    </button>
                </div>
            </nav>

            {/* Sidebar */}
            <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                <nav className="sidebar-nav">
                    <Link
                        to="/leavemanagement/dashboard"
                        className={`nav-item ${isActive('/leavemanagement/dashboard')}`}
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

                    <Link
                        to="/leavemanagement/leaves"
                        className={`nav-item ${isActive('/leavemanagement/leaves')}`}
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
                        to="/leavemanagement/attendance"
                        className={`nav-item ${isActive('/leavemanagement/attendance')}`}
                        title="Attendance"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        <span className="nav-text">Attendance</span>
                    </Link>


                    {(user?.role === 'sysadmin' || user?.role === 'admin') && (
                        <Link
                            to="/leavemanagement/users"
                            className={`nav-item ${isActive('/leavemanagement/users')}`}
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
