const StateAQI = require("../models/StateAQI");

exports.getStateData = async (req, res) => {
  try {
    const { state } = req.params;
    const data = await StateAQI.findOne({ state });
    if (!data) return res.status(404).json({ message: "State not found" });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
