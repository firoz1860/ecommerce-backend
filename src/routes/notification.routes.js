import express from 'express';
import { body, param, query } from 'express-validator';
import {
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
} from '../controllers/notification.controller.js';
import { authMiddleware, requireAdmin } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validation.middleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get user notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [order, payment, shipping, product, promotion, system, support]
 *       - in: query
 *         name: isRead
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high]
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
 */
router.get('/', authMiddleware, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('type').optional().isIn(['order', 'payment', 'shipping', 'product', 'promotion', 'system', 'support']),
  query('isRead').optional().isBoolean(),
  query('priority').optional().isIn(['low', 'medium', 'high']),
  validateRequest
], getNotifications);

/**
 * @swagger
 * /api/notifications/{id}:
 *   get:
 *     summary: Get single notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification retrieved successfully
 */
router.get('/:id', authMiddleware, [
  param('id').isMongoId().withMessage('Invalid notification ID'),
  validateRequest
], getNotification);

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   put:
 *     summary: Mark notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marked as read
 */
router.put('/:id/read', authMiddleware, [
  param('id').isMongoId().withMessage('Invalid notification ID'),
  validateRequest
], markAsRead);

/**
 * @swagger
 * /api/notifications/mark-all-read:
 *   put:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 */
router.put('/mark-all-read', authMiddleware, markAllAsRead);

/**
 * @swagger
 * /api/notifications/{id}:
 *   delete:
 *     summary: Delete notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification deleted successfully
 */
router.delete('/:id', authMiddleware, [
  param('id').isMongoId().withMessage('Invalid notification ID'),
  validateRequest
], deleteNotification);

/**
 * @swagger
 * /api/notifications/delete-all:
 *   delete:
 *     summary: Delete all notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications deleted successfully
 */
router.delete('/delete-all', authMiddleware, deleteAllNotifications);

/**
 * @swagger
 * /api/notifications/preferences:
 *   get:
 *     summary: Get notification preferences
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification preferences retrieved successfully
 */
router.get('/preferences', authMiddleware, getNotificationPreferences);

/**
 * @swagger
 * /api/notifications/preferences:
 *   put:
 *     summary: Update notification preferences
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: object
 *               push:
 *                 type: object
 *               sms:
 *                 type: object
 *     responses:
 *       200:
 *         description: Notification preferences updated successfully
 */
router.put('/preferences', authMiddleware, [
  body('email').optional().isObject(),
  body('push').optional().isObject(),
  body('sms').optional().isObject(),
  validateRequest
], updateNotificationPreferences);

// Admin routes
router.post('/', authMiddleware, requireAdmin, [
  body('user').isMongoId().withMessage('Valid user ID is required'),
  body('title').trim().isLength({ min: 1, max: 100 }).withMessage('Title is required'),
  body('message').trim().isLength({ min: 1, max: 500 }).withMessage('Message is required'),
  body('type').isIn(['order', 'payment', 'shipping', 'product', 'promotion', 'system', 'support']).withMessage('Valid type is required'),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  validateRequest
], createNotification);

router.post('/bulk-send', authMiddleware, requireAdmin, [
  body('userIds').isArray().withMessage('User IDs array is required'),
  body('title').trim().isLength({ min: 1, max: 100 }).withMessage('Title is required'),
  body('message').trim().isLength({ min: 1, max: 500 }).withMessage('Message is required'),
  body('type').isIn(['order', 'payment', 'shipping', 'product', 'promotion', 'system', 'support']).withMessage('Valid type is required'),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  validateRequest
], sendBulkNotifications);

router.get('/stats/overview', authMiddleware, requireAdmin, getNotificationStats);

export default router;