const CountryAQI = require("../models/CountryAQI");

exports.getCountryData = async (req, res) => {
  try {
    const { country } = req.params;
    const data = await CountryAQI.findOne({ country });
    if (!data) return res.status(404).json({ message: "Country not found" });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
