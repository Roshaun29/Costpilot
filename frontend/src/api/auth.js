import api from './axios';

export const login = (email, password) => api.post('/api/auth/login', { email, password });
export const register = (data) => api.post('/api/auth/register', data);
export const getMe = () => api.get('/api/auth/me');
export const updateMe = (data) => api.put('/api/auth/me', data);
export const changePassword = (data) => api.put('/api/settings/password', data);
