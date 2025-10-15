const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const hpp = require('hpp');
const logger = require('../logger');

// General API rate limiter - 100 requests per 15 minutes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path
    });
    res.status(429).json({
      error: 'Too many requests, please try again later'
    });
  }
});

// Strict rate limiter for auth endpoints - 5 requests per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many authentication attempts, please try again later',
  skipSuccessfulRequests: true, // Don't count successful logins
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      path: req.path
    });
    res.status(429).json({
      error: 'Too many authentication attempts, please try again in 15 minutes'
    });
  }
});

// Contribution rate limiter - 10 contributions per hour
const contributionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: 'Too many contributions, please try again later',
  handler: (req, res) => {
    logger.warn('Contribution rate limit exceeded', {
      ip: req.ip,
      username: req.user?.username,
      path: req.path
    });
    res.status(429).json({
      error: 'Too many contributions, please try again later'
    });
  }
});

// Search rate limiter - 30 searches per minute
const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: 'Too many search requests',
  handler: (req, res) => {
    logger.warn('Search rate limit exceeded', {
      ip: req.ip
    });
    res.status(429).json({
      error: 'Too many search requests, please slow down'
    });
  }
});

// Helmet configuration for security headers
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for inline scripts
        "https://unpkg.com",
        "https://maps.googleapis.com",
        "https://maps.gstatic.com"
      ],
      scriptSrcAttr: ["'unsafe-inline'"], // Required for onclick handlers
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for inline styles
        "https://unpkg.com",
        "https://fonts.googleapis.com"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https://*.tile.openstreetmap.org",
        "https://maps.googleapis.com",
        "https://maps.gstatic.com",
        "https://*.googleusercontent.com"
      ],
      connectSrc: [
        "'self'",
        "https://unpkg.com",
        "https://maps.googleapis.com"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com"
      ],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  }
});

// Custom sanitization middleware for Express 5.x compatibility
// Removes dangerous characters from input to prevent injection attacks
const sanitizeData = (req, res, next) => {
  // Sanitize req.body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  // Sanitize req.params
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  // Note: req.query is read-only in Express 5.x, so we skip it
  next();
};

// Helper function to recursively sanitize objects
function sanitizeObject(obj) {
  if (obj === null || typeof obj !== 'object') {
    return sanitizeValue(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      // Remove keys with $ or . (MongoDB injection patterns)
      const sanitizedKey = key.replace(/[$\.]/g, '_');
      sanitized[sanitizedKey] = sanitizeObject(obj[key]);
    }
  }
  return sanitized;
}

function sanitizeValue(value) {
  if (typeof value === 'string') {
    // Remove potentially dangerous patterns
    return value.replace(/[$\.]/g, '_');
  }
  return value;
}

// Prevent HTTP parameter pollution
const preventHpp = hpp();

module.exports = {
  apiLimiter,
  authLimiter,
  contributionLimiter,
  searchLimiter,
  helmetConfig,
  sanitizeData,
  preventHpp
};
