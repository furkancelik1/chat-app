import axios from 'axios';

const api = axios.create({
    baseURL: 'https://chat-app-production-mtsl.onrender.com/api',
});

export default api;
