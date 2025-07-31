import express from 'express';
import { body, param, query } from 'express-validator';
import {
  createSupportTicket,
  getUserTickets,
  getSupportTicket,
  addTicketMessage,
  updateSupportTicket,
  resolveSupportTicket,
  closeSupportTicket,
  escalateSupportTicket,
  rateSupportTicket,
  getAllSupportTickets,
  getSupportStats
} from '../controllers/support.controller.js';
import { authMiddleware, requireAdmin } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validation.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/support:
 *   post:
 *     summary: Create support ticket
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subject
 *               - description
 *               - category
 *             properties:
 *               subject:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum: [order, product, payment, shipping, account, technical, other]
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *               relatedOrder:
 *                 type: string
 *               relatedProduct:
 *                 type: string
 *     responses:
 *       201:
 *         description: Support ticket created successfully
 */
router.post('/', authMiddleware, [
  body('subject').trim().isLength({ min: 1, max: 200 }).withMessage('Subject is required'),
  body('description').trim().isLength({ min: 1, max: 2000 }).withMessage('Description is required'),
  body('category').isIn(['order', 'product', 'payment', 'shipping', 'account', 'technical', 'other']).withMessage('Valid category is required'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('relatedOrder').optional().isMongoId(),
  body('relatedProduct').optional().isMongoId(),
  validateRequest
], createSupportTicket);

/**
 * @swagger
 * /api/support/my-tickets:
 *   get:
 *     summary: Get user's support tickets
 *     tags: [Support]
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
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, in_progress, waiting_customer, resolved, closed]
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [order, product, payment, shipping, account, technical, other]
 *     responses:
 *       200:
 *         description: Support tickets retrieved successfully
 */
router.get('/my-tickets', authMiddleware, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('status').optional().isIn(['open', 'in_progress', 'waiting_customer', 'resolved', 'closed']),
  query('category').optional().isIn(['order', 'product', 'payment', 'shipping', 'account', 'technical', 'other']),
  validateRequest
], getUserTickets);

/**
 * @swagger
 * /api/support/{id}:
 *   get:
 *     summary: Get support ticket details
 *     tags: [Support]
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
 *         description: Support ticket retrieved successfully
 */
router.get('/:id', authMiddleware, [
  param('id').isMongoId().withMessage('Invalid ticket ID'),
  validateRequest
], getSupportTicket);

/**
 * @swagger
 * /api/support/{id}/messages:
 *   post:
 *     summary: Add message to support ticket
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *               isInternal:
 *                 type: boolean
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Message added successfully
 */
router.post('/:id/messages', authMiddleware, [
  param('id').isMongoId().withMessage('Invalid ticket ID'),
  body('message').trim().isLength({ min: 1, max: 2000 }).withMessage('Message is required'),
  body('isInternal').optional().isBoolean(),
  validateRequest
], upload.array('attachments', 5), addTicketMessage);

/**
 * @swagger
 * /api/support/{id}/close:
 *   put:
 *     summary: Close support ticket
 *     tags: [Support]
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
 *         description: Support ticket closed successfully
 */
router.put('/:id/close', authMiddleware, [
  param('id').isMongoId().withMessage('Invalid ticket ID'),
  validateRequest
], closeSupportTicket);

/**
 * @swagger
 * /api/support/{id}/rate:
 *   post:
 *     summary: Rate support ticket resolution
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rating
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               feedback:
 *                 type: string
 *     responses:
 *       200:
 *         description: Support ticket rated successfully
 */
router.post('/:id/rate', authMiddleware, [
  param('id').isMongoId().withMessage('Invalid ticket ID'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('feedback').optional().trim().isLength({ max: 500 }),
  validateRequest
], rateSupportTicket);

// Admin routes
router.get('/', authMiddleware, requireAdmin, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['open', 'in_progress', 'waiting_customer', 'resolved', 'closed']),
  query('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  query('category').optional().isIn(['order', 'product', 'payment', 'shipping', 'account', 'technical', 'other']),
  query('assignedTo').optional().isMongoId(),
  validateRequest
], getAllSupportTickets);

router.put('/:id', authMiddleware, requireAdmin, [
  param('id').isMongoId().withMessage('Invalid ticket ID'),
  body('status').optional().isIn(['open', 'in_progress', 'waiting_customer', 'resolved', 'closed']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('assignedTo').optional().isMongoId(),
  validateRequest
], updateSupportTicket);

router.put('/:id/resolve', authMiddleware, requireAdmin, [
  param('id').isMongoId().withMessage('Invalid ticket ID'),
  body('resolution').trim().isLength({ min: 1, max: 1000 }).withMessage('Resolution is required'),
  validateRequest
], resolveSupportTicket);

router.put('/:id/escalate', authMiddleware, requireAdmin, [
  param('id').isMongoId().withMessage('Invalid ticket ID'),
  body('reason').trim().isLength({ min: 1, max: 500 }).withMessage('Escalation reason is required'),
  validateRequest
], escalateSupportTicket);

router.get('/stats/overview', authMiddleware, requireAdmin, getSupportStats);

export default router;