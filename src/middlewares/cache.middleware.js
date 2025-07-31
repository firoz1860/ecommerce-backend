import { getRedisClient } from '../config/redis.js';
import logger from '../utils/logger.js';

const cacheMiddleware = (duration = 300) => {
  return async (req, res, next) => {
    // Skip caching for authenticated requests that might have user-specific data
    if (req.headers.authorization) {
      return next();
    }
    
    try {
      const redis = getRedisClient();
      
      // Skip caching if Redis is not available
      if (!redis) {
        return next();
      }
      
      const key = `cache:${req.originalUrl}`;
      
      const cachedData = await redis.get(key);
      
      if (cachedData) {
        logger.debug(`Cache hit for ${key}`);
        return res.json(JSON.parse(cachedData));
      }
      
      // Store original res.json
      const originalJson = res.json;
      
      // Override res.json to cache the response
      res.json = function(data) {
        // Cache successful responses only
        if (res.statusCode === 200) {
          if (redis) {
            redis.setEx(key, duration, JSON.stringify(data)).catch(err => {
              logger.error('Cache set error:', err);
            });
          }
        }
        
        // Call original res.json
        return originalJson.call(this, data);
      };
      
      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      next();
    }
  };
};

export { cacheMiddleware };


// import { getRedisClient } from '../config/redis.js';
// import logger from '../utils/logger.js';

// const cacheMiddleware = (duration = 300) => {
//   return async (req, res, next) => {
//     // Skip caching for authenticated requests that might have user-specific data
//     if (req.headers.authorization) {
//       return next();
//     }
    
//     try {
//       const redis = getRedisClient();
//       const key = `cache:${req.originalUrl}`;
      
//       const cachedData = await redis.get(key);
      
//       if (cachedData) {
//         logger.debug(`Cache hit for ${key}`);
//         return res.json(JSON.parse(cachedData));
//       }
      
//       // Store original res.json
//       const originalJson = res.json;
      
//       // Override res.json to cache the response
//       res.json = function(data) {
//         // Cache successful responses only
//         if (res.statusCode === 200) {
//           redis.setEx(key, duration, JSON.stringify(data)).catch(err => {
//             logger.error('Cache set error:', err);
//           });
//         }
        
//         // Call original res.json
//         return originalJson.call(this, data);
//       };
      
//       next();
//     } catch (error) {
//       logger.error('Cache middleware error:', error);
//       next();
//     }
//   };
// };

// export { cacheMiddleware };