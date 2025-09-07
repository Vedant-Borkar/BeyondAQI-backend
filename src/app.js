require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");
const hierarchyRoutes = require("./routes/hierarchyRoutes");
const leaderboardRoutes = require("./routes/leaderboardRoutes");
const dropdownRoutes = require("./routes/dropdownRoutes");
const historicalRoutes = require("./routes/historicalRoutes");
const searchRoutes = require("./routes/searchRoutes");
const realtimeRoutes = require("./routes/realtimeRoutes");
const cors = require("cors");
const rateLimiter = require("./middleware/rateLimiter");

const app = express();

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Apply rate limiting to all requests
app.use(rateLimiter);

// Other middleware
app.use(express.json({ limit: '10mb' }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Connect DB
connectDB();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/dropdown", dropdownRoutes);
app.use("/api/historical", historicalRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/realtime", realtimeRoutes);
app.use("/api", hierarchyRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    status: 'error',
    statusCode: 500,
    message: 'Internal server error',
    data: {},
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler - FIXED: Use proper route pattern
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    statusCode: 404,
    message: 'Route not found',
    data: {},
    error: `Cannot ${req.method} ${req.originalUrl}`
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🛡️ Rate limiting: 10,000 requests per hour per IP`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;