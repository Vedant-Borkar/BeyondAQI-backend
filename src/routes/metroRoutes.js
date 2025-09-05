//NOT BEING USED CURRENTLY - WILL BE USED IN FUTURE UPDATES
//CURRENTLY IMPLEMENTED THROUGH HIERARCHY CONTROLLER ONLY
const express = require("express");
const router = express.Router();
const { getCountryMetroCities, getStateMetroCities } = require("../controllers/metroController");

router.get("/:country/metro", getCountryMetroCities);
router.get("/:country/:state/metro", getStateMetroCities);

module.exports = router;
