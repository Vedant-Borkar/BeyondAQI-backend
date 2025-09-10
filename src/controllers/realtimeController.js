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

const getRealtimeStatesByCountry = async (req, res) => {
	try {
		const { country } = req.params;
		const { page = 1, limit = 20, search = "" } = req.query;

		const pageNum = Number(page);
		const limitNum = Number(limit);
		const skip = (pageNum - 1) * limitNum;

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

		let filteredStates = latestStatesData;

		if (search && search.trim()) {
			const searchTerm = search.trim().toLowerCase();
			filteredStates = latestStatesData.filter(state => 
				state.state.toLowerCase().includes(searchTerm)
			);
		}

		const total = filteredStates.length;
		const paginatedStates = filteredStates.slice(skip, skip + limitNum);

		const responseData = {
			country: country,
			...(search ? { search: search } : {}),
			states: paginatedStates.map((state, index) => ({
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

const getRealtimeCitiesByState = async (req, res) => {
	try {
		const { country, state } = req.params;
		const { page = 1, limit = 20, search = "" } = req.query;

		const pageNum = Number(page);
		const limitNum = Number(limit);
		const skip = (pageNum - 1) * limitNum;

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

		let filteredCities = latestCitiesData;

		if (search && search.trim()) {
			const searchTerm = search.trim().toLowerCase();
			filteredCities = latestCitiesData.filter(city => 
				city.city.toLowerCase().includes(searchTerm)
			);
		}

		const total = filteredCities.length;
		const paginatedCities = filteredCities.slice(skip, skip + limitNum);

		const responseData = {
			country: country,
			state: state,
			...(search ? { search: search } : {}),
			cities: paginatedCities.map((city, index) => ({
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