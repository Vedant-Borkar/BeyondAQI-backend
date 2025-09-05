const express = require("express");
const {
  getCountryData,
  getStateData,
  getCityData,
  getCountryMetroCities,
  getStateMetroCities,
} = require("../controllers/hierarchyController");

const router = express.Router();

// Metro routes (now inside same controller)
router.get("/:country/metro", getCountryMetroCities);
router.get("/:country/:state/metro", getStateMetroCities);

// Hierarchical routes
router.get("/:country", getCountryData);
router.get("/:country/:state", getStateData);
router.get("/:country/:state/:city", getCityData);



module.exports = router;
