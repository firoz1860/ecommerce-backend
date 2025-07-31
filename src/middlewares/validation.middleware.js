import { validationResult } from 'express-validator';
import { ApiError } from '../utils/ApiError.js';

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);
    throw new ApiError(400, errorMessages.join(', '));
  }
  
  next();
};

// Middleware to validate Google OAuth token format
const validateGoogleToken = (req, res, next) => {
  const { token, code } = req.body;
  
  if (!token && !code) {
    throw new ApiError(400, 'Either Google token or authorization code is required');
  }
  
  if (token && typeof token !== 'string') {
    throw new ApiError(400, 'Google token must be a string');
  }
  
  if (code && typeof code !== 'string') {
    throw new ApiError(400, 'Authorization code must be a string');
  }
  
  next();
};

export { validateRequest, validateGoogleToken };