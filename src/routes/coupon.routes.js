import express from 'express';
import { body, param, query } from 'express-validator';
import {
  getCoupons,
  getCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
  applyCoupon,
  getCouponStats
} from '../controllers/coupon.controller.js';
import { authMiddleware, requireAdmin } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validation.middleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/coupons/validate/{code}:
 *   post:
 *     summary: Validate coupon code
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
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
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *               products:
 *                 type: array
 *                 items:
 *                   type: string
 *               categories:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Coupon is valid
 *       400:
 *         description: Invalid coupon or conditions not met
 */
router.post('/validate/:code', authMiddleware, [
  param('code').trim().isLength({ min: 1 }).withMessage('Coupon code is required'),
  body('amount').isFloat({ min: 0 }).withMessage('Valid amount is required'),
  body('products').optional().isArray(),
  body('categories').optional().isArray(),
  validateRequest
], validateCoupon);

/**
 * @swagger
 * /api/coupons/apply/{code}:
 *   post:
 *     summary: Apply coupon to order
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
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
 *               - orderId
 *             properties:
 *               orderId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Coupon applied successfully
 */
router.post('/apply/:code', authMiddleware, [
  param('code').trim().isLength({ min: 1 }).withMessage('Coupon code is required'),
  body('orderId').isMongoId().withMessage('Valid order ID is required'),
  validateRequest
], applyCoupon);

// Admin routes
router.use(authMiddleware, requireAdmin);

/**
 * @swagger
 * /api/coupons:
 *   get:
 *     summary: Get all coupons (Admin)
 *     tags: [Coupons]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, expired, inactive]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [percentage, fixed]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Coupons retrieved successfully
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['active', 'expired', 'inactive']),
  query('type').optional().isIn(['percentage', 'fixed']),
  validateRequest
], getCoupons);

/**
 * @swagger
 * /api/coupons:
 *   post:
 *     summary: Create new coupon (Admin)
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - type
 *               - value
 *               - expiresAt
 *             properties:
 *               code:
 *                 type: string
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [percentage, fixed]
 *               value:
 *                 type: number
 *               minAmount:
 *                 type: number
 *               maxAmount:
 *                 type: number
 *               maxUses:
 *                 type: number
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Coupon created successfully
 */
router.post('/', [
  body('code').trim().isLength({ min: 1, max: 20 }).withMessage('Coupon code is required'),
  body('type').isIn(['percentage', 'fixed']).withMessage('Valid coupon type is required'),
  body('value').isFloat({ min: 0 }).withMessage('Valid coupon value is required'),
  body('expiresAt').isISO8601().withMessage('Valid expiration date is required'),
  body('minAmount').optional().isFloat({ min: 0 }),
  body('maxAmount').optional().isFloat({ min: 0 }),
  body('maxUses').optional().isInt({ min: 1 }),
  validateRequest
], createCoupon);

router.get('/:id', [
  param('id').isMongoId().withMessage('Invalid coupon ID'),
  validateRequest
], getCoupon);

router.put('/:id', [
  param('id').isMongoId().withMessage('Invalid coupon ID'),
  body('code').optional().trim().isLength({ min: 1, max: 20 }),
  body('type').optional().isIn(['percentage', 'fixed']),
  body('value').optional().isFloat({ min: 0 }),
  body('isActive').optional().isBoolean(),
  validateRequest
], updateCoupon);

router.delete('/:id', [
  param('id').isMongoId().withMessage('Invalid coupon ID'),
  validateRequest
], deleteCoupon);

router.get('/:id/stats', [
  param('id').isMongoId().withMessage('Invalid coupon ID'),
  validateRequest
], getCouponStats);

export default router;