const rateLimit = require('express-rate-limit');

// Production-grade rate limiter for BeyondAQI API
const createRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10000, // 10,000 requests per hour
  
  // Enhanced error response matching BeyondAQI API standards
  message: {
    status: 'error',
    statusCode: 429,
    message: 'Rate limit exceeded. Maximum 10,000 requests per hour allowed.',
    data: {},
    error: 'Too many requests from this IP address',
    retryAfter: 3600,
    resetTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    limits: {
      max: 10000,
      windowMs: 3600000,
      remaining: 0
    }
  },
  
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  
  // Custom handler for consistent API formatting
  handler: (req, res, next, options) => {
    const resetTime = new Date(Date.now() + options.windowMs);
    const remaining = Math.max(0, options.max - (req.rateLimit?.current || 0));
    
    // Log rate limit breach (replaces deprecated onLimitReached)
    console.warn(`🚨 Rate limit exceeded:`, {
      ip: req.ip,
      endpoint: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString(),
      userAgent: req.get('User-Agent')
    });
    
    res.status(429).json({
      status: 'error',
      statusCode: 429,
      message: 'Rate limit exceeded. Maximum 10,000 requests per hour allowed.',
      data: {},
      error: 'Too many requests from this IP address',
      retryAfter: Math.ceil(options.windowMs / 1000),
      resetTime: resetTime.toISOString(),
      limits: {
        max: options.max,
        windowMs: options.windowMs,
        remaining: remaining,
        current: req.rateLimit?.current || 0
      },
      requestInfo: {
        ip: req.ip,
        endpoint: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
      }
    });
  },
  
  // Skip rate limiting for health checks and monitoring
  skip: (req, res) => {
    const skipPaths = ['/health', '/status', '/ping', '/metrics'];
    return skipPaths.includes(req.path) || req.path.startsWith('/health');
  },
  
  requestWasSuccessful: (req, res) => res.statusCode < 400,
  skipFailedRequests: false,
  skipSuccessfulRequests: false
});

module.exports = createRateLimiter;