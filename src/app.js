const fs = require('fs');
const path = require('path');

if (fs.existsSync(path.join(__dirname, '..', '.env.local'))) {
  require("dotenv").config({ path: '.env.local' });
} else {
  require("dotenv").config();
}

const express = require("express");
const connectDB = require("./config/db");
const hierarchyRoutes = require("./routes/hierarchyRoutes");
const leaderboardRoutes = require("./routes/leaderboardRoutes");
const dropdownRoutes = require("./routes/dropdownRoutes");
const historicalRoutes = require("./routes/historicalRoutes");
const searchRoutes = require("./routes/searchRoutes");
const realtimeRoutes = require("./routes/realtimeRoutes");
const cors = require("cors");
const rateLimiter = require("./middleware/rateLimiter");

const app = express();

app.set('trust proxy', 1);
app.use(rateLimiter);

app.use(express.json({ 
  limit: '10mb',
  strict: true,
  type: 'application/json'
}));

app.use(express.urlencoded({ 
  limit: '10mb',
  extended: true,
  parameterLimit: 1000
}));

const corsConfig = () => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // TEMPORARY: Force development mode for testing
  // Remove this line once testing is complete
  const forceDevelopment = true;
  
  if (isDevelopment || forceDevelopment) {
    return {
      origin: true,
      credentials: true,
      optionsSuccessStatus: 200,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With', 
        'Content-Type', 
        'Accept',
        'Authorization',
        'Cache-Control'
      ],
      exposedHeaders: [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset'
      ]
    };
  } else {
    const allowedOrigins = [
      'https://beyond-main-d.vercel.app'
    ];
    
    return {
      origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          console.warn(`🚫 PROD CORS blocked request from origin: ${origin}`);
          callback(new Error('Not allowed by CORS policy'));
        }
      },
      credentials: true,
      optionsSuccessStatus: 200,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With', 
        'Content-Type', 
        'Accept',
        'Authorization',
        'Cache-Control'
      ],
      exposedHeaders: [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset'
      ]
    };
  }
};

app.use(cors(corsConfig()));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('X-API-Version', '1.0');
  res.setHeader('X-Powered-By', 'BeyondAQI-API');
  next();
});

connectDB();

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'success',
    statusCode: 200,
    message: 'BeyondAQI API is running',
    data: {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      endpoints: [
        '/api/dropdown/countries',
        '/api/leaderboard/most-polluted',
        '/api/historical/:country/:period',
        '/api/search',
        '/api/realtime/:country/states',
        '/api/:country/:state/:city'
      ]
    },
    error: null
  });
});

app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/dropdown", dropdownRoutes);
app.use("/api/historical", historicalRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/realtime", realtimeRoutes);
app.use("/api", hierarchyRoutes);

app.use((err, req, res, next) => {
  console.error('🚨 Error occurred:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  if (err.message === 'Not allowed by CORS policy') {
    return res.status(403).json({
      status: 'error',
      statusCode: 403,
      message: 'Access forbidden - Invalid origin',
      data: {},
      error: 'CORS_POLICY_VIOLATION'
    });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      status: 'error',
      statusCode: 400,
      message: 'Invalid JSON format',
      data: {},
      error: 'INVALID_JSON'
    });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      status: 'error',
      statusCode: 413,
      message: 'Request payload too large. Maximum 10MB allowed.',
      data: {},
      error: 'PAYLOAD_TOO_LARGE'
    });
  }

  res.status(500).json({
    status: 'error',
    statusCode: 500,
    message: 'Internal server error',
    data: {},
    error: process.env.NODE_ENV === 'development' ? err.message : 'INTERNAL_SERVER_ERROR'
  });
});

app.use((req, res) => {
  console.warn(`🔍 404 - Route not found: ${req.method} ${req.originalUrl} from IP: ${req.ip}`);
  
  res.status(404).json({
    status: 'error',
    statusCode: 404,
    message: 'Route not found',
    data: {},
    error: `Cannot ${req.method} ${req.originalUrl}`
  });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, '0.0.0.0', () => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  console.log('='.repeat(50));
  console.log('🚀 BeyondAQI Backend Server Started');
  console.log('='.repeat(50));
  console.log(`📍 Server running on 0.0.0.0:${PORT}`);
  console.log(`🛡️ Rate limiting: 10,000 requests per hour per IP`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 CORS mode: OPEN (TEMPORARY TESTING)`);
  console.log(`📊 Request size limit: 10MB`);
  console.log(`🔑 Proxy trust: Enabled`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log('='.repeat(50));
});

process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});

module.exports = app;