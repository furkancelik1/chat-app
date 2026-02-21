require("dotenv").config();
const http = require("http");
const app = require("./app");
const { Server } = require("socket.io");
const socketHandler = require("./socket");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 3000;

// Connect to Database
connectDB();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3001",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Initialize Socket.io logic
socketHandler(io);

// Make io accessible to our router
app.set("io", io);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
