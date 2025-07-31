import { authMiddleware } from '../middlewares/auth.middleware.js';
import logger from '../utils/logger.js';

const initializeSocketHandlers = (io) => {
  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        throw new Error('Authentication token required');
      }
      
      // Verify token (simplified version)
      const jwt = await import('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Find user
      const User = (await import('../models/User.js')).default;
      const user = await User.findById(decoded.userId);
      
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }
      
      socket.userId = user._id.toString();
      socket.userRole = user.role;
      
      next();
    } catch (error) {
      logger.error('Socket authentication failed:', error.message);
      next(new Error('Authentication failed'));
    }
  });
  
  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.userId}`);
    
    // Join user to their personal room
    socket.join(`user-${socket.userId}`);
    
    // Handle order tracking
    socket.on('trackOrder', (orderId) => {
      socket.join(`order-${orderId}`);
      logger.info(`User ${socket.userId} tracking order ${orderId}`);
    });
    
    // Handle stop tracking order
    socket.on('stopTrackingOrder', (orderId) => {
      socket.leave(`order-${orderId}`);
      logger.info(`User ${socket.userId} stopped tracking order ${orderId}`);
    });
    
    // Handle admin joining admin room
    if (socket.userRole === 'admin') {
      socket.join('admin');
      logger.info(`Admin ${socket.userId} joined admin room`);
    }
    
    // Handle real-time chat for customer support
    socket.on('joinSupport', (data) => {
      const supportRoom = `support-${data.orderId || socket.userId}`;
      socket.join(supportRoom);
      
      // Notify admin of new support request
      if (socket.userRole === 'customer') {
        io.to('admin').emit('newSupportRequest', {
          userId: socket.userId,
          orderId: data.orderId,
          message: data.message
        });
      }
    });
    
    // Handle support messages
    socket.on('supportMessage', (data) => {
      const supportRoom = `support-${data.orderId || socket.userId}`;
      
      // Broadcast message to all users in the support room
      io.to(supportRoom).emit('supportMessage', {
        userId: socket.userId,
        userRole: socket.userRole,
        message: data.message,
        timestamp: new Date()
      });
    });
    
    // Handle inventory alerts for admin
    socket.on('subscribeToInventoryAlerts', () => {
      if (socket.userRole === 'admin') {
        socket.join('inventory-alerts');
        logger.info(`Admin ${socket.userId} subscribed to inventory alerts`);
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${socket.userId}`);
    });
    
    // Handle errors
    socket.on('error', (error) => {
      logger.error(`Socket error for user ${socket.userId}:`, error);
    });
  });
  
  // Helper function to emit order status updates
  const emitOrderStatusUpdate = (orderId, status, data) => {
    io.to(`order-${orderId}`).emit('orderStatusUpdate', {
      orderId,
      status,
      timestamp: new Date(),
      ...data
    });
  };
  
  // Helper function to emit inventory alerts
  const emitInventoryAlert = (product) => {
    io.to('inventory-alerts').emit('inventoryAlert', {
      productId: product._id,
      productName: product.name,
      currentStock: product.stock,
      threshold: product.lowStockThreshold,
      timestamp: new Date()
    });
  };
  
  // Make helper functions available globally
  global.socketHelpers = {
    emitOrderStatusUpdate,
    emitInventoryAlert
  };
};

export { initializeSocketHandlers };