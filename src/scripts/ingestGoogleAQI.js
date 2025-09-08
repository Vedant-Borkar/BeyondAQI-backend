require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const parse = require('csv-parse/sync').parse;

// Import models
const CityAQI = require('../models/CityAQI');
const StateAQI = require('../models/StateAQI');
const CountryAQI = require('../models/CountryAQI');

class GoogleAQIService {
  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
    this.baseURL = 'https://airquality.googleapis.com/v1/currentConditions:lookup';
    
    if (!this.apiKey) {
      throw new Error('GOOGLE_MAPS_API_KEY not found in environment');
    }
  }

  // Fetch AQI data from Google API with extra computations
  async fetchAQIData(latitude, longitude) {
    const response = await axios.post(
      `${this.baseURL}?key=${this.apiKey}`,
      {
        location: { latitude: Number(latitude), longitude: Number(longitude) },
        extraComputations: [
          "LOCAL_AQI",
          "HEALTH_RECOMMENDATIONS",
          "POLLUTANT_ADDITIONAL_INFO",
          "DOMINANT_POLLUTANT_CONCENTRATION",
          "POLLUTANT_CONCENTRATION"
        ],
        languageCode: "en"
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
    );
    return response.data;
  }

  // Map Google API response to internal format
  mapGoogleToInternalFormat(googleData, cityMeta) {
    // Extract basic pollutant concentrations for existing API compatibility
    const pollutants = { co: 0, no: 0, no2: 0, o3: 0, so2: 0, pm2_5: 0, pm10: 0, nh3: 0 };
    
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

    // Extract AQI values
    let aqi = 0;
    let aqiScale = 1;
    let universalAqi = null;
    let localAqi = null;

    if (googleData.indexes && googleData.indexes.length > 0) {
      // Find Universal AQI
      const uaqiIndex = googleData.indexes.find(index => index.code === 'uaqi');
      if (uaqiIndex) {
        aqi = uaqiIndex.aqi || 0;
        universalAqi = {
          aqi: uaqiIndex.aqi,
          category: uaqiIndex.category,
          dominant_pollutant: uaqiIndex.dominantPollutant,
          color: uaqiIndex.color
        };
        
        // Convert to India AQI scale (1-6)
        if (aqi <= 50) aqiScale = 1;
        else if (aqi <= 100) aqiScale = 2;
        else if (aqi <= 150) aqiScale = 3;
        else if (aqi <= 200) aqiScale = 4;
        else if (aqi <= 300) aqiScale = 5;
        else aqiScale = 6;
      }

      // Find Local AQI (e.g., ind_cpcb)
      const localIndex = googleData.indexes.find(index => index.code !== 'uaqi');
      if (localIndex) {
        localAqi = {
          aqi: localIndex.aqi,
          category: localIndex.category,
          dominant_pollutant: localIndex.dominantPollutant,
          code: localIndex.code,
          display_name: localIndex.displayName,
          color: localIndex.color
        };
      }
    }

    // Map detailed pollutants
    const detailedPollutants = [];
    if (googleData.pollutants) {
      googleData.pollutants.forEach(pollutant => {
        detailedPollutants.push({
          code: pollutant.code,
          display_name: pollutant.displayName,
          full_name: pollutant.fullName,
          concentration: {
            value: pollutant.concentration?.value || 0,
            units: pollutant.concentration?.units || ''
          },
          additional_info: {
            sources: pollutant.additionalInfo?.sources || '',
            effects: pollutant.additionalInfo?.effects || ''
          }
        });
      });
    }

    return {
      // Existing fields (for API compatibility)
      datetime: new Date(),
      latitude: parseFloat(cityMeta.latitude),
      longitude: parseFloat(cityMeta.longitude),
      city: cityMeta.city,
      state: cityMeta.state,
      country: cityMeta.country,
      is_country_metro_city: cityMeta.is_country_metro_city === 'true',
      is_state_metro_city: cityMeta.is_state_metro_city === 'true',
      aqi: aqi,
      aqi_scale: aqiScale,
      pollutants: pollutants,
      
      // New enhanced Google data
      google_data: {
        region_code: googleData.regionCode,
        universal_aqi: universalAqi,
        local_aqi: localAqi,
        detailed_pollutants: detailedPollutants,
        health_recommendations: googleData.healthRecommendations || {}
      }
    };
  }

  // Load metadata from CSV files
  async loadCitiesMetadata() {
    const dataDir = path.join(__dirname, '../data');
    
    const citiesCsv = fs.readFileSync(path.join(dataDir, 'cities.csv'), 'utf-8');
    const statesCsv = fs.readFileSync(path.join(dataDir, 'states.csv'), 'utf-8');
    const countryCsv = fs.readFileSync(path.join(dataDir, 'countries.csv'), 'utf-8');
    
    const cityMeta = parse(citiesCsv, { columns: true, skip_empty_lines: true });
    const stateMeta = parse(statesCsv, { columns: true, skip_empty_lines: true });
    const countryMeta = parse(countryCsv, { columns: true, skip_empty_lines: true })[0];

    return {
      cities: cityMeta,
      states: stateMeta,
      country: countryMeta,
      stateIndex: new Map(stateMeta.map(r => [r.state, r]))
    };
  }

  // Calculate average for aggregation
  calculateAverage(docs, field) {
    if (docs.length === 0) return 0;
    const values = docs.map(doc => {
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        return doc[parent]?.[child] || 0;
      }
      return doc[field] || 0;
    }).filter(val => !isNaN(val) && val !== null);
    
    return values.length > 0 ? Math.round(values.reduce((sum, val) => sum + val, 0) / values.length) : 0;
  }

  // Get most restrictive health recommendation
  getMostRestrictiveRecommendation(cityDocs) {
    const recommendations = cityDocs
      .map(city => city.google_data?.health_recommendations)
      .filter(rec => rec && Object.keys(rec).length > 0);
    
    if (recommendations.length === 0) return {};
    
    // Use the first available recommendation as base
    return recommendations[0];
  }

  // Get dominant category across cities
  getDominantCategory(cityDocs, field) {
    const categories = cityDocs
      .map(city => city.google_data?.[field]?.category)
      .filter(cat => cat);
    
    if (categories.length === 0) return 'Unknown';
    
    // Count occurrences and return most common
    const counts = {};
    categories.forEach(cat => counts[cat] = (counts[cat] || 0) + 1);
    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
  }

  // Aggregate city data to state level
  aggregateStateData(cityDocs, metadata) {
    const stateGroups = {};
    
    cityDocs.forEach(city => {
      const key = `${city.state}_${city.country}`;
      if (!stateGroups[key]) stateGroups[key] = [];
      stateGroups[key].push(city);
    });

    return Object.entries(stateGroups).map(([key, cities]) => {
      const firstCity = cities[0];
      const stateMeta = metadata.stateIndex.get(firstCity.state);
      
      if (!stateMeta) return null;

      const avgAQI = this.calculateAverage(cities, 'aqi');
      let avgScale = 1;
      if (avgAQI <= 50) avgScale = 1;
      else if (avgAQI <= 100) avgScale = 2;
      else if (avgAQI <= 150) avgScale = 3;
      else if (avgAQI <= 200) avgScale = 4;
      else if (avgAQI <= 300) avgScale = 5;
      else avgScale = 6;

      // Average pollutants
      const avgPollutants = {
        co: this.calculateAverage(cities, 'pollutants.co'),
        no: this.calculateAverage(cities, 'pollutants.no'),
        no2: this.calculateAverage(cities, 'pollutants.no2'),
        o3: this.calculateAverage(cities, 'pollutants.o3'),
        so2: this.calculateAverage(cities, 'pollutants.so2'),
        pm2_5: this.calculateAverage(cities, 'pollutants.pm2_5'),
        pm10: this.calculateAverage(cities, 'pollutants.pm10'),
        nh3: this.calculateAverage(cities, 'pollutants.nh3')
      };

      // Aggregate detailed pollutants
      const detailedPollutants = [];
      const pollutantCodes = ['co', 'no2', 'o3', 'so2', 'pm25', 'pm10', 'nh3'];
      
      pollutantCodes.forEach(code => {
        const cityPollutants = cities
          .map(city => city.google_data?.detailed_pollutants?.find(p => p.code === code))
          .filter(p => p);
        
        if (cityPollutants.length > 0) {
          const avgValue = cityPollutants.reduce((sum, p) => sum + (p.concentration?.value || 0), 0) / cityPollutants.length;
          const sample = cityPollutants[0];
          
          detailedPollutants.push({
            code: sample.code,
            display_name: sample.display_name,
            full_name: sample.full_name,
            concentration: {
              value: Math.round(avgValue * 100) / 100,
              units: sample.concentration?.units || ''
            }
          });
        }
      });

      return {
        datetime: firstCity.datetime,
        latitude: parseFloat(stateMeta.latitude),
        longitude: parseFloat(stateMeta.longitude),
        state: firstCity.state,
        country: firstCity.country,
        city: '',
        is_country_metro_city: false,
        is_state_metro_city: false,
        aqi: avgAQI,
        aqi_scale: avgScale,
        pollutants: avgPollutants,
        google_data: {
          region_code: firstCity.google_data?.region_code,
          universal_aqi: {
            aqi: avgAQI,
            category: this.getDominantCategory(cities, 'universal_aqi'),
            dominant_pollutant: firstCity.google_data?.universal_aqi?.dominant_pollutant
          },
          local_aqi: {
            aqi: this.calculateAverage(cities, 'google_data.local_aqi.aqi'),
            category: this.getDominantCategory(cities, 'local_aqi'),
            dominant_pollutant: firstCity.google_data?.local_aqi?.dominant_pollutant,
            code: firstCity.google_data?.local_aqi?.code,
            display_name: firstCity.google_data?.local_aqi?.display_name
          },
          detailed_pollutants: detailedPollutants,
          health_recommendations: this.getMostRestrictiveRecommendation(cities)
        }
      };
    }).filter(Boolean);
  }

  // Aggregate state data to country level
  aggregateCountryData(stateDocs, metadata) {
    if (stateDocs.length === 0) return null;

    const avgAQI = this.calculateAverage(stateDocs, 'aqi');
    let avgScale = 1;
    if (avgAQI <= 50) avgScale = 1;
    else if (avgAQI <= 100) avgScale = 2;
    else if (avgAQI <= 150) avgScale = 3;
    else if (avgAQI <= 200) avgScale = 4;
    else if (avgAQI <= 300) avgScale = 5;
    else avgScale = 6;

    // Average pollutants
    const avgPollutants = {
      co: this.calculateAverage(stateDocs, 'pollutants.co'),
      no: this.calculateAverage(stateDocs, 'pollutants.no'),
      no2: this.calculateAverage(stateDocs, 'pollutants.no2'),
      o3: this.calculateAverage(stateDocs, 'pollutants.o3'),
      so2: this.calculateAverage(stateDocs, 'pollutants.so2'),
      pm2_5: this.calculateAverage(stateDocs, 'pollutants.pm2_5'),
      pm10: this.calculateAverage(stateDocs, 'pollutants.pm10'),
      nh3: this.calculateAverage(stateDocs, 'pollutants.nh3')
    };

    // Aggregate detailed pollutants
    const detailedPollutants = [];
    const pollutantCodes = ['co', 'no2', 'o3', 'so2', 'pm25', 'pm10', 'nh3'];
    
    pollutantCodes.forEach(code => {
      const statePollutants = stateDocs
        .map(state => state.google_data?.detailed_pollutants?.find(p => p.code === code))
        .filter(p => p);
      
      if (statePollutants.length > 0) {
        const avgValue = statePollutants.reduce((sum, p) => sum + (p.concentration?.value || 0), 0) / statePollutants.length;
        const sample = statePollutants[0];
        
        detailedPollutants.push({
          code: sample.code,
          display_name: sample.display_name,
          full_name: sample.full_name,
          concentration: {
            value: Math.round(avgValue * 100) / 100,
            units: sample.concentration?.units || ''
          }
        });
      }
    });

    return {
      datetime: stateDocs[0].datetime,
      latitude: parseFloat(metadata.country.latitude),
      longitude: parseFloat(metadata.country.longitude),
      country: metadata.country.country,
      state: '',
      city: '',
      is_country_metro_city: false,
      is_state_metro_city: false,
      aqi: avgAQI,
      aqi_scale: avgScale,
      pollutants: avgPollutants,
      google_data: {
        region_code: stateDocs[0].google_data?.region_code,
        universal_aqi: {
          aqi: avgAQI,
          category: this.getDominantCategory(stateDocs, 'universal_aqi'),
          dominant_pollutant: stateDocs[0].google_data?.universal_aqi?.dominant_pollutant
        },
        local_aqi: {
          aqi: this.calculateAverage(stateDocs, 'google_data.local_aqi.aqi'),
          category: this.getDominantCategory(stateDocs, 'local_aqi'),
          dominant_pollutant: stateDocs[0].google_data?.local_aqi?.dominant_pollutant,
          code: stateDocs[0].google_data?.local_aqi?.code,
          display_name: stateDocs[0].google_data?.local_aqi?.display_name
        },
        detailed_pollutants: detailedPollutants,
        health_recommendations: this.getMostRestrictiveRecommendation(stateDocs)
      }
    };
  }

  // Main ingestion process
  async fetchAndStoreAQIData() {
    console.log(`🚀 Starting enhanced AQI data ingestion at ${new Date().toISOString()}`);
    
    try {
      // Connect to MongoDB
      await mongoose.connect(process.env.MONGO_URI);
      console.log('✅ Connected to MongoDB');

      // Load metadata
      const metadata = await this.loadCitiesMetadata();
      console.log(`📊 Loaded ${metadata.cities.length} cities, ${metadata.states.length} states`);
      
      const cityDocs = [];
      const failedCities = [];

      // Fetch data for each city
      for (const cityMeta of metadata.cities) {
        try {
          const googleData = await this.fetchAQIData(cityMeta.latitude, cityMeta.longitude);
          const cityDoc = this.mapGoogleToInternalFormat(googleData, cityMeta);
          cityDocs.push(cityDoc);

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error) {
          console.warn(`⚠️ Failed to fetch ${cityMeta.city}: ${error.message}`);
          failedCities.push(cityMeta.city);
        }
      }

      if (cityDocs.length === 0) {
        throw new Error('No city data was successfully fetched');
      }

      console.log(`📥 Successfully fetched ${cityDocs.length} cities with enhanced data, ${failedCities.length} failed`);

      // Insert city data
      await CityAQI.insertMany(cityDocs);
      console.log(`✅ Inserted ${cityDocs.length} city records with complete Google data`);

      // Aggregate and insert state data
      const stateData = this.aggregateStateData(cityDocs, metadata);
      if (stateData.length > 0) {
        await StateAQI.insertMany(stateData);
        console.log(`✅ Inserted ${stateData.length} state records with aggregated data`);
      }

      // Aggregate and insert country data
      const countryData = this.aggregateCountryData(stateData, metadata);
      if (countryData) {
        await CountryAQI.create(countryData);
        console.log(`✅ Inserted country record with national data`);
      }

      await mongoose.disconnect();
      
      const result = {
        success: true,
        timestamp: new Date().toISOString(),
        citiesProcessed: cityDocs.length,
        citiesFailed: failedCities.length,
        failedCities: failedCities.slice(0, 5),
        features: ['pollutant_concentrations', 'health_recommendations', 'local_aqi', 'universal_aqi']
      };

      console.log('🎉 Enhanced ingestion completed successfully with full Google API data');
      return result;

    } catch (error) {
      console.error('❌ Enhanced ingestion failed:', error.message);
      await mongoose.disconnect();
      throw error;
    }
  }
}

// Script execution
(async () => {
  const service = new GoogleAQIService();
  
  try {
    const result = await service.fetchAndStoreAQIData();
    console.log('📋 Final result:', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('💥 Script failed:', error.message);
    process.exit(1);
  }
})();