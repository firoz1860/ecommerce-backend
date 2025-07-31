import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { getRedisClient } from '../config/redis.js';

const authMiddleware = asyncHandler(async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    throw new ApiError(401, 'Access token required');
  }
  
  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if token is blacklisted
    const redis = getRedisClient();
    if (redis) {
      try {
        const isBlacklisted = await redis.get(`blacklist:${token}`);
        if (isBlacklisted) {
          throw new ApiError(401, 'Token has been revoked');
        }
      } catch (redisError) {
        logger.warn('Redis blacklist check failed, continuing without check:', redisError.message);
      }
    }
    
    // Find user
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      throw new ApiError(401, 'User not found or inactive');
    }
    
    req.user = { userId: user._id, role: user.role };
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new ApiError(401, 'Invalid token');
    }
    throw error;
  }
});

const requireAdmin = asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required');
  }
  next();
});

const requireSeller = asyncHandler(async (req, res, next) => {
  if (!['admin', 'seller'].includes(req.user.role)) {
    throw new ApiError(403, 'Seller access required');
  }
  next();
});

export { authMiddleware, requireAdmin, requireSeller };


// import jwt from 'jsonwebtoken';
// import User from '../models/User.js';
// import { asyncHandler } from '../utils/asyncHandler.js';
// import { ApiError } from '../utils/ApiError.js';
// import { getRedisClient } from '../config/redis.js';

// const authMiddleware = asyncHandler(async (req, res, next) => {
//   const token = req.header('Authorization')?.replace('Bearer ', '');
  
//   if (!token) {
//     throw new ApiError(401, 'Access token required');
//   }
  
//   try {
//     // Verify token
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
//     // Check if token is blacklisted
//     const redis = getRedisClient();
//     const isBlacklisted = await redis.get(`blacklist:${token}`);
//     if (isBlacklisted) {
//       throw new ApiError(401, 'Token has been revoked');
//     }
    
//     // Find user
//     const user = await User.findById(decoded.userId);
//     if (!user || !user.isActive) {
//       throw new ApiError(401, 'User not found or inactive');
//     }
    
//     req.user = { userId: user._id, role: user.role };
//     next();
//   } catch (error) {
//     if (error instanceof jwt.JsonWebTokenError) {
//       throw new ApiError(401, 'Invalid token');
//     }
//     throw error;
//   }
// });

// const requireAdmin = asyncHandler(async (req, res, next) => {
//   if (req.user.role !== 'admin') {
//     throw new ApiError(403, 'Admin access required');
//   }
//   next();
// });

// const requireSeller = asyncHandler(async (req, res, next) => {
//   if (!['admin', 'seller'].includes(req.user.role)) {
//     throw new ApiError(403, 'Seller access required');
//   }
//   next();
// });

// export { authMiddleware, requireAdmin, requireSeller };