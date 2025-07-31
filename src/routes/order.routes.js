import express from 'express';
import { body, param, query } from 'express-validator';
import {
  createOrder,
  getOrders,
  getOrder,
  updateOrderStatus,
  cancelOrder,
  trackOrder,
  getOrderInvoice,
  requestRefund,
  rateOrder,
  reorderItems,
  getOrderAnalytics,
  processPayment,
  handlePaymentWebhook,
  updateShippingAddress,
  addOrderNote,
  getOrderTimeline
} from '../controllers/order.controller.js';
import { authMiddleware, requireAdmin } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validation.middleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Create new order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - shippingAddress
 *               - paymentMethod
 *             properties:
 *               shippingAddress:
 *                 type: object
 *                 required:
 *                   - firstName
 *                   - lastName
 *                   - street
 *                   - city
 *                   - state
 *                   - zipCode
 *                 properties:
 *                   firstName:
 *                     type: string
 *                   lastName:
 *                     type: string
 *                   street:
 *                     type: string
 *                   city:
 *                     type: string
 *                   state:
 *                     type: string
 *                   zipCode:
 *                     type: string
 *                   country:
 *                     type: string
 *                   phone:
 *                     type: string
 *               billingAddress:
 *                 type: object
 *               paymentMethod:
 *                 type: string
 *                 enum: [stripe, paypal, cash_on_delivery]
 *               shippingMethod:
 *                 type: string
 *                 enum: [standard, express, overnight, pickup]
 *               couponCode:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Order created successfully
 */
router.post('/', authMiddleware, [
  body('shippingAddress.firstName').trim().isLength({ min: 1 }).withMessage('First name is required'),
  body('shippingAddress.lastName').trim().isLength({ min: 1 }).withMessage('Last name is required'),
  body('shippingAddress.street').trim().isLength({ min: 1 }).withMessage('Street address is required'),
  body('shippingAddress.city').trim().isLength({ min: 1 }).withMessage('City is required'),
  body('shippingAddress.state').trim().isLength({ min: 1 }).withMessage('State is required'),
  body('shippingAddress.zipCode').trim().isLength({ min: 1 }).withMessage('Zip code is required'),
  body('paymentMethod').isIn(['stripe', 'paypal', 'cash_on_delivery']).withMessage('Valid payment method is required'),
  body('shippingMethod').optional().isIn(['standard', 'express', 'overnight', 'pickup']),
  validateRequest
], createOrder);

/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: Get user orders
 *     tags: [Orders]
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
 *           enum: [pending, confirmed, processing, shipped, delivered, cancelled, refunded]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Orders retrieved successfully
 */
router.get('/', authMiddleware, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('status').optional().isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  validateRequest
], getOrders);

/**
 * @swagger
 * /api/orders/{id}:
 *   get:
 *     summary: Get order by ID
 *     tags: [Orders]
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
 *         description: Order retrieved successfully
 *       404:
 *         description: Order not found
 */
router.get('/:id', authMiddleware, [
  param('id').isMongoId().withMessage('Invalid order ID'),
  validateRequest
], getOrder);

/**
 * @swagger
 * /api/orders/{id}/timeline:
 *   get:
 *     summary: Get order status timeline
 *     tags: [Orders]
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
 *         description: Order timeline retrieved successfully
 */
router.get('/:id/timeline', authMiddleware, [
  param('id').isMongoId().withMessage('Invalid order ID'),
  validateRequest
], getOrderTimeline);

/**
 * @swagger
 * /api/orders/{id}/track:
 *   get:
 *     summary: Track order
 *     tags: [Orders]
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
 *         description: Order tracking information
 */
router.get('/:id/track', authMiddleware, [
  param('id').isMongoId().withMessage('Invalid order ID'),
  validateRequest
], trackOrder);

/**
 * @swagger
 * /api/orders/{id}/invoice:
 *   get:
 *     summary: Get order invoice
 *     tags: [Orders]
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
 *         description: Order invoice retrieved successfully
 */
router.get('/:id/invoice', authMiddleware, [
  param('id').isMongoId().withMessage('Invalid order ID'),
  validateRequest
], getOrderInvoice);

/**
 * @swagger
 * /api/orders/{id}/cancel:
 *   put:
 *     summary: Cancel order
 *     tags: [Orders]
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
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Order cancelled successfully
 */
router.put('/:id/cancel', authMiddleware, [
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('reason').trim().isLength({ min: 1 }).withMessage('Cancellation reason is required'),
  validateRequest
], cancelOrder);

/**
 * @swagger
 * /api/orders/{id}/refund:
 *   post:
 *     summary: Request order refund
 *     tags: [Orders]
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
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *               amount:
 *                 type: number
 *               items:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Refund request submitted successfully
 */
router.post('/:id/refund', authMiddleware, [
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('reason').trim().isLength({ min: 1 }).withMessage('Refund reason is required'),
  body('amount').optional().isFloat({ min: 0 }),
  body('items').optional().isArray(),
  validateRequest
], requestRefund);

/**
 * @swagger
 * /api/orders/{id}/rate:
 *   post:
 *     summary: Rate order and delivery
 *     tags: [Orders]
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
 *               comment:
 *                 type: string
 *               deliveryRating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *     responses:
 *       200:
 *         description: Order rated successfully
 */
router.post('/:id/rate', authMiddleware, [
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().trim().isLength({ max: 500 }),
  body('deliveryRating').optional().isInt({ min: 1, max: 5 }),
  validateRequest
], rateOrder);

/**
 * @swagger
 * /api/orders/{id}/reorder:
 *   post:
 *     summary: Reorder items from previous order
 *     tags: [Orders]
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
 *         description: Items added to cart for reorder
 */
router.post('/:id/reorder', authMiddleware, [
  param('id').isMongoId().withMessage('Invalid order ID'),
  validateRequest
], reorderItems);

// Admin routes
router.put('/:id/status', authMiddleware, requireAdmin, [
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('status').isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']).withMessage('Valid status is required'),
  body('note').optional().trim(),
  body('trackingNumber').optional().trim(),
  body('carrier').optional().trim(),
  validateRequest
], updateOrderStatus);

router.put('/:id/shipping-address', authMiddleware, [
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('firstName').optional().trim().isLength({ min: 1 }),
  body('lastName').optional().trim().isLength({ min: 1 }),
  body('street').optional().trim().isLength({ min: 1 }),
  body('city').optional().trim().isLength({ min: 1 }),
  body('state').optional().trim().isLength({ min: 1 }),
  body('zipCode').optional().trim().isLength({ min: 1 }),
  validateRequest
], updateShippingAddress);

router.post('/:id/notes', authMiddleware, requireAdmin, [
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('note').trim().isLength({ min: 1 }).withMessage('Note is required'),
  body('isInternal').optional().isBoolean(),
  validateRequest
], addOrderNote);

router.get('/analytics/summary', authMiddleware, requireAdmin, getOrderAnalytics);

// Payment routes
router.post('/:id/payment', authMiddleware, [
  param('id').isMongoId().withMessage('Invalid order ID'),
  validateRequest
], processPayment);

router.post('/webhook/payment', handlePaymentWebhook);

export default router;