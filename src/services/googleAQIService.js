const axios = require('axios');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const parse = require('csv-parse/sync').parse;

const CityAQI = require('../models/CityAQI');
const StateAQI = require('../models/StateAQI');
const CountryAQI = require('../models/CountryAQI');
const { computeIndiaAQI } = require('../utils/aqi');

class GoogleAQIService {
  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
    this.baseURL = 'https://airquality.googleapis.com/v1/currentConditions:lookup';
    
    if (!this.apiKey) {
      throw new Error('GOOGLE_MAPS_API_KEY environment variable is required');
    }
  }

  async fetchAQIData(latitude, longitude) {
    try {
      const response = await axios.post(
        `${this.baseURL}?key=${this.apiKey}`,
        {
          location: {
            latitude: Number(latitude),
            longitude: Number(longitude)
          },
          languageCode: "en"
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error(`Failed to fetch AQI data for ${latitude}, ${longitude}:`, error.message);
      throw error;
    }
  }

  mapGoogleToInternalFormat(googleData, cityMeta) {
    const pollutants = {
      co: 0, no: 0, no2: 0, o3: 0, so2: 0, pm2_5: 0, pm10: 0, nh3: 0
    };
    
    // Extract pollutant data from Google response
    if (googleData.pollutants) {
      googleData.pollutants.forEach(pollutant => {
        const code = pollutant.code;
        const value = pollutant.concentration?.value || 0;
        
        switch (code) {
          case 'co': pollutants.co = value; break;
          case 'no2': pollutants.no2 = value; break;
          case 'o3': pollutants.o3 = value; break;
          case 'so2': pollutants.so2 = value; break;
          case 'pm25': pollutants.pm2_5 = value; break;
          case 'pm10': pollutants.pm10 = value; break;
          case 'nh3': pollutants.nh3 = value; break;
        }
      });
    }

    // Calculate India AQI from pollutants
    const aqiData = computeIndiaAQI(pollutants);

    return {
      datetime: new Date(googleData.dateTime || new Date()),
      latitude: parseFloat(cityMeta.latitude),
      longitude: parseFloat(cityMeta.longitude),
      city: cityMeta.city,
      state: cityMeta.state,
      country: cityMeta.country,
      is_country_metro_city: cityMeta.is_country_metro_city === 'true',
      is_state_metro_city: cityMeta.is_state_metro_city === 'true',
      aqi: aqiData?.aqi || 0,
      aqi_scale: aqiData?.scale || 1,
      pollutants: pollutants
    };
  }

  async loadCitiesMetadata() {
    const citiesCsv = fs.readFileSync(path.join(__dirname, '../data/cities.csv'), 'utf-8');
    const statesCsv = fs.readFileSync(path.join(__dirname, '../data/states.csv'), 'utf-8');
    const countryCsv = fs.readFileSync(path.join(__dirname, '../data/countries.csv'), 'utf-8');
    
    const cityMeta = parse(citiesCsv, { columns: true, skip_empty_lines: true });
    const stateMeta = parse(statesCsv, { columns: true, skip_empty_lines: true });
    const countryMeta = parse(countryCsv, { columns: true, skip_empty_lines: true })[0];

    return {
      cities: cityMeta,
      states: stateMeta,
      country: countryMeta,
      cityIndex: new Map(cityMeta.map(r => [r.city, r])),
      stateIndex: new Map(stateMeta.map(r => [r.state, r]))
    };
  }

  async fetchAndStoreAQIData() {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      console.log('✅ Connected to MongoDB');

      const metadata = await this.loadCitiesMetadata();
      const currentDateTime = new Date();
      
      const cityDocs = [];
      const failedCities = [];

      // Fetch data for each city
      for (const cityMeta of metadata.cities) {
        try {
          const googleData = await this.fetchAQIData(
            parseFloat(cityMeta.latitude),
            parseFloat(cityMeta.longitude)
          );

          const cityDoc = this.mapGoogleToInternalFormat(googleData, cityMeta);
          cityDocs.push(cityDoc);

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          console.error(`Failed to fetch data for ${cityMeta.city}:`, error.message);
          failedCities.push(cityMeta.city);
        }
      }

      // Insert city data
      if (cityDocs.length > 0) {
        await CityAQI.insertMany(cityDocs);
        console.log(`✅ Inserted ${cityDocs.length} city records`);
      }

      // Aggregate state data
      const stateData = this.aggregateStateData(cityDocs, metadata);
      if (stateData.length > 0) {
        await StateAQI.insertMany(stateData);
        console.log(`✅ Inserted ${stateData.length} state records`);
      }

      // Aggregate country data
      const countryData = this.aggregateCountryData(stateData, metadata);
      if (countryData) {
        await CountryAQI.create(countryData);
        console.log(`✅ Inserted country record`);
      }

      await mongoose.disconnect();
      
      const result = {
        success: true,
        timestamp: currentDateTime,
        citiesProcessed: cityDocs.length,
        citiesFailed: failedCities.length,
        failedCities: failedCities
      };

      console.log('🎉 AQI data fetch and store completed:', result);
      return result;

    } catch (error) {
      console.error('❌ Error in fetchAndStoreAQIData:', error);
      await mongoose.disconnect();
      throw error;
    }
  }

  aggregateStateData(cityDocs, metadata) {
    const stateGroups = {};
    
    // Group cities by state
    cityDocs.forEach(city => {
      const stateKey = `${city.state}_${city.country}`;
      if (!stateGroups[stateKey]) {
        stateGroups[stateKey] = [];
      }
      stateGroups[stateKey].push(city);
    });

    const stateDocs = [];
    
    // Calculate averages for each state
    Object.entries(stateGroups).forEach(([stateKey, cities]) => {
      const firstCity = cities[0];
      const stateMeta = metadata.stateIndex.get(firstCity.state);
      
      if (!stateMeta) {
        console.warn(`⚠️ No state metadata for ${firstCity.state}`);
        return;
      }

      const avgPollutants = {
        co: this.calculateAverage(cities, 'co'),
        no: this.calculateAverage(cities, 'no'),
        no2: this.calculateAverage(cities, 'no2'),
        o3: this.calculateAverage(cities, 'o3'),
        so2: this.calculateAverage(cities, 'so2'),
        pm2_5: this.calculateAverage(cities, 'pm2_5'),
        pm10: this.calculateAverage(cities, 'pm10'),
        nh3: this.calculateAverage(cities, 'nh3')
      };

      const aqiData = computeIndiaAQI(avgPollutants);

      stateDocs.push({
        datetime: firstCity.datetime,
        latitude: parseFloat(stateMeta.latitude),
        longitude: parseFloat(stateMeta.longitude),
        state: firstCity.state,
        country: firstCity.country,
        city: '',
        is_country_metro_city: false,
        is_state_metro_city: false,
        aqi: aqiData?.aqi || 0,        // Fallback to 0 instead of null
        aqi_scale: aqiData?.scale || 1, // Fallback to 1 instead of null
        pollutants: avgPollutants
      });
    });

    return stateDocs;
  }

  aggregateCountryData(stateDocs, metadata) {
    if (stateDocs.length === 0) return null;

    const firstState = stateDocs[0];
    const countryStates = stateDocs.filter(s => s.country === metadata.country.country);
    
    if (countryStates.length === 0) return null;

    const avgPollutants = {
      co: this.calculateAverage(countryStates, 'co'),
      no: this.calculateAverage(countryStates, 'no'),
      no2: this.calculateAverage(countryStates, 'no2'),
      o3: this.calculateAverage(countryStates, 'o3'),
      so2: this.calculateAverage(countryStates, 'so2'),
      pm2_5: this.calculateAverage(countryStates, 'pm2_5'),
      pm10: this.calculateAverage(countryStates, 'pm10'),
      nh3: this.calculateAverage(countryStates, 'nh3')
    };

    const aqiData = computeIndiaAQI(avgPollutants);

    return {
      datetime: firstState.datetime,
      latitude: parseFloat(metadata.country.latitude),
      longitude: parseFloat(metadata.country.longitude),
      country: metadata.country.country,
      state: '',
      city: '',
      is_country_metro_city: false,
      is_state_metro_city: false,
      aqi: aqiData?.aqi || 0,        // Fallback to 0 instead of null
      aqi_scale: aqiData?.scale || 1, // Fallback to 1 instead of null
      pollutants: avgPollutants
    };
  }

  calculateAverage(docs, pollutantKey) {
    const values = docs
      .map(doc => doc.pollutants[pollutantKey])
      .filter(value => value !== null && value !== undefined && !isNaN(value));
    
    if (values.length === 0) return 0;
    
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }
}

// Lambda handler function for AWS
exports.handler = async (event, context) => {
  const service = new GoogleAQIService();
  
  try {
    const result = await service.fetchAndStoreAQIData();
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'AQI data fetch completed successfully',
        result: result
      })
    };
  } catch (error) {
    console.error('Lambda execution failed:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'AQI data fetch failed',
        error: error.message
      })
    };
  }
};

// For local testing
if (require.main === module) {
  const service = new GoogleAQIService();
  service.fetchAndStoreAQIData().catch(console.error);
}

module.exports = GoogleAQIService;