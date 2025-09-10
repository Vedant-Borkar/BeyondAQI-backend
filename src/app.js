require("dotenv").config({
  path: process.env.NODE_ENV === 'development' ? '.env.local' : '.env'
});
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

// ==================================================
// SECURITY CONFIGURATIONS
// ==================================================

// 1. Trust proxy configuration for proper IP detection
app.set('trust proxy', 1);

// 2. Apply rate limiting to all requests (before other middleware)
app.use(rateLimiter);

// 3. Request size limiting (10MB max) with additional security
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

// 4. Enhanced CORS configuration with environment-based restrictions
const corsConfig = () => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (isDevelopment) {
    // Development: Allow all localhost variants for testing
    return {
      origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        
        const localhostRegex = /^http:\/\/localhost:\d+$/;
        const localhostIpRegex = /^http:\/\/127\.0\.0\.1:\d+$/;
        
        if (localhostRegex.test(origin) || localhostIpRegex.test(origin)) {
          callback(null, true);
        } else {
          console.warn(`🚫 DEV CORS blocked request from origin: ${origin}`);
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
  } else {
    // Production: Strict domain whitelist
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

// 5. Additional security headers
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

// ==================================================
// DATABASE CONNECTION
// ==================================================
connectDB();

// ==================================================
// MONITORING & HEALTH ENDPOINTS
// ==================================================

// Health check endpoint (excluded from rate limiting in rateLimiter.js)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// API status endpoint
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

// ==================================================
// API ROUTES
// ==================================================
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/dropdown", dropdownRoutes);
app.use("/api/historical", historicalRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/realtime", realtimeRoutes);
app.use("/api", hierarchyRoutes);

// ==================================================
// ERROR HANDLING
// ==================================================

// Global error handler
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

  // Handle specific error types
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

// 404 handler for undefined routes
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

// ==================================================
// SERVER STARTUP
// ==================================================
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  console.log('='.repeat(50));
  console.log('🚀 BeyondAQI Backend Server Started');
  console.log('='.repeat(50));
  console.log(`📍 Server running on port ${PORT}`);
  console.log(`🛡️ Rate limiting: 10,000 requests per hour per IP`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 CORS mode: ${isDevelopment ? 'Development (localhost allowed)' : 'Production (strict whitelist)'}`);
  console.log(`📊 Request size limit: 10MB`);
  console.log(`🔑 Proxy trust: Enabled`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log('='.repeat(50));
});

// Graceful shutdown handling
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