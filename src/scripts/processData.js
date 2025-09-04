require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const parse = require('csv-parse/sync').parse;

const CityAQI = require('../models/CityAQI');
const StateAQI = require('../models/StateAQI');
const CountryAQI = require('../models/CountryAQI');
const { computeIndiaAQI } = require('../utils/aqi');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Load metadata
    const citiesCsv = fs.readFileSync(path.join(__dirname, '../data/cities.csv'), 'utf-8');
    const statesCsv = fs.readFileSync(path.join(__dirname, '../data/states.csv'), 'utf-8');
    const countryCsv = fs.readFileSync(path.join(__dirname, '../data/countries.csv'), 'utf-8');
    const cityMeta = parse(citiesCsv, { columns: true, skip_empty_lines: true });
    const stateMeta = parse(statesCsv, { columns: true, skip_empty_lines: true });
    const countryMeta = parse(countryCsv, { columns: true, skip_empty_lines: true })[0];

    const cityIndex = new Map(cityMeta.map(r => [r.city, r]));
    const stateIndex = new Map(stateMeta.map(r => [r.state, r]));

    // Load raw city readings
    const readings = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../data/sample_city_readings.json'), 'utf-8')
    );

    // Group readings by timestamp
    const grouped = readings.reduce((acc, r) => {
      const ts = new Date(r.datetime).toISOString(); // ensure UTC ISO string
      if (!acc[ts]) acc[ts] = [];
      acc[ts].push(r);
      return acc;
    }, {});

    // Sort timestamps ascending → latest will be last
    const timestamps = Object.keys(grouped).sort();

    for (const ts of timestamps) {
      const datetime = new Date(ts);

      // 1) Insert City docs for this timestamp
      const cityDocs = [];
      for (const r of grouped[ts]) {
        const meta = cityIndex.get(r.city);
        if (!meta) {
          console.warn(`⚠️ No metadata for city ${r.city}`);
          continue;
        }

        const comp = r.data.list[0].components;
        const aqiObj = computeIndiaAQI(comp);
        if (!aqiObj) {
          console.warn(`⚠️ No AQI computed for ${r.city}`);
          continue;
        }

        cityDocs.push({
          datetime,
          latitude: +meta.latitude,
          longitude: +meta.longitude,
          city: r.city,
          state: meta.state,
          country: meta.country,
          is_country_metro_city: meta.is_country_metro_city === 'true',
          is_state_metro_city: meta.is_state_metro_city === 'true',
          aqi: aqiObj.aqi,
          aqi_scale: aqiObj.scale,
          pollutants: {
            co: +comp.co,
            no: +comp.no,
            no2: +comp.no2,
            o3: +comp.o3,
            so2: +comp.so2,
            pm2_5: +comp.pm2_5,
            pm10: +comp.pm10,
            nh3: +comp.nh3,
          },
        });
      }
      if (cityDocs.length > 0) {
        await CityAQI.insertMany(cityDocs);
        console.log(`✅ Inserted ${cityDocs.length} city docs for ${datetime}`);
      }

      // 2) Aggregate to States
      const states = [...new Set(cityDocs.map(d => d.state))];
      const stateDocs = [];
      for (const s of states) {
        const citiesInState = cityDocs.filter(d => d.state === s);
        if (citiesInState.length === 0) continue;

        const avg = key =>
          citiesInState.reduce((sum, d) => sum + (d.pollutants[key] || 0), 0) /
          citiesInState.length;

        const p = {
          co: avg('co'),
          no: avg('no'),
          no2: avg('no2'),
          o3: avg('o3'),
          so2: avg('so2'),
          pm2_5: avg('pm2_5'),
          pm10: avg('pm10'),
          nh3: avg('nh3'),
        };
        const aqiObj = computeIndiaAQI(p);
        const sm = stateIndex.get(s);
        if (!sm) {
          console.warn(`⚠️ No state meta for ${s}`);
          continue;
        }

        stateDocs.push({
          datetime,
          latitude: +sm.latitude,
          longitude: +sm.longitude,
          state: s,
          country: sm.country,
          city: '',
          is_country_metro_city: false,
          is_state_metro_city: false,
          aqi: aqiObj?.aqi || null,
          aqi_scale: aqiObj?.scale || null,
          pollutants: p,
        });
      }
      if (stateDocs.length > 0) {
        await StateAQI.insertMany(stateDocs);
        console.log(`✅ Inserted ${stateDocs.length} state docs for ${datetime}`);
      }

      // 3) Aggregate to Country
      const countryStates = stateDocs.filter(d => d.country === countryMeta.country);
      if (countryStates.length > 0) {
        const avg = key =>
          countryStates.reduce((sum, d) => sum + (d.pollutants[key] || 0), 0) /
          countryStates.length;

        const pC = {
          co: avg('co'),
          no: avg('no'),
          no2: avg('no2'),
          o3: avg('o3'),
          so2: avg('so2'),
          pm2_5: avg('pm2_5'),
          pm10: avg('pm10'),
          nh3: avg('nh3'),
        };
        const aqiC = computeIndiaAQI(pC);

        await CountryAQI.create({
          datetime,
          latitude: +countryMeta.latitude,
          longitude: +countryMeta.longitude,
          country: countryMeta.country,
          state: '',
          city: '',
          is_country_metro_city: false,
          is_state_metro_city: false,
          aqi: aqiC?.aqi || null,
          aqi_scale: aqiC?.scale || null,
          pollutants: pC,
        });

        console.log(`✅ Inserted country doc for ${datetime}`);
      }
    }

    await mongoose.disconnect();
    console.log('🎉 All done.');
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
