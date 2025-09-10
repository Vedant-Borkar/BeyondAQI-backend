const City = require("../models/CityAQI");
const { CustomResponse, APIConstants } = require("../utils/apiconst");

const getAqiStatusFromScale = (scale) => {
	if (scale <= 50) return "Good";
	if (scale <= 100) return "Satisfactory";
	if (scale <= 200) return "Moderate";
	if (scale <= 300) return "Poor";
	if (scale <= 400) return "Very Poor";
	return "Severe";
};

const calculatePuffScore = (aqi, scale) => {
	const baseScore = Math.min(Math.round((scale / 500) * 100), 100);
	const adjustedScore = Math.min(baseScore + (aqi > 300 ? 20 : 0), 100);
	return adjustedScore;
};

const getCountryData = async (req, res) => {
	try {
		const { country } = req.params;

		const data = await City.findOne({
			country: new RegExp(`^${country}$`, "i"),
		}).sort({ datetime: -1 });

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

		const data = await City.findOne({
			country: new RegExp(`^${country}$`, "i"),
			state: new RegExp(`^${state}$`, "i"),
		}).sort({ datetime: -1 });

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

		const data = await City.findOne({
			country: new RegExp(`^${country}$`, "i"),
			state: new RegExp(`^${state}$`, "i"),
			city: new RegExp(`^${city}$`, "i"),
		}).sort({ datetime: -1 });

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

		const pipeline = [
			{
				$match: {
					country: new RegExp(`^${country}$`, "i"),
					is_country_metro_city: true
				}
			},
			{
				$sort: { datetime: -1 }
			},
			{
				$group: {
					_id: "$city",
					latestDoc: { $first: "$$ROOT" }
				}
			},
			{
				$replaceRoot: { newRoot: "$latestDoc" }
			}
		];

		const metros = await City.aggregate(pipeline);

		if (!metros || metros.length === 0) {
			throw new Error("No metro cities found for this country");
		}

		const responseData = {
			timestamp: new Date(),
			country: country,
			total_cities: metros.length,
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

		const pipeline = [
			{
				$match: {
					country: new RegExp(`^${country}$`, "i"),
					state: new RegExp(`^${state}$`, "i"),
					is_state_metro_city: true
				}
			},
			{
				$sort: { datetime: -1 }
			},
			{
				$group: {
					_id: "$city",
					latestDoc: { $first: "$$ROOT" }
				}
			},
			{
				$replaceRoot: { newRoot: "$latestDoc" }
			}
		];

		const metros = await City.aggregate(pipeline);

		if (!metros || metros.length === 0) {
			throw new Error("No metro cities found for this state");
		}

		const responseData = {
			timestamp: new Date(),
			country: country,
			state: state,
			total_cities: metros.length,
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