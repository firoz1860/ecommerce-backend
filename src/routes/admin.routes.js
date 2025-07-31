import express from 'express';
import { body, param, query } from 'express-validator';
import {
  getDashboardStats,
  getUsers,
  getUserDetails,
  updateUserStatus,
  deleteUser,
  getProducts,
  bulkUpdateProducts,
  bulkDeleteProducts,
  importProducts,
  exportProducts,
  getOrders,
  updateOrderStatus,
  getOrderDetails,
  processRefund,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getAnalytics,
  getSalesReport,
  getInventoryReport,
  getUserReport,
  getSystemLogs,
  getSystemHealth,
  createCoupon,
  getCoupons,
  updateCoupon,
  deleteCoupon,
  getReviews,
  moderateReview,
  getSupport,
  respondToSupport,
  closeSupport,
  getSettings,
  updateSettings,
  backupDatabase,
  restoreDatabase,
  sendBulkEmail,
  getEmailTemplates,
  updateEmailTemplate
} from '../controllers/admin.controller.js';
import { authMiddleware, requireAdmin } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validation.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';

const router = express.Router();

// All routes require admin authentication
router.use(authMiddleware, requireAdmin);

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats retrieved successfully
 */
router.get('/dashboard', getDashboardStats);

/**
 * @swagger
 * /api/admin/analytics:
 *   get:
 *     summary: Get detailed analytics
 *     tags: [Admin]
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
 *         description: Analytics data retrieved successfully
 */
router.get('/analytics', [
  query('period').optional().isIn(['day', 'week', 'month', 'quarter', 'year']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  validateRequest
], getAnalytics);

// User Management
/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all users with pagination
 *     tags: [Admin]
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
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [customer, admin, seller]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 */
router.get('/users', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('role').optional().isIn(['customer', 'admin', 'seller']),
  query('status').optional().isIn(['active', 'inactive']),
  validateRequest
], getUsers);

router.get('/users/:id', [
  param('id').isMongoId().withMessage('Invalid user ID'),
  validateRequest
], getUserDetails);

router.put('/users/:id/status', [
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('isActive').isBoolean().withMessage('Status is required'),
  body('reason').optional().trim(),
  validateRequest
], updateUserStatus);

router.delete('/users/:id', [
  param('id').isMongoId().withMessage('Invalid user ID'),
  validateRequest
], deleteUser);

// Product Management
router.get('/products', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('category').optional().isMongoId(),
  query('status').optional().isIn(['active', 'inactive']),
  query('lowStock').optional().isBoolean(),
  validateRequest
], getProducts);

router.put('/products/bulk-update', [
  body('productIds').isArray().withMessage('Product IDs array is required'),
  body('updates').isObject().withMessage('Updates object is required'),
  validateRequest
], bulkUpdateProducts);

router.delete('/products/bulk-delete', [
  body('productIds').isArray().withMessage('Product IDs array is required'),
  validateRequest
], bulkDeleteProducts);

router.post('/products/import', upload.single('file'), importProducts);
router.get('/products/export', exportProducts);

// Order Management
router.get('/orders', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  validateRequest
], getOrders);

router.get('/orders/:id', [
  param('id').isMongoId().withMessage('Invalid order ID'),
  validateRequest
], getOrderDetails);

router.put('/orders/:id/status', [
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('status').isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']).withMessage('Valid status is required'),
  body('note').optional().trim(),
  validateRequest
], updateOrderStatus);

router.post('/orders/:id/refund', [
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('amount').isFloat({ min: 0 }).withMessage('Valid refund amount is required'),
  body('reason').trim().isLength({ min: 1 }).withMessage('Refund reason is required'),
  validateRequest
], processRefund);

// Category Management
router.get('/categories', getCategories);
router.post('/categories', [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Category name is required'),
  body('description').optional().trim().isLength({ max: 500 }),
  body('parent').optional().isMongoId(),
  validateRequest
], createCategory);

router.put('/categories/:id', [
  param('id').isMongoId().withMessage('Invalid category ID'),
  body('name').optional().trim().isLength({ min: 1, max: 100 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('isActive').optional().isBoolean(),
  validateRequest
], updateCategory);

router.delete('/categories/:id', [
  param('id').isMongoId().withMessage('Invalid category ID'),
  validateRequest
], deleteCategory);

// Reports
router.get('/reports/sales', [
  query('period').optional().isIn(['day', 'week', 'month', 'quarter', 'year']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  validateRequest
], getSalesReport);

router.get('/reports/inventory', getInventoryReport);
router.get('/reports/users', getUserReport);

// Coupon Management
router.get('/coupons', getCoupons);
router.post('/coupons', [
  body('code').trim().isLength({ min: 1 }).withMessage('Coupon code is required'),
  body('type').isIn(['percentage', 'fixed']).withMessage('Valid coupon type is required'),
  body('value').isFloat({ min: 0 }).withMessage('Valid coupon value is required'),
  body('expiresAt').isISO8601().withMessage('Valid expiration date is required'),
  validateRequest
], createCoupon);

router.put('/coupons/:id', [
  param('id').isMongoId().withMessage('Invalid coupon ID'),
  body('isActive').optional().isBoolean(),
  body('usageLimit').optional().isInt({ min: 0 }),
  validateRequest
], updateCoupon);

router.delete('/coupons/:id', [
  param('id').isMongoId().withMessage('Invalid coupon ID'),
  validateRequest
], deleteCoupon);

// Review Management
router.get('/reviews', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['pending', 'approved', 'rejected']),
  query('rating').optional().isInt({ min: 1, max: 5 }),
  validateRequest
], getReviews);

router.put('/reviews/:id/moderate', [
  param('id').isMongoId().withMessage('Invalid review ID'),
  body('status').isIn(['approved', 'rejected']).withMessage('Valid status is required'),
  body('reason').optional().trim(),
  validateRequest
], moderateReview);

// Support Management
router.get('/support', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['open', 'in_progress', 'resolved', 'closed']),
  query('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  validateRequest
], getSupport);

router.post('/support/:id/respond', [
  param('id').isMongoId().withMessage('Invalid support ticket ID'),
  body('message').trim().isLength({ min: 1 }).withMessage('Response message is required'),
  validateRequest
], respondToSupport);

router.put('/support/:id/close', [
  param('id').isMongoId().withMessage('Invalid support ticket ID'),
  body('resolution').optional().trim(),
  validateRequest
], closeSupport);

// System Management
router.get('/system/health', getSystemHealth);
router.get('/system/logs', [
  query('level').optional().isIn(['error', 'warn', 'info', 'debug']),
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  validateRequest
], getSystemLogs);

router.get('/settings', getSettings);
router.put('/settings', [
  body('siteName').optional().trim(),
  body('siteDescription').optional().trim(),
  body('currency').optional().trim(),
  body('taxRate').optional().isFloat({ min: 0, max: 1 }),
  body('shippingCost').optional().isFloat({ min: 0 }),
  body('freeShippingThreshold').optional().isFloat({ min: 0 }),
  validateRequest
], updateSettings);

// Database Management
router.post('/database/backup', backupDatabase);
router.post('/database/restore', upload.single('backup'), restoreDatabase);

// Email Management
router.post('/email/bulk-send', [
  body('recipients').isArray().withMessage('Recipients array is required'),
  body('subject').trim().isLength({ min: 1 }).withMessage('Subject is required'),
  body('template').trim().isLength({ min: 1 }).withMessage('Template is required'),
  body('data').optional().isObject(),
  validateRequest
], sendBulkEmail);

router.get('/email/templates', getEmailTemplates);
router.put('/email/templates/:templateName', [
  param('templateName').trim().isLength({ min: 1 }).withMessage('Template name is required'),
  body('subject').trim().isLength({ min: 1 }).withMessage('Subject is required'),
  body('content').trim().isLength({ min: 1 }).withMessage('Content is required'),
  validateRequest
], updateEmailTemplate);

export default router;