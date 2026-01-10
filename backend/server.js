require("dotenv").config();
const express = require("express")
const cors = require("cors")
const { connectDB } = require("./config/database");
const { syncDB } = require("./models"); // Import syncDB from models
const { initializeCleanupJobs } = require("./utils/cleanupJobs"); // Import cleanup jobs

const authRoutes = require("./routes/authRoutes")
const adminRoutes = require("./routes/adminRoutes")
const programRoutes = require("./routes/programRoutes")
const financeRoutes = require("./routes/financeRoutes")
const sharedRoutes = require("./routes/sharedRoutes")

const app = express();

app.use(
    cors({
        origin: process.env.CLIENT_URL || "*",
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"]
    })
)

// Initialize database connection and sync tables
const startServer = async () => {
  try {
    await connectDB(); // Connect to MySQL
    await syncDB(); // Sync tables (create if they don't exist)
    await initializeCleanupJobs(); // Start cleanup jobs (runs initial cleanup + schedules future runs)
  } catch (error) {
    console.error("Failed to initialize server:", error);
    process.exit(1);
  }
};

startServer();

//middleware
app.use(express.json());

// Serve static files from uploads directory (deprecated - using Cloudinary now)
// Commented out since we're using Cloudinary for image storage
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

//routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/program", programRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/shared", sharedRoutes);

//start server

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
