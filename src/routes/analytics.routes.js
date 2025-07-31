import express from 'express';
import { query } from 'express-validator';
import {
  getSalesAnalytics,
  getProductAnalytics,
  getUserAnalytics,
  getOrderAnalytics,
  getRevenueAnalytics,
  getInventoryAnalytics,
  getCustomerAnalytics,
  getTrafficAnalytics,
  getConversionAnalytics,
  exportAnalyticsReport
} from '../controllers/analytics.controller.js';
import { authMiddleware, requireAdmin } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validation.middleware.js';

const router = express.Router();

// All routes require admin authentication
router.use(authMiddleware, requireAdmin);

/**
 * @swagger
 * /api/analytics/sales:
 *   get:
 *     summary: Get sales analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month, quarter, year]
 *           default: month
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
 *         description: Sales analytics retrieved successfully
 */
router.get('/sales', [
  query('period').optional().isIn(['day', 'week', 'month', 'quarter', 'year']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  validateRequest
], getSalesAnalytics);

/**
 * @swagger
 * /api/analytics/products:
 *   get:
 *     summary: Get product analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month, quarter, year]
 *           default: month
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Product analytics retrieved successfully
 */
router.get('/products', [
  query('period').optional().isIn(['day', 'week', 'month', 'quarter', 'year']),
  query('category').optional().isMongoId(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validateRequest
], getProductAnalytics);

/**
 * @swagger
 * /api/analytics/users:
 *   get:
 *     summary: Get user analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month, quarter, year]
 *           default: month
 *     responses:
 *       200:
 *         description: User analytics retrieved successfully
 */
router.get('/users', [
  query('period').optional().isIn(['day', 'week', 'month', 'quarter', 'year']),
  validateRequest
], getUserAnalytics);

/**
 * @swagger
 * /api/analytics/orders:
 *   get:
 *     summary: Get order analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month, quarter, year]
 *           default: month
 *     responses:
 *       200:
 *         description: Order analytics retrieved successfully
 */
router.get('/orders', [
  query('period').optional().isIn(['day', 'week', 'month', 'quarter, year']),
  validateRequest
], getOrderAnalytics);

/**
 * @swagger
 * /api/analytics/revenue:
 *   get:
 *     summary: Get revenue analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month, quarter, year]
 *           default: month
 *       - in: query
 *         name: breakdown
 *         schema:
 *           type: string
 *           enum: [category, product, region]
 *     responses:
 *       200:
 *         description: Revenue analytics retrieved successfully
 */
router.get('/revenue', [
  query('period').optional().isIn(['day', 'week', 'month', 'quarter', 'year']),
  query('breakdown').optional().isIn(['category', 'product', 'region']),
  validateRequest
], getRevenueAnalytics);

/**
 * @swagger
 * /api/analytics/inventory:
 *   get:
 *     summary: Get inventory analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Inventory analytics retrieved successfully
 */
router.get('/inventory', getInventoryAnalytics);

/**
 * @swagger
 * /api/analytics/customers:
 *   get:
 *     summary: Get customer analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month, quarter, year]
 *           default: month
 *     responses:
 *       200:
 *         description: Customer analytics retrieved successfully
 */
router.get('/customers', [
  query('period').optional().isIn(['day', 'week', 'month', 'quarter', 'year']),
  validateRequest
], getCustomerAnalytics);

/**
 * @swagger
 * /api/analytics/traffic:
 *   get:
 *     summary: Get traffic analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month, quarter, year]
 *           default: month
 *     responses:
 *       200:
 *         description: Traffic analytics retrieved successfully
 */
router.get('/traffic', [
  query('period').optional().isIn(['day', 'week', 'month', 'quarter', 'year']),
  validateRequest
], getTrafficAnalytics);

/**
 * @swagger
 * /api/analytics/conversion:
 *   get:
 *     summary: Get conversion analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month, quarter, year]
 *           default: month
 *     responses:
 *       200:
 *         description: Conversion analytics retrieved successfully
 */
router.get('/conversion', [
  query('period').optional().isIn(['day', 'week', 'month', 'quarter', 'year']),
  validateRequest
], getConversionAnalytics);

/**
 * @swagger
 * /api/analytics/export:
 *   get:
 *     summary: Export analytics report
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [sales, products, users, orders, revenue]
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, xlsx, pdf]
 *           default: csv
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month, quarter, year]
 *           default: month
 *     responses:
 *       200:
 *         description: Analytics report exported successfully
 */
router.get('/export', [
  query('type').isIn(['sales', 'products', 'users', 'orders', 'revenue']).withMessage('Valid report type is required'),
  query('format').optional().isIn(['csv', 'xlsx', 'pdf']),
  query('period').optional().isIn(['day', 'week', 'month', 'quarter', 'year']),
  validateRequest
], exportAnalyticsReport);

export default router;