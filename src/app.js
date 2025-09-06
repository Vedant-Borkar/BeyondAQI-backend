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

const app = express();
app.use(express.json());
app.use(cors());

// Connect DB
connectDB();

// Routes
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/dropdown", dropdownRoutes);
app.use("/api/historical", historicalRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/realtime", realtimeRoutes);
app.use("/api", hierarchyRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));