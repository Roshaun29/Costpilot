import api from './axios';

export const getCosts = (params) => api.get('/api/costs', { params });
export const getCostSummary = (params) => api.get('/api/costs/summary', { params });
export const getServices = (accountId) => api.get('/api/costs/services', { params: { account_id: accountId } });
