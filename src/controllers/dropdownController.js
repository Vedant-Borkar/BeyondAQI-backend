const City = require("../models/CityAQI");
const { CustomResponse, APIConstants } = require("../utils/apiconst");

// Get all unique countries
const getCountries = async (req, res) => {
	try {
		const countries = await City.distinct("country");
		
		if (!countries || countries.length === 0) {
			throw new Error("No countries found");
		}

		// Sort countries alphabetically, put India first if exists
		const sortedCountries = countries
			.filter(country => country && country.trim())
			.sort((a, b) => {
				if (a === "India") return -1;
				if (b === "India") return 1;
				return a.localeCompare(b);
			});

		return res.json(
			CustomResponse(
				"Successfully fetched countries",
				APIConstants.Status.Success,
				APIConstants.StatusCode.Ok,
				{ countries: sortedCountries }
			)
		);

	} catch (err) {
		return res.json(
			CustomResponse(
				"Error while fetching countries",
				APIConstants.Status.Failure,
				APIConstants.StatusCode.BadRequest,
				{},
				err.message
			)
		);
	}
};

// Get all states by country
const getStatesByCountry = async (req, res) => {
	try {
		const { country = "India" } = req.body;

		const states = await City.distinct("state", {
			country: new RegExp(`^${country}$`, "i")
		});

		if (!states || states.length === 0) {
			throw new Error(`No states found for country: ${country}`);
		}

		// Sort states alphabetically
		const sortedStates = states
			.filter(state => state && state.trim())
			.sort((a, b) => a.localeCompare(b));

		return res.json(
			CustomResponse(
				`Successfully fetched states for ${country}`,
				APIConstants.Status.Success,
				APIConstants.StatusCode.Ok,
				{ 
					country: country,
					states: sortedStates 
				}
			)
		);

	} catch (err) {
		return res.json(
			CustomResponse(
				"Error while fetching states",
				APIConstants.Status.Failure,
				APIConstants.StatusCode.BadRequest,
				{},
				err.message
			)
		);
	}
};

// Get all cities by country and state
const getCitiesByState = async (req, res) => {
	try {
		const { country = "India", state } = req.body;

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

		const cities = await City.distinct("city", {
			country: new RegExp(`^${country}$`, "i"),
			state: new RegExp(`^${state}$`, "i")
		});

		if (!cities || cities.length === 0) {
			throw new Error(`No cities found for state: ${state} in country: ${country}`);
		}

		// Sort cities alphabetically
		const sortedCities = cities
			.filter(city => city && city.trim())
			.sort((a, b) => a.localeCompare(b));

		return res.json(
			CustomResponse(
				`Successfully fetched cities for ${state}, ${country}`,
				APIConstants.Status.Success,
				APIConstants.StatusCode.Ok,
				{ 
					country: country,
					state: state,
					cities: sortedCities 
				}
			)
		);

	} catch (err) {
		return res.json(
			CustomResponse(
				"Error while fetching cities",
				APIConstants.Status.Failure,
				APIConstants.StatusCode.BadRequest,
				{},
				err.message
			)
		);
	}
};

module.exports = {
	getCountries,
	getStatesByCountry,
	getCitiesByState,
};