require("dotenv").config();
const express = require("express")
const cors = require("cors")
const path = require("path");
const connectDB = require("./config/database");

const authRoutes = require("./routes/authRoutes")
const adminRoutes = require("./routes/adminRoutes")
const programRoutes = require("./routes/programRoutes")
const financeRoutes = require("./routes/financeRoutes")

const app = express();

app.use(
    cors({
        origin: process.env.CLIENT_URL || "*",
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"]
    })
)

connectDB();

//middleware
app.use(express.json());

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

//routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/program", programRoutes);
app.use("/api/finance", financeRoutes);

//start server

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
