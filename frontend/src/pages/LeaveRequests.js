import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { leaveAPI } from '../services/api';
import { toast } from 'react-toastify';
import './LeaveRequests.css';

const LeaveRequests = () => {
    const { user } = useAuth();
    const [leaves, setLeaves] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [showApprovalModal, setShowApprovalModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [selectedLeaveId, setSelectedLeaveId] = useState(null);
    const [approvalAction, setApprovalAction] = useState('');
    const [approvalFormData, setApprovalFormData] = useState({
        start_date: '',
        end_date: '',
        remarks: '',
        original_start_date: '',
        original_end_date: ''
    });
    const [formData, setFormData] = useState({
        start_date: '',
        end_date: '',
        leave_type: 'sick',
        reason: '',
        status: '',
        remarks: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [processingId, setProcessingId] = useState(null);

    useEffect(() => {
        fetchLeaves();
    }, []);

    const fetchLeaves = async () => {
        try {
            const { data } = await leaveAPI.getAll();
            setLeaves(data);
        } catch (error) {
            toast.error('Failed to fetch leave requests');
        }
    };

    const handleEdit = (leave) => {
        setEditMode(true);
        setSelectedLeaveId(leave.id);
        setFormData({
            start_date: leave.start_date.split('T')[0],
            end_date: leave.end_date.split('T')[0],
            leave_type: leave.leave_type,
            reason: leave.reason,
            status: leave.status,
            remarks: leave.remarks || ''
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            if (editMode) {
                // Update leave details
                await leaveAPI.update(selectedLeaveId, {
                    start_date: formData.start_date,
                    end_date: formData.end_date,
                    leave_type: formData.leave_type,
                    reason: formData.reason
                });

                // Update status if changed (includes dates)
                await leaveAPI.updateStatus(selectedLeaveId, {
                    status: formData.status,
                    remarks: formData.remarks,
                    start_date: formData.start_date,
                    end_date: formData.end_date
                });

                toast.success('Leave request updated successfully');
            } else {
                await leaveAPI.create(formData);
                toast.success('Leave request submitted successfully');
            }
            setShowModal(false);
            setEditMode(false);
            setSelectedLeaveId(null);
            setFormData({ start_date: '', end_date: '', leave_type: 'sick', reason: '', status: '', remarks: '' });
            fetchLeaves();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to submit leave request');
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatDisplayDate = (dateString) => {
        // Handle both full ISO strings and date-only strings
        const dateOnly = typeof dateString === 'string' ? dateString.split('T')[0] : dateString;
        const [year, month, day] = dateOnly.split('-');
        return `${day}/${month}/${year}`; // DD/MM/YYYY
    };

    const calculateDays = (startDate, endDate) => {
        if (!startDate || !endDate) return 0;
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T00:00:00');
        return Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    };

    const handleStatusUpdate = async (leave, status) => {
        const startDateStr = typeof leave.start_date === 'string' ? leave.start_date.split('T')[0] : leave.start_date;
        const endDateStr = typeof leave.end_date === 'string' ? leave.end_date.split('T')[0] : leave.end_date;

        setSelectedLeaveId(leave.id);
        setApprovalAction(status);
        setApprovalFormData({
            start_date: startDateStr,
            end_date: endDateStr,
            remarks: '',
            original_start_date: startDateStr,
            original_end_date: endDateStr
        });
        setShowApprovalModal(true);
    };

    const submitApprovalAction = async (e) => {
        e.preventDefault();
        try {
            await leaveAPI.updateStatus(selectedLeaveId, {
                status: approvalAction,
                remarks: approvalFormData.remarks,
                start_date: approvalFormData.start_date,
                end_date: approvalFormData.end_date
            });
            toast.success(`Leave request ${approvalAction} successfully`);
            setShowApprovalModal(false);
            setApprovalFormData({ start_date: '', end_date: '', remarks: '' });
            fetchLeaves();
        } catch (error) {
            toast.error('Failed to update leave request');
        }
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'approved': return 'status-approved';
            case 'rejected': return 'status-rejected';
            case 'pending': return 'status-pending';
            default: return '';
        }
    };

    const handleApprove = async (id) => {
        setProcessingId(id);
        try {
            await leaveAPI.approve(id);
            toast.success('Leave request approved');
            fetchLeaves();
        } catch (error) {
            toast.error('Failed to approve leave request');
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (id) => {
        setProcessingId(id);
        try {
            await leaveAPI.reject(id);
            toast.success('Leave request rejected');
            fetchLeaves();
        } catch (error) {
            toast.error('Failed to reject leave request');
        } finally {
            setProcessingId(null);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this leave request?')) {
            try {
                await leaveAPI.delete(id);
                toast.success('Leave request deleted successfully');
                fetchLeaves();
            } catch (error) {
                toast.error('Failed to delete leave request');
            }
        }
    };

    return (
        <div className="leave-requests">
            <div className="header">
                <h1>Leave Requests</h1>
                <button onClick={() => setShowModal(true)} className="btn-primary">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                        <line x1="12" y1="14" x2="12" y2="18"></line>
                        <line x1="10" y1="16" x2="14" y2="16"></line>
                    </svg>
                    <span>Request Leave</span>
                </button>
            </div>

            <table className="leaves-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        {(user.role === 'sysadmin' || user.role === 'admin') && <th>Employee</th>}
                        <th>Leave Type</th>
                        <th>Start Date</th>
                        <th>End Date</th>
                        <th>Days</th>
                        <th>Reason</th>
                        <th>Status</th>
                        <th>Remarks</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {leaves.map((leave) => (
                        <tr key={leave.id}>
                            <td>{leave.id}</td>
                            {(user.role === 'sysadmin' || user.role === 'admin') && <td>{leave.user_name}</td>}
                            <td><span className="leave-type">{leave.leave_type}</span></td>
                            <td>{new Date(leave.start_date).toLocaleDateString()}</td>
                            <td>{new Date(leave.end_date).toLocaleDateString()}</td>
                            <td>{Math.ceil((new Date(leave.end_date) - new Date(leave.start_date)) / (1000 * 60 * 60 * 24)) + 1}</td>
                            <td>{leave.reason}</td>
                            <td>
                                <span className={`status-badge ${getStatusClass(leave.status)}`}>
                                    {leave.status}
                                </span>
                            </td>
                            <td>{leave.remarks || '-'}</td>
                            <td>
                                <div className="action-buttons">
                                    {(user.role === 'sysadmin' || user.role === 'admin') && leave.status === 'pending' ? (
                                        <>
                                            <button 
                                                onClick={() => handleStatusUpdate(leave, 'approved')} 
                                                className="btn-approve"
                                                title="Approve"
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <polyline points="20 6 9 17 4 12"></polyline>
                                                </svg>
                                            </button>
                                            <button 
                                                onClick={() => handleStatusUpdate(leave, 'rejected')} 
                                                className="btn-reject"
                                                title="Reject"
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                                </svg>
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            {(user.role === 'sysadmin' || user.role === 'admin' || 
                                              (user.id === leave.user_id && leave.status === 'pending')) && (
                                                <button 
                                                    onClick={() => handleEdit(leave)} 
                                                    className="btn-edit"
                                                    title="Edit"
                                                >
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                    </svg>
                                                </button>
                                            )}
                                            {(user.role === 'sysadmin' || 
                                              (user.id === leave.user_id && leave.status === 'pending')) && (
                                                <button 
                                                    onClick={() => handleDelete(leave.id)} 
                                                    className="btn-danger"
                                                    title="Delete"
                                                >
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <polyline points="3 6 5 6 21 6"></polyline>
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                        <line x1="10" y1="11" x2="10" y2="17"></line>
                                                        <line x1="14" y1="11" x2="14" y2="17"></line>
                                                    </svg>
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Approval Modal */}
            {showApprovalModal && (
                <div className="modal">
                    <div className="modal-content">
                        <h2>{approvalAction === 'approved' ? 'Approve' : 'Reject'} Leave Request</h2>
                        <form onSubmit={submitApprovalAction}>


                            <div className="form-row">
                                <div className="form-group">
                                    <label>{approvalAction === 'approved' ? 'Approve' : 'Reject'} Start Date</label>
                                    <input
                                        type="date"
                                        value={approvalFormData.start_date}
                                        onChange={(e) => setApprovalFormData({ ...approvalFormData, start_date: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>{approvalAction === 'approved' ? 'Approve' : 'Reject'} End Date</label>
                                    <input
                                        type="date"
                                        value={approvalFormData.end_date}
                                        onChange={(e) => setApprovalFormData({ ...approvalFormData, end_date: e.target.value })}
                                        min={approvalFormData.start_date}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>
                                    Remarks {approvalAction === 'rejected' ? '(Required)' :
                                        ((approvalFormData.start_date !== approvalFormData.original_start_date ||
                                            approvalFormData.end_date !== approvalFormData.original_end_date)
                                            ? '(Recommended - explain date changes)' : '(Optional)')}
                                </label>
                                <textarea
                                    value={approvalFormData.remarks}
                                    onChange={(e) => setApprovalFormData({ ...approvalFormData, remarks: e.target.value })}
                                    rows="2"
                                    placeholder="Enter remarks"
                                    required={approvalAction === 'rejected'}
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="submit" className="btn-primary">
                                    {approvalAction === 'approved' ? 'Approve' : 'Reject'}
                                </button>
                                <button type="button" onClick={() => setShowApprovalModal(false)} className="btn-secondary">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Leave Request Modal */}
            {showModal && (
                <div className="modal">
                    <div className="modal-content">
                        <h2>{editMode ? 'Edit Leave Request' : 'Request Leave'}</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Leave Type</label>
                                <select
                                    value={formData.leave_type}
                                    onChange={(e) => setFormData({ ...formData, leave_type: e.target.value })}
                                    required
                                >
                                    <option value="sick">Sick Leave</option>
                                    <option value="casual">Casual Leave</option>
                                    <option value="annual">Annual Leave</option>
                                    <option value="emergency">Emergency Leave</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Start Date</label>
                                <input
                                    type="date"
                                    value={formData.start_date}
                                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>End Date</label>
                                <input
                                    type="date"
                                    value={formData.end_date}
                                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                    min={formData.start_date}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Reason</label>
                                <textarea
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                    rows="3"
                                    placeholder="Enter reason for leave"
                                    required
                                />
                            </div>
                            {editMode && (user.role === 'sysadmin' || user.role === 'admin') && (
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Status</label>
                                        <select
                                            value={formData.status}
                                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                            required
                                        >
                                            <option value="pending">Pending</option>
                                            <option value="approved">Approved</option>
                                            <option value="rejected">Rejected</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Remarks {formData.status !== 'rejected' && <span className="optional-text">(Optional)</span>}</label>
                                        <textarea
                                            value={formData.remarks}
                                            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                            rows="1"
                                            placeholder="Enter remarks"
                                            required={formData.status === 'rejected'}
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="modal-actions">
                                <button type="submit" className="btn-primary">
                                    {editMode ? 'Update Request' : 'Submit Request'}
                                </button>
                                <button type="button" onClick={() => { setShowModal(false); setEditMode(false); }} className="btn-secondary">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LeaveRequests;
