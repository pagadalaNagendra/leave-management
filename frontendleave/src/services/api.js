import axios from 'axios';

const API_URL = 'http://127.0.0.1:5002/api';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
};

export const userAPI = {
  getAll: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};

export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getUserSummary: () => api.get('/dashboard/user-summary'),
  getUserLeaveStats: (year) => api.get(`/dashboard/user-leave-stats?year=${year}`),
  getLeaveTrends: (year) => api.get(`/dashboard/leave-trends?year=${year}`),
  getLeaveTypeDistribution: (year) => api.get(`/dashboard/leave-type-distribution?year=${year}`),
  getAttendanceOverview: (year) => api.get(`/dashboard/attendance-overview?year=${year}`),
};

export const leaveAPI = {
  getAll: () => api.get('/leaves'),
  create: (data) => api.post('/leaves', data),
  update: (id, data) => api.put(`/leaves/${id}`, data),
  updateStatus: (id, data) => api.put(`/leaves/${id}/status`, data),
  delete: (id) => api.delete(`/leaves/${id}`),
  approve: (id) => api.put(`/leaves/${id}/approve`),
  reject: (id) => api.put(`/leaves/${id}/reject`),
};

export const attendanceAPI = {
  mark: (data) => api.post('/attendance/mark', data),
  login: () => api.post('/attendance/login'),
  logout: () => api.post('/attendance/logout'),
  getHistory: (params) => api.get('/attendance/history', { params }),
  update: (id, data) => api.put(`/attendance/${id}`, data),
  delete: (id) => api.delete(`/attendance/${id}`),
};

export default api;
