const express = require("express");
const {
  getCountryData,
  getStateData,
  getCityData,
} = require("../controllers/hierarchyController");

const router = express.Router();

// Hierarchical routes
router.get("/:country", getCountryData);
router.get("/:country/:state", getStateData);
router.get("/:country/:state/:city", getCityData);

module.exports = router;
