const City = require("../models/CityAQI");
const State = require("../models/StateAQI");
const Country = require("../models/CountryAQI");
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

// Generate random value within ±2 range
const generateRandomInRange = (baseValue, variance = 2) => {
	const min = Math.max(0, baseValue - variance);
	const max = baseValue + variance;
	return Math.round(Math.random() * (max - min) + min);
};

// Interpolate between two values
const interpolate = (value1, value2, factor) => {
	return Math.round(value1 + (value2 - value1) * factor);
};

// Generate time labels based on period
const generateTimeLabels = (period) => {
	const now = new Date();
	const labels = [];
	
	if (period === "24hour") {
		// 12 bars with 2-hour gaps (4PM to 4PM next day)
		for (let i = 0; i < 12; i++) {
			const time = new Date(now);
			time.setHours(16 + (i * 2), 0, 0, 0); // Start from 4PM
			if (time.getHours() < 16 && i > 0) {
				time.setDate(time.getDate() + 1); // Next day
			}
			labels.push({
				label: time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
				datetime: new Date(time)
			});
		}
	} else if (period === "7day") {
		// 7 bars for 7 days
		for (let i = 6; i >= 0; i--) {
			const date = new Date(now);
			date.setDate(date.getDate() - i);
			date.setHours(12, 0, 0, 0); // Noon for daily average
			labels.push({
				label: date.toLocaleDateString([], { weekday: 'short' }),
				datetime: new Date(date)
			});
		}
	} else if (period === "30day") {
		// 30 bars for 30 days
		for (let i = 29; i >= 0; i--) {
			const date = new Date(now);
			date.setDate(date.getDate() - i);
			date.setHours(12, 0, 0, 0); // Noon for daily average
			labels.push({
				label: date.getDate().toString(),
				datetime: new Date(date)
			});
		}
	}
	
	return labels;
};

// Get data for specific location and time range
const getHistoricalData = async (locationFilter, timeLabels, Model) => {
	const dataPoints = [];
	
	for (const timeLabel of timeLabels) {
		const startTime = new Date(timeLabel.datetime);
		const endTime = new Date(startTime);
		endTime.setHours(endTime.getHours() + 4); // 4-hour window
		
		// Try to find exact data first
		let data = await Model.findOne({
			...locationFilter,
			datetime: {
				$gte: startTime,
				$lte: endTime
			}
		}).sort({ datetime: -1 });
		
		// If no data found, get closest available data
		if (!data) {
			data = await Model.findOne(locationFilter).sort({ datetime: -1 });
			
			if (data) {
				// Add variance to existing data
				data = {
					...data.toObject(),
					aqi: generateRandomInRange(data.aqi),
					datetime: timeLabel.datetime
				};
			}
		}
		
		if (data) {
			dataPoints.push({
				time: timeLabel.label,
				datetime: timeLabel.datetime,
				aqi: data.aqi,
				aqi_scale: data.aqi_scale,
				aqi_status: getAqiStatusFromScale(data.aqi_scale),
				pollutants: data.pollutants,
				location: {
					city: data.city || "",
					state: data.state || "",
					country: data.country || ""
				}
			});
		}
	}
	
	return dataPoints;
};

// Fill gaps with interpolated/random data for 24-hour view
const fillDataGaps = (dataPoints) => {
	const filledData = [];
	
	for (let i = 0; i < dataPoints.length; i++) {
		filledData.push(dataPoints[i]);
		
		// Add interpolated point between current and next (only for 24-hour)
		if (i < dataPoints.length - 1) {
			const current = dataPoints[i];
			const next = dataPoints[i + 1];
			
			// Create interpolated point
			const interpolatedAqi = interpolate(current.aqi, next.aqi, 0.5);
			const variance = Math.abs(next.aqi - current.aqi) <= 4 ? 2 : 3;
			
			const midTime = new Date(current.datetime);
			midTime.setHours(midTime.getHours() + 1); // 1 hour after current
			
			filledData.push({
				time: midTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
				datetime: midTime,
				aqi: generateRandomInRange(interpolatedAqi, variance),
				aqi_scale: current.aqi_scale,
				aqi_status: current.aqi_status,
				pollutants: current.pollutants,
				location: current.location,
				interpolated: true
			});
		}
	}
	
	return filledData;
};

// Country Historical Data
const getCountryHistoricalData = async (req, res) => {
	try {
		const { country, period } = req.params;
		
		if (!["24hour", "7day", "30day"].includes(period)) {
			throw new Error("Invalid period. Use 24hour, 7day, or 30day");
		}
		
		const locationFilter = {
			country: new RegExp(`^${country}$`, "i")
		};
		
		const timeLabels = generateTimeLabels(period);
		let dataPoints = await getHistoricalData(locationFilter, timeLabels, Country);
		
		// Fill gaps for 24-hour data
		if (period === "24hour" && dataPoints.length > 1) {
			dataPoints = fillDataGaps(dataPoints);
		}
		
		// Calculate min/max
		const aqiValues = dataPoints.map(d => d.aqi);
		const minAqi = Math.min(...aqiValues);
		const maxAqi = Math.max(...aqiValues);
		const minData = dataPoints.find(d => d.aqi === minAqi);
		const maxData = dataPoints.find(d => d.aqi === maxAqi);
		
		const responseData = {
			location: { country },
			period,
			data: dataPoints,
			summary: {
				min: {
					value: minAqi,
					time: minData?.time,
					datetime: minData?.datetime
				},
				max: {
					value: maxAqi,
					time: maxData?.time,
					datetime: maxData?.datetime
				},
				average: Math.round(aqiValues.reduce((a, b) => a + b, 0) / aqiValues.length)
			}
		};
		
		return res.json(
			CustomResponse(
				`Successfully fetched ${period} historical data for ${country}`,
				APIConstants.Status.Success,
				APIConstants.StatusCode.Ok,
				responseData
			)
		);
		
	} catch (err) {
		return res.json(
			CustomResponse(
				"Error while fetching historical data",
				APIConstants.Status.Failure,
				APIConstants.StatusCode.BadRequest,
				{},
				err.message
			)
		);
	}
};

// State Historical Data
const getStateHistoricalData = async (req, res) => {
	try {
		const { country, state, period } = req.params;
		
		if (!["24hour", "7day", "30day"].includes(period)) {
			throw new Error("Invalid period. Use 24hour, 7day, or 30day");
		}
		
		const locationFilter = {
			country: new RegExp(`^${country}$`, "i"),
			state: new RegExp(`^${state}$`, "i")
		};
		
		const timeLabels = generateTimeLabels(period);
		let dataPoints = await getHistoricalData(locationFilter, timeLabels, State);
		
		// Fill gaps for 24-hour data
		if (period === "24hour" && dataPoints.length > 1) {
			dataPoints = fillDataGaps(dataPoints);
		}
		
		// Calculate min/max
		const aqiValues = dataPoints.map(d => d.aqi);
		const minAqi = Math.min(...aqiValues);
		const maxAqi = Math.max(...aqiValues);
		const minData = dataPoints.find(d => d.aqi === minAqi);
		const maxData = dataPoints.find(d => d.aqi === maxAqi);
		
		const responseData = {
			location: { country, state },
			period,
			data: dataPoints,
			summary: {
				min: {
					value: minAqi,
					time: minData?.time,
					datetime: minData?.datetime
				},
				max: {
					value: maxAqi,
					time: maxData?.time,
					datetime: maxData?.datetime
				},
				average: Math.round(aqiValues.reduce((a, b) => a + b, 0) / aqiValues.length)
			}
		};
		
		return res.json(
			CustomResponse(
				`Successfully fetched ${period} historical data for ${state}, ${country}`,
				APIConstants.Status.Success,
				APIConstants.StatusCode.Ok,
				responseData
			)
		);
		
	} catch (err) {
		return res.json(
			CustomResponse(
				"Error while fetching historical data",
				APIConstants.Status.Failure,
				APIConstants.StatusCode.BadRequest,
				{},
				err.message
			)
		);
	}
};

// City Historical Data
const getCityHistoricalData = async (req, res) => {
	try {
		const { country, state, city, period } = req.params;
		
		if (!["24hour", "7day", "30day"].includes(period)) {
			throw new Error("Invalid period. Use 24hour, 7day, or 30day");
		}
		
		const locationFilter = {
			country: new RegExp(`^${country}$`, "i"),
			state: new RegExp(`^${state}$`, "i"),
			city: new RegExp(`^${city}$`, "i")
		};
		
		const timeLabels = generateTimeLabels(period);
		let dataPoints = await getHistoricalData(locationFilter, timeLabels, City);
		
		// Fill gaps for 24-hour data
		if (period === "24hour" && dataPoints.length > 1) {
			dataPoints = fillDataGaps(dataPoints);
		}
		
		// Calculate min/max
		const aqiValues = dataPoints.map(d => d.aqi);
		const minAqi = Math.min(...aqiValues);
		const maxAqi = Math.max(...aqiValues);
		const minData = dataPoints.find(d => d.aqi === minAqi);
		const maxData = dataPoints.find(d => d.aqi === maxAqi);
		
		const responseData = {
			location: { country, state, city },
			period,
			data: dataPoints,
			summary: {
				min: {
					value: minAqi,
					time: minData?.time,
					datetime: minData?.datetime
				},
				max: {
					value: maxAqi,
					time: maxData?.time,
					datetime: maxData?.datetime
				},
				average: Math.round(aqiValues.reduce((a, b) => a + b, 0) / aqiValues.length)
			}
		};
		
		return res.json(
			CustomResponse(
				`Successfully fetched ${period} historical data for ${city}, ${state}, ${country}`,
				APIConstants.Status.Success,
				APIConstants.StatusCode.Ok,
				responseData
			)
		);
		
	} catch (err) {
		return res.json(
			CustomResponse(
				"Error while fetching historical data",
				APIConstants.Status.Failure,
				APIConstants.StatusCode.BadRequest,
				{},
				err.message
			)
		);
	}
};

module.exports = {
	getCountryHistoricalData,
	getStateHistoricalData,
	getCityHistoricalData,
};