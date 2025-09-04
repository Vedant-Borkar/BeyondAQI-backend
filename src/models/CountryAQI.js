const mongoose = require("mongoose");

const CountryAQISchema = new mongoose.Schema({
  datetime: { type: Date, required: true },
  latitude: { type: Number, required: true },   // country center
  longitude: { type: Number, required: true },
  country: { type: String, required: true, index: true },
  state: { type: String, default: "" },
  city: { type: String, default: "" },
  is_country_metro_city: { type: Boolean, default: false },
  is_state_metro_city: { type: Boolean, default: false },
  aqi: { type: Number, required: true },
  aqi_scale: { type: Number, required: true },
  pollutants: {
    co: Number, no: Number, no2: Number, o3: Number, so2: Number, pm2_5: Number, pm10: Number, nh3: Number
  }
});

module.exports = mongoose.model("CountryAQI", CountryAQISchema);
