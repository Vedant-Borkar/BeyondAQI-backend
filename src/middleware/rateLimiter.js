const rateLimit = require('express-rate-limit');

// Create rate limiter: 10,000 requests per hour
const createRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour in milliseconds
  max: 10000, // Limit each IP to 10,000 requests per windowMs
  message: {
    error: 'Too many requests from this IP',
    message: 'Rate limit exceeded. Maximum 10,000 requests per hour allowed.',
    retryAfter: '1 hour',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  
  // Custom key generator (optional) - uses IP by default
  keyGenerator: (req) => {
    // You can customize this if needed
    return req.ip || req.connection.remoteAddress;
  },
  
  // Custom handler for when limit is exceeded
  handler: (req, res) => {
    res.status(429).json({
      status: 'error',
      statusCode: 429,
      message: 'Rate limit exceeded. Maximum 10,000 requests per hour allowed.',
      data: {},
      error: 'Too many requests from this IP',
      retryAfter: '1 hour'
    });
  },
  
  // Skip certain requests (optional)
  skip: (req) => {
    // Skip rate limiting for health checks or specific endpoints if needed
    return req.path === '/health' || req.path === '/status';
  }
});

module.exports = createRateLimiter;