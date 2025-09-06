const City = require("../models/CityAQI");
const { CustomResponse, APIConstants } = require("../utils/apiconst");

// Function to calculate string similarity (Levenshtein distance based)
const calculateSimilarity = (str1, str2) => {
	const s1 = str1.toLowerCase();
	const s2 = str2.toLowerCase();
	
	// Exact match gets highest score
	if (s1 === s2) return 100;
	
	// Check if one string contains the other
	if (s1.includes(s2) || s2.includes(s1)) return 90;
	
	// Check if query starts with search term
	if (s1.startsWith(s2) || s2.startsWith(s1)) return 80;
	
	// Levenshtein distance calculation
	const matrix = [];
	const len1 = s1.length;
	const len2 = s2.length;
	
	for (let i = 0; i <= len2; i++) {
		matrix[i] = [i];
	}
	
	for (let j = 0; j <= len1; j++) {
		matrix[0][j] = j;
	}
	
	for (let i = 1; i <= len2; i++) {
		for (let j = 1; j <= len1; j++) {
			if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
				matrix[i][j] = matrix[i - 1][j - 1];
			} else {
				matrix[i][j] = Math.min(
					matrix[i - 1][j - 1] + 1,
					matrix[i][j - 1] + 1,
					matrix[i - 1][j] + 1
				);
			}
		}
	}
	
	const distance = matrix[len2][len1];
	const maxLength = Math.max(len1, len2);
	return Math.max(0, ((maxLength - distance) / maxLength) * 70);
};

// Get latest AQI for location
const getLatestAQI = async (country, state = null, city = null) => {
	try {
		const filter = { country: new RegExp(`^${country}$`, "i") };
		if (state) filter.state = new RegExp(`^${state}$`, "i");
		if (city) filter.city = new RegExp(`^${city}$`, "i");
		
		const data = await City.findOne(filter).sort({ datetime: -1 });
		return data ? data.aqi : null;
	} catch (err) {
		return null;
	}
};

// Format location display name
const formatLocationName = (city, state, country) => {
	const parts = [];
	if (city) parts.push(city);
	if (state) parts.push(state);
	if (country) parts.push(country);
	return parts.join(", ");
};

// Generate URL based on hierarchy
const generateURL = (country, state = null, city = null) => {
	let url = `/api/${encodeURIComponent(country)}`;
	if (state) url += `/${encodeURIComponent(state)}`;
	if (city) url += `/${encodeURIComponent(city)}`;
	return url;
};

// Search locations with hierarchy and similarity scoring
const searchLocations = async (req, res) => {
	try {
		const { query, limit = 10 } = req.query;
		
		if (!query || query.trim().length < 1) {
			return res.json(
				CustomResponse(
					"Search query is required",
					APIConstants.Status.Failure,
					APIConstants.StatusCode.BadRequest,
					{},
					"Query parameter is missing or empty"
				)
			);
		}
		
		const searchTerm = query.trim();
		const results = [];
		
		// Get unique countries, states, and cities from database
		const countries = await City.distinct("country");
		const states = await City.distinct("state");
		const cities = await City.distinct("city");
		
		// Search countries
		for (const country of countries) {
			if (!country || !country.trim()) continue;
			
			const similarity = calculateSimilarity(country, searchTerm);
			if (similarity > 30) { // Threshold for relevance
				const aqi = await getLatestAQI(country);
				results.push({
					type: "country",
					name: formatLocationName(null, null, country),
					country: country,
					state: null,
					city: null,
					aqi: aqi,
					url: generateURL(country),
					similarity: similarity + 30, // Boost country results
					hierarchy_level: 1
				});
			}
		}
		
		// Search states
		for (const state of states) {
			if (!state || !state.trim()) continue;
			
			const similarity = calculateSimilarity(state, searchTerm);
			if (similarity > 30) {
				// Find which country this state belongs to
				const stateData = await City.findOne({ 
					state: new RegExp(`^${state}$`, "i") 
				});
				
				if (stateData) {
					const aqi = await getLatestAQI(stateData.country, state);
					results.push({
						type: "state",
						name: formatLocationName(null, state, stateData.country),
						country: stateData.country,
						state: state,
						city: null,
						aqi: aqi,
						url: generateURL(stateData.country, state),
						similarity: similarity + 20, // Boost state results
						hierarchy_level: 2
					});
				}
			}
		}
		
		// Search cities
		for (const city of cities) {
			if (!city || !city.trim()) continue;
			
			const similarity = calculateSimilarity(city, searchTerm);
			if (similarity > 30) {
				// Find which state and country this city belongs to
				const cityData = await City.findOne({ 
					city: new RegExp(`^${city}$`, "i") 
				});
				
				if (cityData) {
					const aqi = await getLatestAQI(cityData.country, cityData.state, city);
					results.push({
						type: "city",
						name: formatLocationName(city, cityData.state, cityData.country),
						country: cityData.country,
						state: cityData.state,
						city: city,
						aqi: aqi,
						url: generateURL(cityData.country, cityData.state, city),
						similarity: similarity + 10, // Base city results
						hierarchy_level: 3
					});
				}
			}
		}
		
		// Sort results by hierarchy (country > state > city) and then by similarity
		results.sort((a, b) => {
			// First sort by hierarchy level (lower number = higher priority)
			if (a.hierarchy_level !== b.hierarchy_level) {
				return a.hierarchy_level - b.hierarchy_level;
			}
			// Then sort by similarity (higher similarity first)
			return b.similarity - a.similarity;
		});
		
		// Limit results
		const limitedResults = results.slice(0, parseInt(limit));
		
		// Clean up response (remove similarity and hierarchy_level from final response)
		const cleanResults = limitedResults.map(result => ({
			type: result.type,
			name: result.name,
			country: result.country,
			state: result.state,
			city: result.city,
			aqi: result.aqi,
			url: result.url
		}));
		
		return res.json(
			CustomResponse(
				`Found ${cleanResults.length} results for "${searchTerm}"`,
				APIConstants.Status.Success,
				APIConstants.StatusCode.Ok,
				{
					query: searchTerm,
					results: cleanResults,
					total_count: cleanResults.length
				}
			)
		);
		
	} catch (err) {
		return res.json(
			CustomResponse(
				"Error while searching locations",
				APIConstants.Status.Failure,
				APIConstants.StatusCode.BadRequest,
				{},
				err.message
			)
		);
	}
};

module.exports = {
	searchLocations,
};