const mongoose = require("mongoose");

const citySchema = new mongoose.Schema({
  datetime: { type: Date, required: true },
  latitude: Number,
  longitude: Number,
  city: String,
  state: String,
  country: String,
  is_country_metro_city: { type: Boolean, default: false },
  is_state_metro_city: { type: Boolean, default: false },
  aqi: Number,
  aqi_scale: Number,
  pollutants: {
    co: Number, no: Number, no2: Number,
    o3: Number, so2: Number,
    pm2_5: Number, pm10: Number, nh3: Number
  }
});

module.exports = mongoose.model("City", citySchema);