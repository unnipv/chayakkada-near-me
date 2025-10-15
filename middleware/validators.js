const { body, param, validationResult } = require('express-validator');
const logger = require('../logger');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Filter out sensitive fields from logging
    const sanitizedErrors = errors.array().map(err => ({
      type: err.type,
      msg: err.msg,
      path: err.path,
      location: err.location
      // Exclude 'value' field which may contain passwords
    }));

    logger.warn('Validation failed', {
      errors: sanitizedErrors,
      ip: req.ip,
      path: req.path
    });
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

// User registration validation
const validateRegistration = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be 3-30 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username can only contain letters, numbers, underscores, and hyphens')
    .escape(),
  body('password')
    .isLength({ min: 6, max: 128 })
    .withMessage('Password must be at least 6 characters'),
  handleValidationErrors
];

// User login validation
const validateLogin = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .escape(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

// Review validation
const validateReview = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid chayakkada ID'),
  body('review_text')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Review must be 10-1000 characters')
    .escape(),
  body('reviewer_name')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Reviewer name must be max 50 characters')
    .escape(),
  handleValidationErrors
];

// Metadata validation
const validateMetadata = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid chayakkada ID'),
  body('chayakkada_rating')
    .optional()
    .isFloat({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('items_available')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Items list must be max 500 characters')
    .escape(),
  body('sells_cigarettes')
    .optional()
    .isBoolean()
    .withMessage('sells_cigarettes must be a boolean'),
  body('contributed_by')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Contributor name must be max 50 characters')
    .escape(),
  handleValidationErrors
];

// Add chayakkada validation
const validateAddChayakkada = [
  body('google_place_id')
    .trim()
    .notEmpty()
    .withMessage('Google Place ID is required')
    .isLength({ max: 255 })
    .withMessage('Google Place ID too long'),
  body('name')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be 1-255 characters')
    .escape(),
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude'),
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address must be max 500 characters')
    .escape(),
  body('google_rating')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('Google rating must be between 0 and 5'),
  body('chayakkada_rating')
    .optional()
    .isFloat({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('items_available')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Items list must be max 500 characters')
    .escape(),
  body('sells_cigarettes')
    .optional()
    .isBoolean()
    .withMessage('sells_cigarettes must be a boolean'),
  handleValidationErrors
];

// Search validation
const validateSearch = [
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude'),
  body('maxDistance')
    .optional()
    .isFloat({ min: 0.1, max: 100 })
    .withMessage('Max distance must be between 0.1 and 100 km'),
  body('maxWalkingTime')
    .optional()
    .isInt({ min: 1, max: 300 })
    .withMessage('Max walking time must be between 1 and 300 minutes'),
  handleValidationErrors
];

module.exports = {
  validateRegistration,
  validateLogin,
  validateReview,
  validateMetadata,
  validateAddChayakkada,
  validateSearch
};