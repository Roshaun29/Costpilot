import api from './axios';

export const getAlerts = (params) => api.get('/api/alerts', { params });
export const getUnreadCount = () => api.get('/api/alerts/unread-count');
export const markRead = (id) => api.patch(`/api/alerts/${id}/read`);
export const markAllRead = () => api.patch('/api/alerts/read-all');
export const deleteAlert = (id) => api.delete(`/api/alerts/${id}`);
