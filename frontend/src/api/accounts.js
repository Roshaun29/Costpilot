import api from './axios';

export const getAccounts = () => api.get('/api/cloud-accounts');
export const createAccount = (data) => api.post('/api/cloud-accounts', data);
export const deleteAccount = (id) => api.delete(`/api/cloud-accounts/${id}`);
export const syncAccount = (id) => api.post(`/api/cloud-accounts/${id}/sync`);
export const connectRealAccount = (data) => api.post('/api/cloud-accounts/connect-real', data);
