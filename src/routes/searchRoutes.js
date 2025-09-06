const express = require("express");
const { searchLocations } = require("../controllers/searchController");

const router = express.Router();

router.get("/", searchLocations);

module.exports = router;