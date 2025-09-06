const express = require("express");
const { getMostPollutedCities, getMostPollutedCitiesByState } = require("../controllers/leaderboardController");

const router = express.Router();

router.post("/most-polluted", getMostPollutedCities);
router.post("/most-polluted/state", getMostPollutedCitiesByState);

module.exports = router;