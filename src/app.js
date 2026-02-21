const express = require("express");
const cors = require("cors");

const upload = require("./middlewares/uploadMiddleware");

const app = express();

// Middleware
app.use(
  cors({
    origin: [
      "https://chat-app-dusky-omega.vercel.app",
      "http://localhost:3000",
      "http://localhost:3001",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  }),
);
app.use(express.json());

// Serve static files from uploads directory
app.use("/uploads", express.static("uploads"));

// Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/rooms", require("./routes/roomRoutes"));
app.use("/api/messages", require("./routes/messageRoutes"));

// Upload Endpoint
app.post("/api/upload", upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Please upload a file" });
    }
    // Return the URL to access the file
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    res.status(200).json({ fileUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// Basic Route
app.get("/", (req, res) => {
  res.send(`
        <html>
            <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1>Backend API is Running</h1>
                <p>This is the server. You are looking for the frontend!</p>
                <p>👉 <a href="${process.env.CLIENT_URL || "http://localhost:3001"}">Click here to go to the App</a></p>
            </body>
        </html>
    `);
});

app.get("/api/status", (req, res) => {
  res.status(200).json({ status: "OK", message: "Server is running" });
});

module.exports = app;
