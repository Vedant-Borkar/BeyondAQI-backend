const City = require("../models/CityAQI");
const State = require("../models/StateAQI");
const Country = require("../models/CountryAQI");
const { CustomResponse, APIConstants } = require("../utils/apiconst");

// Helper: find latest or by timestamp
const findWithTimestamp = async (Model, filter, timestamp) => {
	// Convert all string values in filter into case-insensitive regex
	const caseInsensitiveFilter = Object.fromEntries(
		Object.entries(filter).map(([key, value]) => [
			key,
			typeof value === "string" ? new RegExp(`^${value}$`, "i") : value,
		])
	);

	if (timestamp) {
		return await Model.findOne({ ...caseInsensitiveFilter, datetime: new Date(timestamp) });
	} else {
		return await Model.findOne(filter).sort({ datetime: -1 }); // latest
	}
};

// Country
const getCountryData = async (req, res) => {
	try {
		const { country } = req.params;
		const { timestamp } = req.query;

		const data = await findWithTimestamp(Country, { country }, timestamp);
		if (!data) throw new Error('No data found')

		return res.json(CustomResponse("Successfully Fetch", APIConstants.Status.Success, APIConstants.StatusCode.Ok, data));
	} catch (err) {
		return res.json(CustomResponse("Error while fetching", APIConstants.Status.Failure, APIConstants.StatusCode.BadRequest, {}, err.message));
	}
};

// State
const getStateData = async (req, res) => {
	try {
		const { country, state } = req.params;
		const { timestamp } = req.query;

		const data = await findWithTimestamp(State, { country, state }, timestamp);
		if (!data) return new Error('No data found')

		return res.json(CustomResponse("Successfully Fetch", APIConstants.Status.Success, APIConstants.StatusCode.Ok, data));
	} catch (err) {
		return res.json(CustomResponse("Error while fetching", APIConstants.Status.Failure, APIConstants.StatusCode.BadRequest, {}, err.message));
	}
};

// City
const getCityData = async (req, res) => {
	try {
		const { country, state, city } = req.params;
		const { timestamp } = req.query;

		const data = await findWithTimestamp(City, { country, state, city }, timestamp);

		if (!data) throw new Error("No data found")

		return res.json(CustomResponse("Successfully Fetch", APIConstants.Status.Success, APIConstants.StatusCode.Ok, data));

	} catch (err) {

		return res.json(CustomResponse("Error while fetching", APIConstants.Status.Failure, APIConstants.StatusCode.BadRequest, {}, err.message));
	}
};

module.exports = { getCountryData, getStateData, getCityData };