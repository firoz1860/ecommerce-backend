// import { createClient } from 'redis';
// import logger from '../utils/logger.js';

// let redisClient;

// const connectRedis = async () => {
//   try {
//     redisClient = createClient({
//       url: process.env.REDIS_URL || 'redis://localhost:6379'
//     });

//     redisClient.on('error', (err) => {
//       logger.error('Redis Client Error:', err);
//     });

//     redisClient.on('connect', () => {
//       logger.info('✅ Redis Connected');
//     });

//     redisClient.on('reconnecting', () => {
//       logger.info('Redis Reconnecting');
//     });

//     await redisClient.connect();
//   } catch (error) {
//     logger.error('Redis connection failed:', error);
//     process.exit(1);
//   }
// };

// const getRedisClient = () => {
//   if (!redisClient) {
//     throw new Error('Redis client not initialized');
//   }
//   return redisClient;
// };

// export { connectRedis, getRedisClient };

import { createClient } from 'redis';
import logger from '../utils/logger.js';

let redisClient;
let isConnecting = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 2000; // 2 seconds

const connectRedis = async () => {
  if (isConnecting) {
    return;
  }
  
  isConnecting = true;
  
  try {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => {
          if (retries >= maxReconnectAttempts) {
            logger.error(`Redis max reconnection attempts (${maxReconnectAttempts}) reached`);
            return false;
          }
          const delay = Math.min(retries * 1000, 3000);
          logger.info(`Redis reconnecting in ${delay}ms (attempt ${retries + 1})`);
          return delay;
        },
        connectTimeout: 10000,
        lazyConnect: true
      },
      retry_unfulfilled_commands: true
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err.message);
      reconnectAttempts++;
    });

    redisClient.on('connect', () => {
      logger.info('✅ Redis Connected');
      reconnectAttempts = 0;
      isConnecting = false;
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis Reconnecting...');
    });

    redisClient.on('ready', () => {
      logger.info('Redis Client Ready');
    });

    redisClient.on('end', () => {
      logger.warn('Redis connection ended');
    });

    await redisClient.connect();
    
  } catch (error) {
    logger.error('Redis connection failed:', error);
    isConnecting = false;
    
    // Don't exit process for Redis connection failure
    // The app can still function without Redis (caching will be disabled)
    logger.warn('Application will continue without Redis caching');
  }
};

const getRedisClient = () => {
  if (!redisClient || !redisClient.isOpen) {
    logger.warn('Redis client not available, operations will be skipped');
    return null;
  }
  return redisClient;
};

// Graceful shutdown
const closeRedis = async () => {
  if (redisClient && redisClient.isOpen) {
    try {
      await redisClient.quit();
      logger.info('Redis connection closed gracefully');
    } catch (error) {
      logger.error('Error closing Redis connection:', error);
    }
  }
};

export { connectRedis, getRedisClient, closeRedis };