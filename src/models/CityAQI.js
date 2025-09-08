const mongoose = require("mongoose");

const citySchema = new mongoose.Schema({
  // Existing fields (keep for API compatibility)
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
  },
  
  // NEW: Enhanced Google API data
  google_data: {
    region_code: String,
    
    // Universal AQI Index
    universal_aqi: {
      aqi: Number,
      category: String,
      dominant_pollutant: String,
      color: {
        red: Number,
        green: Number,
        blue: Number
      }
    },
    
    // Local AQI Index (if available)
    local_aqi: {
      aqi: Number,
      category: String,
      dominant_pollutant: String,
      code: String,
      display_name: String,
      color: {
        red: Number,
        green: Number,
        blue: Number
      }
    },
    
    // Detailed pollutant information
    detailed_pollutants: [{
      code: String,
      display_name: String,
      full_name: String,
      concentration: {
        value: Number,
        units: String
      },
      additional_info: {
        sources: String,
        effects: String
      }
    }],
    
    // Health recommendations
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

module.exports = mongoose.model("City", citySchema);