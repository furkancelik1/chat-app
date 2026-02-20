require('dotenv').config();
const http = require('http');
const app = require('./app');
const { Server } = require('socket.io');
const socketHandler = require('./socket');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 3000;

// Connect to Database
connectDB();

const server = http.createServer(app);

const allowedOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map(s => s.trim())
    : ['http://localhost:3001', 'http://localhost:3000'];

const io = new Server(server, {
    cors: {
        origin: function (origin, callback) {
            if (!origin || allowedOrigins.some(o => o === '*' || o === origin)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Initialize Socket.io logic
socketHandler(io);

// Make io accessible to our router
app.set('io', io);

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
