//NOT BEING USED CURRENTLY - WILL BE USED IN FUTURE UPDATES
//CURRENTLY IMPLEMENTED THROUGH HIERARCHY CONTROLLER ONLY

const City = require("../models/CityAQI");
const { CustomResponse, APIConstants } = require("../utils/apiconst");

// Country level metro cities
const getCountryMetroCities = async (req, res) => {
  try {
    const { country } = req.params;

    const data = await City.find({ country, is_country_metro_city: true }).sort({ datetime: -1 });

    if (!data || data.length === 0) throw new Error("No metro cities found");

    return res.json(
      CustomResponse(
        "Successfully fetched country metro cities",
        APIConstants.Status.Success,
        APIConstants.StatusCode.Ok,
        data
      )
    );
  } catch (err) {
    return res.json(
      CustomResponse(
        "Error while fetching",
        APIConstants.Status.Failure,
        APIConstants.StatusCode.BadRequest,
        {},
        err.message
      )
    );
  }
};

// State level metro cities
const getStateMetroCities = async (req, res) => {
  try {
    const { country, state } = req.params;

    const data = await City.find({ country, state, is_state_metro_city: true }).sort({ datetime: -1 });

    if (!data || data.length === 0) throw new Error("No state metro cities found");

    return res.json(
      CustomResponse(
        "Successfully fetched state metro cities",
        APIConstants.Status.Success,
        APIConstants.StatusCode.Ok,
        data
      )
    );
  } catch (err) {
    return res.json(
      CustomResponse(
        "Error while fetching",
        APIConstants.Status.Failure,
        APIConstants.StatusCode.BadRequest,
        {},
        err.message
      )
    );
  }
};

module.exports = {
  getCountryMetroCities,
  getStateMetroCities,
};
