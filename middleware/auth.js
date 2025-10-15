const jwt = require('jsonwebtoken');
const logger = require('../logger');

// JWT secret from environment (MUST be set in production)
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'dev-secret-change-in-production') {
  logger.error('CRITICAL: JWT_SECRET not set in production! Authentication is insecure!');
  process.exit(1);
}

// Generate JWT token
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username
    },
    JWT_SECRET,
    { expiresIn: '7d' } // Token expires in 7 days
  );
}

// Verify JWT token from cookie or Authorization header
function verifyToken(req, res, next) {
  try {
    // Try to get token from Authorization header
    let token = req.headers.authorization?.split(' ')[1];

    // If not in header, try cookie
    if (!token) {
      token = req.cookies?.token;
    }

    if (!token) {
      logger.warn('Authentication attempt without token', {
        ip: req.ip,
        path: req.path
      });
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;

    logger.info('User authenticated', {
      username: decoded.username,
      userId: decoded.id
    });

    next();
  } catch (error) {
    logger.warn('Invalid authentication token', {
      error: error.message,
      ip: req.ip
    });

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired, please login again' });
    }

    return res.status(401).json({ error: 'Invalid authentication token' });
  }
}

// Optional auth - adds user to request if token exists, but doesn't require it
function optionalAuth(req, res, next) {
  try {
    let token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      token = req.cookies?.token;
    }

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    }
  } catch (error) {
    // Silently fail for optional auth
    logger.debug('Optional auth failed', { error: error.message });
  }

  next();
}

module.exports = {
  generateToken,
  verifyToken,
  optionalAuth
};
