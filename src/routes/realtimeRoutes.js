const express = require("express");
const {
	getRealtimeStatesByCountry,
	getRealtimeCitiesByState,
} = require("../controllers/realtimeController");

const router = express.Router();

// Real-time data routes
router.get("/:country/states", getRealtimeStatesByCountry);
router.get("/:country/:state/cities", getRealtimeCitiesByState);

module.exports = router;