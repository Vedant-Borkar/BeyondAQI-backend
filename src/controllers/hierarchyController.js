const City = require("../models/CityAQI");
const { CustomResponse, APIConstants } = require("../utils/apiconst");

const getAqiStatusFromScale = (aqiScale) => {
	switch (aqiScale) {
		case 1: return "Good";
		case 2: return "Moderate";
		case 3: return "Unhealthy for Sensitive Groups";
		case 4: return "Unhealthy";
		case 5: return "Very Unhealthy";
		case 6: return "Hazardous";
		default: return "Unknown";
	}
};

const calculatePuffScore = (aqiValue, aqiScale) => {
	if (aqiScale === 1) return Math.round(aqiValue * 0.02);
	if (aqiScale === 2) return Math.round(aqiValue * 0.06);
	if (aqiScale === 3) return Math.round(aqiValue * 0.08);
	if (aqiScale === 4) return Math.round(aqiValue * 0.12);
	if (aqiScale === 5) return Math.round(aqiValue * 0.15);
	if (aqiScale === 6) return Math.round(aqiValue * 0.20);
	return 0;
};

const findWithTimestamp = async (model, query, timestamp) => {
	if (timestamp) {
		const data = await model.findOne({
			...query,
			datetime: new Date(timestamp)
		});
		if (data) return data;
	}
	
	return await model.findOne(query).sort({ datetime: -1 });
};

const getCountryData = async (req, res) => {
	try {
		const { country } = req.params;
		const { timestamp } = req.query;

		const matchQuery = { country: new RegExp(`^${country}$`, "i") };
		const data = await findWithTimestamp(City, matchQuery, timestamp);
		
		if (!data) throw new Error("No data found");

		const responseData = {
			country: data.country,
			aqi: data.aqi,
			aqi_scale: data.aqi_scale,
			aqi_status: getAqiStatusFromScale(data.aqi_scale),
			puff_score: calculatePuffScore(data.aqi, data.aqi_scale),
			timestamp: data.datetime,
			location: {
				latitude: data.latitude,
				longitude: data.longitude
			},
			pollutants: data.pollutants,
			google_data: data.google_data
		};

		return res.json(
			CustomResponse(
				"Successfully fetched country data",
				APIConstants.Status.Success,
				APIConstants.StatusCode.Ok,
				responseData
			)
		);
	} catch (err) {
		return res.json(
			CustomResponse(
				"Error while fetching country data",
				APIConstants.Status.Failure,
				APIConstants.StatusCode.BadRequest,
				{},
				err.message
			)
		);
	}
};

const getStateData = async (req, res) => {
	try {
		const { country, state } = req.params;
		const { timestamp } = req.query;

		const matchQuery = { 
			country: new RegExp(`^${country}$`, "i"), 
			state: new RegExp(`^${state}$`, "i") 
		};
		const data = await findWithTimestamp(City, matchQuery, timestamp);
		
		if (!data) throw new Error("No data found");

		const responseData = {
			country: data.country,
			state: data.state,
			aqi: data.aqi,
			aqi_scale: data.aqi_scale,
			aqi_status: getAqiStatusFromScale(data.aqi_scale),
			puff_score: calculatePuffScore(data.aqi, data.aqi_scale),
			timestamp: data.datetime,
			location: {
				latitude: data.latitude,
				longitude: data.longitude
			},
			pollutants: data.pollutants,
			google_data: data.google_data
		};

		return res.json(
			CustomResponse(
				"Successfully fetched state data",
				APIConstants.Status.Success,
				APIConstants.StatusCode.Ok,
				responseData
			)
		);
	} catch (err) {
		return res.json(
			CustomResponse(
				"Error while fetching state data",
				APIConstants.Status.Failure,
				APIConstants.StatusCode.BadRequest,
				{},
				err.message
			)
		);
	}
};

const getCityData = async (req, res) => {
	try {
		const { country, state, city } = req.params;
		const { timestamp } = req.query;

		const matchQuery = { 
			country: new RegExp(`^${country}$`, "i"), 
			state: new RegExp(`^${state}$`, "i"), 
			city: new RegExp(`^${city}$`, "i") 
		};
		const data = await findWithTimestamp(City, matchQuery, timestamp);
		
		if (!data) throw new Error("No data found");

		const responseData = {
			country: data.country,
			state: data.state,
			city: data.city,
			aqi: data.aqi,
			aqi_scale: data.aqi_scale,
			aqi_status: getAqiStatusFromScale(data.aqi_scale),
			puff_score: calculatePuffScore(data.aqi, data.aqi_scale),
			timestamp: data.datetime,
			location: {
				latitude: data.latitude,
				longitude: data.longitude
			},
			pollutants: data.pollutants,
			google_data: data.google_data,
			is_country_metro_city: data.is_country_metro_city,
			is_state_metro_city: data.is_state_metro_city
		};

		return res.json(
			CustomResponse(
				"Successfully fetched city data",
				APIConstants.Status.Success,
				APIConstants.StatusCode.Ok,
				responseData
			)
		);
	} catch (err) {
		return res.json(
			CustomResponse(
				"Error while fetching city data",
				APIConstants.Status.Failure,
				APIConstants.StatusCode.BadRequest,
				{},
				err.message
			)
		);
	}
};

const getCountryMetroCities = async (req, res) => {
	try {
		const { country } = req.params;
		const latestRecord = await City.findOne({ 
			country: new RegExp(`^${country}$`, "i") 
		}).sort({ datetime: -1 });
		
		if (!latestRecord) throw new Error("No data found");

		const latestTimestamp = latestRecord.datetime;

		const metros = await City.find({
			country: new RegExp(`^${country}$`, "i"),
			is_country_metro_city: true,
			datetime: latestTimestamp,
		});

		const responseData = {
			timestamp: latestTimestamp,
			country: country,
			cities: metros.map((c) => ({
				city: c.city,
				state: c.state,
				country: c.country,
				aqi: c.aqi,
				aqi_scale: c.aqi_scale,
				aqi_status: getAqiStatusFromScale(c.aqi_scale),
				puff_score: calculatePuffScore(c.aqi, c.aqi_scale),
				location: {
					latitude: c.latitude,
					longitude: c.longitude
				}
			})),
		};

		return res.json(
			CustomResponse(
				"Successfully fetched country metro cities",
				APIConstants.Status.Success,
				APIConstants.StatusCode.Ok,
				responseData
			)
		);
	} catch (err) {
		return res.json(
			CustomResponse(
				"Error while fetching metro cities",
				APIConstants.Status.Failure,
				APIConstants.StatusCode.BadRequest,
				{},
				err.message
			)
		);
	}
};

const getStateMetroCities = async (req, res) => {
	try {
		const { country, state } = req.params;

		const latestRecord = await City.findOne({ 
			country: new RegExp(`^${country}$`, "i"), 
			state: new RegExp(`^${state}$`, "i") 
		}).sort({ datetime: -1 });
		
		if (!latestRecord) throw new Error("No data found");

		const latestTimestamp = latestRecord.datetime;

		const metros = await City.find({
			country: new RegExp(`^${country}$`, "i"),
			state: new RegExp(`^${state}$`, "i"),
			is_state_metro_city: true,
			datetime: latestTimestamp,
		});

		const responseData = {
			timestamp: latestTimestamp,
			country: country,
			state: state,
			cities: metros.map((c) => ({
				city: c.city,
				state: c.state,
				country: c.country,
				aqi: c.aqi,
				aqi_scale: c.aqi_scale,
				aqi_status: getAqiStatusFromScale(c.aqi_scale),
				puff_score: calculatePuffScore(c.aqi, c.aqi_scale),
				location: {
					latitude: c.latitude,
					longitude: c.longitude
				}
			})),
		};

		return res.json(
			CustomResponse(
				"Successfully fetched state metro cities",
				APIConstants.Status.Success,
				APIConstants.StatusCode.Ok,
				responseData
			)
		);
	} catch (err) {
		return res.json(
			CustomResponse(
				"Error while fetching metro cities",
				APIConstants.Status.Failure,
				APIConstants.StatusCode.BadRequest,
				{},
				err.message
			)
		);
	}
};

module.exports = {
	getCountryData,
	getStateData,
	getCityData,
	getCountryMetroCities,
	getStateMetroCities,
};