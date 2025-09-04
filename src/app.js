require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");
const hierarchyRoutes = require("./routes/hierarchyRoutes");

const app = express();
app.use(express.json());

// Connect DB
connectDB();

// Routes
app.use("/api", hierarchyRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));