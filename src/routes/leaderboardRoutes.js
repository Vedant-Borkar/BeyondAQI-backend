const express = require("express");
const { getMostPollutedCities } = require("../controllers/leaderboardController");

const router = express.Router();

router.post("/most-polluted", getMostPollutedCities);

module.exports = router;