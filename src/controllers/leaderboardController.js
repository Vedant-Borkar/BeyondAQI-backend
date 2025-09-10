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

const getMostPollutedCities = async (req, res) => {
	try {
		const { country = "India", state = "", search = "", page = 1, limit = 50 } = req.body;

		const pageNum = Number(page);
		const limitNum = Number(limit);
		const skip = limitNum * (pageNum - 1);

		let matchConditions = {
			country: new RegExp(`^${country}$`, "i")
		};

		if (state && state.trim()) {
			matchConditions.state = new RegExp(`^${state}$`, "i");
		}

		const latestCitiesData = await City.aggregate([
			{
				$match: matchConditions
			},
			{
				$sort: { datetime: -1 }
			},
			{
				$group: {
					_id: state ? { city: "$city" } : { city: "$city", state: "$state" },
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
			throw new Error(state ? `No data found for state: ${state}` : "No data found");
		}

		let filteredCities = latestCitiesData;

		if (search && search.trim()) {
			const searchTerm = search.trim().toLowerCase();
			filteredCities = latestCitiesData.filter(city => 
				city.city.toLowerCase().includes(searchTerm) ||
				city.state.toLowerCase().includes(searchTerm)
			);
		}

		const total = filteredCities.length;
		const paginatedCities = filteredCities.slice(skip, skip + limitNum);

		const responseData = {
			...(state ? { state: state } : {}),
			country: country,
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
				timestamp: city.datetime
			}))
		};

		const finalData = {
			...responseData,
			pagination: {
				total,
				page: pageNum,
				rowPerPage: limitNum,
				totalPages: Math.ceil(total / limitNum)
			}
		};

		const message = state 
			? `Successfully fetched most polluted cities in ${state}`
			: "Successfully fetched most polluted cities";

		return res.json(
			CustomResponse(
				message,
				APIConstants.Status.Success,
				APIConstants.StatusCode.Ok,
				finalData
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

module.exports = {
	getMostPollutedCities,
};