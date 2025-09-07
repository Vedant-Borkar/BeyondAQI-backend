const express = require("express");
const {
	getCountryHistoricalData,
	getStateHistoricalData,
	getCityHistoricalData,
} = require("../controllers/historicalController");

const router = express.Router();

// Historical data routes (hierarchical)
router.get("/:country/:period", getCountryHistoricalData);
router.get("/:country/:state/:period", getStateHistoricalData);
router.get("/:country/:state/:city/:period", getCityHistoricalData);

module.exports = router;