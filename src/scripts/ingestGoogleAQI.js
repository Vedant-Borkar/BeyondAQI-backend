require('dotenv').config();
const GoogleAQIService = require('../services/googleAQIService');

(async () => {
  console.log('🚀 Starting Google AQI data ingestion...');
  
  const service = new GoogleAQIService();
  
  try {
    const result = await service.fetchAndStoreAQIData();
    console.log('✅ Ingestion completed successfully:', result);
    process.exit(0);
  } catch (error) {
    console.error('❌ Ingestion failed:', error.message);
    process.exit(1);
  }
})();