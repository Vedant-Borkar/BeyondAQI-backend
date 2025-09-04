const City = require("../models/CityAQI");

const getCityData = async (req, res) => {
  try {
    const city = await City.findOne({ city: req.params.city }).sort({ datetime: -1 });
    if (!city) return res.status(404).json({ message: "City not found" });

    res.json({
      datetime: city.datetime,
      latitude: city.latitude,
      longitude: city.longitude,
      city: city.city,
      state: city.state,
      country: city.country,
      aqi: city.aqi,
      aqi_scale: city.aqi_scale,
      pollutants: city.pollutants
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getCityData };