const express = require("express");
const router = express.Router();
const { getStateData } = require("../controllers/stateController");

router.get("/:state", getStateData);

module.exports = router;
