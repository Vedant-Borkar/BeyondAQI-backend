const City = require("../models/CityAQI");
const State = require("../models/StateAQI");
const Country = require("../models/CountryAQI");
const { CustomResponse, APIConstants } = require("../utils/apiconst");

// Helper: case-insensitive filters + timestamp handling
const findWithTimestamp = async (Model, filter, timestamp) => {
	const caseInsensitiveFilter = Object.fromEntries(
		Object.entries(filter).map(([key, value]) => [
			key,
			typeof value === "string" ? new RegExp(`^${value}$`, "i") : value,
		])
	);

	if (timestamp) {
		return await Model.findOne({
			...caseInsensitiveFilter,
			datetime: new Date(timestamp),
		});
	} else {
		return await Model.findOne(caseInsensitiveFilter).sort({ datetime: -1 }); // latest
	}
};

// Country
const getCountryData = async (req, res) => {
	try {
		const { country } = req.params;
		const { timestamp } = req.query;

		const data = await findWithTimestamp(Country, { country }, timestamp);
		if (!data) throw new Error("No data found");

		return res.json(
			CustomResponse("Successfully Fetch", APIConstants.Status.Success, APIConstants.StatusCode.Ok, data)
		);
	} catch (err) {
		return res.json(
			CustomResponse("Error while fetching", APIConstants.Status.Failure, APIConstants.StatusCode.BadRequest, {}, err.message)
		);
	}
};

// State
const getStateData = async (req, res) => {
	try {
		const { country, state } = req.params;
		const { timestamp } = req.query;

		const data = await findWithTimestamp(State, { country, state }, timestamp);
		if (!data) throw new Error("No data found");

		return res.json(
			CustomResponse("Successfully Fetch", APIConstants.Status.Success, APIConstants.StatusCode.Ok, data)
		);
	} catch (err) {
		return res.json(
			CustomResponse("Error while fetching", APIConstants.Status.Failure, APIConstants.StatusCode.BadRequest, {}, err.message)
		);
	}
};

// City
const getCityData = async (req, res) => {
	try {
		const { country, state, city } = req.params;
		const { timestamp } = req.query;

		const data = await findWithTimestamp(City, { country, state, city }, timestamp);
		if (!data) throw new Error("No data found");

		return res.json(
			CustomResponse("Successfully Fetch", APIConstants.Status.Success, APIConstants.StatusCode.Ok, data)
		);
	} catch (err) {
		return res.json(
			CustomResponse("Error while fetching", APIConstants.Status.Failure, APIConstants.StatusCode.BadRequest, {}, err.message)
		);
	}
};

// Country Metro Cities
const getCountryMetroCities = async (req, res) => {
	try {
		const { country } = req.params;
		const latestRecord = await City.findOne({ country: new RegExp(`^${country}$`, "i") }).sort({ datetime: -1 });
		if (!latestRecord) throw new Error("No data found");

		const latestTimestamp = latestRecord.datetime;


		const metros = await City.find({
			country: new RegExp(`^${country}$`, "i"),
			is_country_metro_city: true,
			datetime: latestTimestamp,
		});

		const responseData = {
			timestamp: latestTimestamp,
			cities: metros.map((c) => ({
				city: c.city,
				state: c.state,
				aqi: c.aqi,
			})),
		};

		return res.json(
			CustomResponse("Successfully Fetch", APIConstants.Status.Success, APIConstants.StatusCode.Ok, responseData)
		);
	} catch (err) {
		return res.json(
			CustomResponse("Error while fetching metros", APIConstants.Status.Failure, APIConstants.StatusCode.BadRequest, {}, err.message)
		);
	}
};

// State Metro Cities
const getStateMetroCities = async (req, res) => {
	try {
		const { country, state } = req.params;

		const latestRecord = await City.findOne({ country: new RegExp(`^${country}$`, "i"), state: new RegExp(`^${state}$`, "i"), }).sort({ datetime: -1 });
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
			cities: metros.map((c) => ({
				city: c.city,
				state: c.state,
				aqi: c.aqi,
			})),
		};

		return res.json(
			CustomResponse("Successfully Fetch", APIConstants.Status.Success, APIConstants.StatusCode.Ok, responseData)
		);
	} catch (err) {
		return res.json(
			CustomResponse("Error while fetching metros", APIConstants.Status.Failure, APIConstants.StatusCode.BadRequest, {}, err.message)
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
