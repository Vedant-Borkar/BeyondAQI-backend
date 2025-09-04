const City = require("../models/CityAQI");
const State = require("../models/StateAQI");
const Country = require("../models/CountryAQI");

// Helper: find latest or by timestamp
const findWithTimestamp = async (Model, filter, timestamp) => {
  if (timestamp) {
    return await Model.findOne({ ...filter, datetime: new Date(timestamp) });
  } else {
    return await Model.findOne(filter).sort({ datetime: -1 }); // latest
  }
};

// Country
const getCountryData = async (req, res) => {
  try {
    const { country } = req.params;
    const { timestamp } = req.query;

    const data = await findWithTimestamp(Country, { country }, timestamp);
    if (!data) return res.status(404).json({ msg: "No data found" });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// State
const getStateData = async (req, res) => {
  try {
    const { country, state } = req.params;
    const { timestamp } = req.query;

    const data = await findWithTimestamp(State, { country, state }, timestamp);
    if (!data) return res.status(404).json({ msg: "No data found" });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// City
const getCityData = async (req, res) => {
  try {
    const { country, state, city } = req.params;
    const { timestamp } = req.query;

    const data = await findWithTimestamp(City, { country, state, city }, timestamp);
    if (!data) return res.status(404).json({ msg: "No data found" });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getCountryData, getStateData, getCityData };