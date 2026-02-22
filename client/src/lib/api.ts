import axios from 'axios';
import { useChatStore } from '../store/useChatStore';

const api = axios.create({
    baseURL: 'https://chat-app-lpih.onrender.com/api',
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Token is invalid or expired
            useChatStore.getState().logout();
            if (typeof window !== 'undefined') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
