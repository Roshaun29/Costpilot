import api from './axios';

export const getAnomalyStats = () => api.get('/api/anomalies/stats');
export const getAnomalies = (params) => api.get('/api/anomalies', { params });
export const getAnomaly = (id) => api.get(`/api/anomalies/${id}`);
export const updateAnomalyStatus = (id, data) => api.patch(`/api/anomalies/${id}/status`, data);
