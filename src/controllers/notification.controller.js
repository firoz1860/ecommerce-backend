import Notification from '../models/Notification.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import logger from '../utils/logger.js';

// Get user notifications
const getNotifications = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    type,
    isRead,
    priority
  } = req.query;
  
  const query = { user: req.user.userId };
  
  if (type) query.type = type;
  if (isRead !== undefined) query.isRead = isRead === 'true';
  if (priority) query.priority = priority;
  
  // Remove expired notifications
  query.$or = [
    { expiresAt: { $exists: false } },
    { expiresAt: { $gt: new Date() } }
  ];
  
  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);
  
  const total = await Notification.countDocuments(query);
  const unreadCount = await Notification.countDocuments({
    user: req.user.userId,
    isRead: false,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  });
  
  res.json(new ApiResponse(200, {
    notifications,
    unreadCount,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  }, 'Notifications retrieved successfully'));
});

// Get single notification
const getNotification = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const notification = await Notification.findById(id);
  
  if (!notification) {
    throw new ApiError(404, 'Notification not found');
  }
  
  // Check if user owns this notification
  if (notification.user.toString() !== req.user.userId) {
    throw new ApiError(403, 'Access denied');
  }
  
  res.json(new ApiResponse(200, notification, 'Notification retrieved successfully'));
});

// Mark notification as read
const markAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const notification = await Notification.findById(id);
  
  if (!notification) {
    throw new ApiError(404, 'Notification not found');
  }
  
  // Check if user owns this notification
  if (notification.user.toString() !== req.user.userId) {
    throw new ApiError(403, 'Access denied');
  }
  
  await notification.markAsRead();
  
  res.json(new ApiResponse(200, notification, 'Notification marked as read'));
});

// Mark all notifications as read
const markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.markAllAsRead(req.user.userId);
  
  res.json(new ApiResponse(200, null, 'All notifications marked as read'));
});

// Delete notification
const deleteNotification = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const notification = await Notification.findById(id);
  
  if (!notification) {
    throw new ApiError(404, 'Notification not found');
  }
  
  // Check if user owns this notification
  if (notification.user.toString() !== req.user.userId) {
    throw new ApiError(403, 'Access denied');
  }
  
  await Notification.findByIdAndDelete(id);
  
  res.json(new ApiResponse(200, null, 'Notification deleted successfully'));
});

// Delete all notifications
const deleteAllNotifications = asyncHandler(async (req, res) => {
  await Notification.deleteMany({ user: req.user.userId });
  
  res.json(new ApiResponse(200, null, 'All notifications deleted successfully'));
});

// Get notification preferences
const getNotificationPreferences = asyncHandler(async (req, res) => {
  const User = (await import('../models/User.js')).default;
  const user = await User.findById(req.user.userId);
  
  const preferences = user.notificationPreferences || {
    email: {
      orderUpdates: true,
      promotions: true,
      productUpdates: false,
      supportMessages: true
    },
    push: {
      orderUpdates: true,
      promotions: false,
      productUpdates: false,
      supportMessages: true
    },
    sms: {
      orderUpdates: false,
      promotions: false,
      productUpdates: false,
      supportMessages: false
    }
  };
  
  res.json(new ApiResponse(200, preferences, 'Notification preferences retrieved successfully'));
});

// Update notification preferences
const updateNotificationPreferences = asyncHandler(async (req, res) => {
  const preferences = req.body;
  
  const User = (await import('../models/User.js')).default;
  const user = await User.findById(req.user.userId);
  
  user.notificationPreferences = preferences;
  await user.save();
  
  logger.info(`Notification preferences updated for user ${req.user.userId}`);
  
  res.json(new ApiResponse(200, preferences, 'Notification preferences updated successfully'));
});

// Create notification (Admin/System)
const createNotification = asyncHandler(async (req, res) => {
  const notificationData = req.body;
  
  const notification = await Notification.createNotification(notificationData);
  
  logger.info(`Notification created: ${notification._id}`);
  
  res.status(201).json(new ApiResponse(201, notification, 'Notification created successfully'));
});

// Send bulk notifications (Admin)
const sendBulkNotifications = asyncHandler(async (req, res) => {
  const { userIds, title, message, type, priority = 'medium', data } = req.body;
  
  const notifications = userIds.map(userId => ({
    user: userId,
    title,
    message,
    type,
    priority,
    data,
    channels: ['in_app']
  }));
  
  await Notification.insertMany(notifications);
  
  // Emit real-time notifications
  if (global.socketHelpers) {
    userIds.forEach(userId => {
      global.socketHelpers.emitNotification(userId, {
        title,
        message,
        type,
        priority,
        data
      });
    });
  }
  
  logger.info(`Bulk notifications sent to ${userIds.length} users`);
  
  res.json(new ApiResponse(200, null, `Notifications sent to ${userIds.length} users`));
});

// Get notification statistics (Admin)
const getNotificationStats = asyncHandler(async (req, res) => {
  const stats = await Notification.aggregate([
    {
      $group: {
        _id: null,
        totalNotifications: { $sum: 1 },
        readNotifications: {
          $sum: { $cond: ['$isRead', 1, 0] }
        },
        unreadNotifications: {
          $sum: { $cond: ['$isRead', 0, 1] }
        }
      }
    }
  ]);
  
  const typeStats = await Notification.aggregate([
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const priorityStats = await Notification.aggregate([
    {
      $group: {
        _id: '$priority',
        count: { $sum: 1 }
      }
    }
  ]);
  
  res.json(new ApiResponse(200, {
    overview: stats[0] || {},
    typeBreakdown: typeStats,
    priorityBreakdown: priorityStats
  }, 'Notification statistics retrieved successfully'));
});

export {
  getNotifications,
  getNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  getNotificationPreferences,
  updateNotificationPreferences,
  createNotification,
  sendBulkNotifications,
  getNotificationStats
};