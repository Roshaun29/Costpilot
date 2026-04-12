import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('costpilot_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const msg = error.response?.data?.detail
      || error.response?.data?.message
      || 'Something went wrong. Please try again.';

    // Show error toast for all non-401 errors
    if (error.response?.status !== 401) {
      toast.error(msg, { duration: 5000 });
    }

    // 401 = session expired
    if (error.response?.status === 401) {
      localStorage.removeItem('costpilot_token');
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        toast.error('Session expired. Please log in again.');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
