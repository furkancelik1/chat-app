import axios from 'axios';

const api = axios.create({
    baseURL: 'https://chat-app-lpih.onrender.com/api',
});

export default api;
