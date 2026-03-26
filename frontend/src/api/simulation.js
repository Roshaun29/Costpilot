import api from './axios';

export const getStatus = () => api.get('/api/simulation/status');
export const startSimulation = () => api.post('/api/simulation/start');
export const stopSimulation = () => api.post('/api/simulation/stop');
export const triggerTick = () => api.post('/api/simulation/tick');
export const injectAnomaly = (data) => api.post('/api/simulation/inject-anomaly', data);
export const seedAccount = (id) => api.post(`/api/cloud-accounts/${id}/sync`);
