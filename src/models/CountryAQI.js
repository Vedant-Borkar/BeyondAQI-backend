const mongoose = require("mongoose");

const CountryAQISchema = new mongoose.Schema({
  // Existing fields (keep for API compatibility)
  datetime: { type: Date, required: true },
  latitude: { type: Number, required: true },
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
  },
  
  // NEW: National aggregated Google API data
  google_data: {
    region_code: String,
    
    // National Universal AQI
    universal_aqi: {
      aqi: Number,
      category: String,
      dominant_pollutant: String
    },
    
    // National Local AQI
    local_aqi: {
      aqi: Number,
      category: String,
      dominant_pollutant: String,
      code: String,
      display_name: String
    },
    
    // National averaged detailed pollutants
    detailed_pollutants: [{
      code: String,
      display_name: String,
      full_name: String,
      concentration: {
        value: Number,
        units: String
      }
    }],
    
    // National health recommendations (most restrictive)
    health_recommendations: {
      general_population: String,
      elderly: String,
      lung_disease_population: String,
      heart_disease_population: String,
      athletes: String,
      pregnant_women: String,
      children: String
    }
  }
});

module.exports = mongoose.model("CountryAQI", CountryAQISchema);