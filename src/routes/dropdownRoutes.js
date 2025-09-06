const express = require("express");
const { 
	getCountries, 
	getStatesByCountry, 
	getCitiesByState 
} = require("../controllers/dropdownController");

const router = express.Router();

router.get("/countries", getCountries);
router.post("/states", getStatesByCountry);
router.post("/cities", getCitiesByState);

module.exports = router;