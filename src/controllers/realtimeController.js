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
	// Puff score calculation based on AQI ranges
	if (aqiScale === 1) return Math.round(aqiValue * 0.02); // Good: 0-50
	if (aqiScale === 2) return Math.round(aqiValue * 0.06); // Moderate: 51-100
	if (aqiScale === 3) return Math.round(aqiValue * 0.08); // USG: 101-150
	if (aqiScale === 4) return Math.round(aqiValue * 0.12); // Unhealthy: 151-200
	if (aqiScale === 5) return Math.round(aqiValue * 0.15); // Very Unhealthy: 201-300
	if (aqiScale === 6) return Math.round(aqiValue * 0.20); // Hazardous: 301+
	return 0;
};

// Get real-time states data for a country
const getRealtimeStatesByCountry = async (req, res) => {
	try {
		const { country } = req.params;
		const { page = 1, limit = 20 } = req.query;

		const pageNum = Number(page);
		const limitNum = Number(limit);
		const skip = (pageNum - 1) * limitNum;

		// Get latest timestamp for each unique state using aggregation
		const latestStatesData = await City.aggregate([
			{
				$match: {
					country: new RegExp(`^${country}$`, "i")
				}
			},
			{
				$sort: { datetime: -1 }
			},
			{
				$group: {
					_id: { state: "$state" },
					latestData: { $first: "$$ROOT" }
				}
			},
			{
				$replaceRoot: { newRoot: "$latestData" }
			},
			{
				$sort: { aqi: -1 }
			}
		]);

		if (!latestStatesData || latestStatesData.length === 0) {
			throw new Error(`No states found for country: ${country}`);
		}

		const total = latestStatesData.length;
		
		// Apply pagination
		const states = latestStatesData.slice(skip, skip + limitNum);

		// Format response with ranks
		const responseData = {
			country: country,
			states: states.map((state, index) => ({
				rank: skip + index + 1,
				state: state.state,
				country: state.country,
				aqi: state.aqi,
				aqi_scale: state.aqi_scale,
				aqi_status: getAqiStatusFromScale(state.aqi_scale),
				puff_score: calculatePuffScore(state.aqi, state.aqi_scale),
				timestamp: state.datetime,
				location: {
					latitude: state.latitude,
					longitude: state.longitude
				}
			}))
		};

		const finalData = {
			...responseData,
			pagination: {
				total,
				page: pageNum,
				limit: limitNum,
				totalPages: Math.ceil(total / limitNum)
			}
		};

		return res.json(
			CustomResponse(
				`Successfully fetched real-time states data for ${country}`,
				APIConstants.Status.Success,
				APIConstants.StatusCode.Ok,
				finalData
			)
		);

	} catch (err) {
		return res.json(
			CustomResponse(
				"Error while fetching real-time states data",
				APIConstants.Status.Failure,
				APIConstants.StatusCode.BadRequest,
				{},
				err.message
			)
		);
	}
};

// Get real-time cities data for a state
const getRealtimeCitiesByState = async (req, res) => {
	try {
		const { country, state } = req.params;
		const { page = 1, limit = 20 } = req.query;

		const pageNum = Number(page);
		const limitNum = Number(limit);
		const skip = (pageNum - 1) * limitNum;

		// Get latest timestamp for each unique city using aggregation
		const latestCitiesData = await City.aggregate([
			{
				$match: {
					country: new RegExp(`^${country}$`, "i"),
					state: new RegExp(`^${state}$`, "i")
				}
			},
			{
				$sort: { datetime: -1 }
			},
			{
				$group: {
					_id: { city: "$city" },
					latestData: { $first: "$$ROOT" }
				}
			},
			{
				$replaceRoot: { newRoot: "$latestData" }
			},
			{
				$sort: { aqi: -1 }
			}
		]);

		if (!latestCitiesData || latestCitiesData.length === 0) {
			throw new Error(`No cities found for state: ${state} in country: ${country}`);
		}

		const total = latestCitiesData.length;
		
		// Apply pagination
		const cities = latestCitiesData.slice(skip, skip + limitNum);

		// Format response with ranks
		const responseData = {
			country: country,
			state: state,
			cities: cities.map((city, index) => ({
				rank: skip + index + 1,
				city: city.city,
				state: city.state,
				country: city.country,
				aqi: city.aqi,
				aqi_scale: city.aqi_scale,
				aqi_status: getAqiStatusFromScale(city.aqi_scale),
				puff_score: calculatePuffScore(city.aqi, city.aqi_scale),
				timestamp: city.datetime,
				location: {
					latitude: city.latitude,
					longitude: city.longitude
				},
				pollutants: city.pollutants
			}))
		};

		const finalData = {
			...responseData,
			pagination: {
				total,
				page: pageNum,
				limit: limitNum,
				totalPages: Math.ceil(total / limitNum)
			}
		};

		return res.json(
			CustomResponse(
				`Successfully fetched real-time cities data for ${state}, ${country}`,
				APIConstants.Status.Success,
				APIConstants.StatusCode.Ok,
				finalData
			)
		);

	} catch (err) {
		return res.json(
			CustomResponse(
				"Error while fetching real-time cities data",
				APIConstants.Status.Failure,
				APIConstants.StatusCode.BadRequest,
				{},
				err.message
			)
		);
	}
};

module.exports = {
	getRealtimeStatesByCountry,
	getRealtimeCitiesByState,
};