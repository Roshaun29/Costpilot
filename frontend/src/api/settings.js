import api from './axios';

export const getSettings = () => api.get('/api/settings');
export const updateSettings = (data) => api.put('/api/settings', data);
export const updatePassword = (data) => api.put('/api/settings/password', data);
export const sendTestAlert = () => api.post('/api/settings/test-alert');
