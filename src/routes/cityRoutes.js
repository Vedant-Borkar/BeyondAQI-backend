const express = require("express");
const { getCityData } = require("../controllers/cityController");
const router = express.Router();

router.get("/:city", getCityData);

module.exports = router;
