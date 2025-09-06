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

const getMostPollutedCities = async (req, res) => {
	try {
		const { country = "India", state= "" } = req.body;

		let page = Number(req.body?.page) || 1;  // default to 1 (first page for users)
		let limit = Number(req.body?.limit) || 50;

		// Convert to zero-based page for DB
		let skip = limit * (page - 1);

		// Get latest timestamp for each unique city using aggregation
		const latestCitiesData = await City.aggregate([
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
					_id: { city: "$city", state: "$state" },
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

		if (!latestCitiesData || latestCitiesData.length === 0) throw new Error("No data found");

		const total = latestCitiesData.length;
		
		// Apply pagination
		const cities = latestCitiesData.slice(skip, skip + limit);

		// Format response with ranks
		const responseData = {
			cities: cities.map((city, index) => ({
				rank: skip + index + 1,
				city: city.city,
				state: city.state,
				country: city.country,
				aqi: city.aqi,
				aqi_scale: city.aqi_scale,
				aqi_status: getAqiStatusFromScale(city.aqi_scale),
				puff_score: calculatePuffScore(city.aqi, city.aqi_scale),
				timestamp: city.datetime
			}))
		};

		const finalData = {
			...responseData,
			pagination:{
				total,
				page,
				rowPerPage:limit
			},
		};

		return res.json(
			CustomResponse(
				"Successfully fetched most polluted cities",
				APIConstants.Status.Success,
				APIConstants.StatusCode.Ok,
				finalData,
			)
		);

	} catch (err) {
		return res.json(
			CustomResponse(
				"Error while fetching leaderboard",
				APIConstants.Status.Failure,
				APIConstants.StatusCode.BadRequest,
				{},
				err.message
			)
		);
	}
};

const getMostPollutedCitiesByState = async (req, res) => {
	try {
		const { state, country = "India" } = req.body;

		if (!state) {
			return res.json(
				CustomResponse(
					"State parameter is required",
					APIConstants.Status.Failure,
					APIConstants.StatusCode.BadRequest,
					{},
					"State parameter is missing"
				)
			);
		}

		let page = Number(req.body?.page) || 1;
		let limit = Number(req.body?.limit) || 50;

		// Convert to zero-based page for DB
		let skip = limit * (page - 1);

		// Get latest timestamp for each unique city within state using aggregation
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

		if (!latestCitiesData || latestCitiesData.length === 0) throw new Error("No data found for this state");

		const total = latestCitiesData.length;
		
		// Apply pagination
		const cities = latestCitiesData.slice(skip, skip + limit);

		// Format response with ranks
		const responseData = {
			state: state,
			country: country,
			cities: cities.map((city, index) => ({
				rank: skip + index + 1,
				city: city.city,
				state: city.state,
				country: city.country,
				aqi: city.aqi,
				aqi_scale: city.aqi_scale,
				aqi_status: getAqiStatusFromScale(city.aqi_scale),
				puff_score: calculatePuffScore(city.aqi, city.aqi_scale),
				timestamp: city.datetime
			}))
		};

		const finalData = {
			...responseData,
			pagination:{
				total,
				page,
				rowPerPage:limit
			},
		};

		return res.json(
			CustomResponse(
				`Successfully fetched most polluted cities in ${state}`,
				APIConstants.Status.Success,
				APIConstants.StatusCode.Ok,
				finalData,
			)
		);

	} catch (err) {
		return res.json(
			CustomResponse(
				"Error while fetching state leaderboard",
				APIConstants.Status.Failure,
				APIConstants.StatusCode.BadRequest,
				{},
				err.message
			)
		);
	}
};

module.exports = {
	getMostPollutedCities,
	getMostPollutedCitiesByState,
};