const express = require("express");
const router = express.Router();
const { getCountryData } = require("../controllers/countryController");

router.get("/:country", getCountryData);

module.exports = router;
