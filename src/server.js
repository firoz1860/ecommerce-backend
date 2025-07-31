import app from './app.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { connectDB } from './config/database.js';
import { connectRedis, closeRedis } from './config/redis.js';
import { initializeSocketHandlers } from './sockets/index.js';
import logger from './utils/logger.js';
import path from 'path';
const PORT = process.env.PORT || 3000;

const server = createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Initialize socket handlers
initializeSocketHandlers(io);

// Make io accessible to routes
app.set('io', io);

const startServer = async () => {
  try {
    // Connect to databases
    await connectDB();
    await connectRedis();
    
    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM',() => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(async() => {
    await closeRedis();
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(async() => {
    await closeRedis();
    logger.info('Process terminated');
    process.exit(0);
  });
});

startServer();

// import app from './app.js';
// import { createServer } from 'http';
// import { Server } from 'socket.io';
// import { connectDB } from './config/database.js';
// import { connectRedis } from './config/redis.js';
// import { initializeSocketHandlers } from './sockets/index.js';
// import logger from './utils/logger.js';

// const PORT = process.env.PORT || 3000;

// const server = createServer(app);

// // Initialize Socket.IO
// const io = new Server(server, {
//   cors: {
//     origin: process.env.FRONTEND_URL || "http://localhost:3000",
//     methods: ["GET", "POST"]
//   }
// });

// // Initialize socket handlers
// initializeSocketHandlers(io);

// // Make io accessible to routes
// app.set('io', io);

// const startServer = async () => {
//   try {
//     // Connect to databases
//     await connectDB();
//     await connectRedis();
    
//     server.listen(PORT, () => {
//       logger.info(`🚀 Server running on port ${PORT}`);
//       logger.info(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
//       logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
//     });
//   } catch (error) {
//     logger.error('Failed to start server:', error);
//     process.exit(1);
//   }
// };

// // Graceful shutdown
// process.on('SIGTERM', () => {
//   logger.info('SIGTERM received, shutting down gracefully');
//   server.close(() => {
//     logger.info('Process terminated');
//     process.exit(0);
//   });
// });

// process.on('SIGINT', () => {
//   logger.info('SIGINT received, shutting down gracefully');
//   server.close(() => {
//     logger.info('Process terminated');
//     process.exit(0);
//   });
// });

// startServer();