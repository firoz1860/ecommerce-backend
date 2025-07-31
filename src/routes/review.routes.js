import express from 'express';
import { body, param, query } from 'express-validator';
import {
  getReviews,
  getReview,
  createReview,
  updateReview,
  deleteReview,
  uploadReviewImages,
  markReviewHelpful,
  addReviewReply,
  flagReview,
  moderateReview,
  getReviewStats
} from '../controllers/review.controller.js';
import { authMiddleware, requireAdmin } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validation.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/reviews/product/{productId}:
 *   post:
 *     summary: Create product review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
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
 *               - comment
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               title:
 *                 type: string
 *               comment:
 *                 type: string
 *               pros:
 *                 type: array
 *                 items:
 *                   type: string
 *               cons:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Review created successfully
 */
router.post('/product/:productId', authMiddleware, [
  param('productId').isMongoId().withMessage('Invalid product ID'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('title').optional().trim().isLength({ max: 100 }),
  body('comment').trim().isLength({ min: 1, max: 1000 }).withMessage('Comment is required'),
  body('pros').optional().isArray(),
  body('cons').optional().isArray(),
  validateRequest
], createReview);

/**
 * @swagger
 * /api/reviews/{id}:
 *   get:
 *     summary: Get single review
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review retrieved successfully
 */
router.get('/:id', [
  param('id').isMongoId().withMessage('Invalid review ID'),
  validateRequest
], getReview);

/**
 * @swagger
 * /api/reviews/{id}:
 *   put:
 *     summary: Update review
 *     tags: [Reviews]
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
 *         description: Review updated successfully
 */
router.put('/:id', authMiddleware, [
  param('id').isMongoId().withMessage('Invalid review ID'),
  body('rating').optional().isInt({ min: 1, max: 5 }),
  body('title').optional().trim().isLength({ max: 100 }),
  body('comment').optional().trim().isLength({ min: 1, max: 1000 }),
  body('pros').optional().isArray(),
  body('cons').optional().isArray(),
  validateRequest
], updateReview);

/**
 * @swagger
 * /api/reviews/{id}:
 *   delete:
 *     summary: Delete review
 *     tags: [Reviews]
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
 *         description: Review deleted successfully
 */
router.delete('/:id', authMiddleware, [
  param('id').isMongoId().withMessage('Invalid review ID'),
  validateRequest
], deleteReview);

/**
 * @swagger
 * /api/reviews/{id}/images:
 *   post:
 *     summary: Upload review images
 *     tags: [Reviews]
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
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Images uploaded successfully
 */
router.post('/:id/images', authMiddleware, [
  param('id').isMongoId().withMessage('Invalid review ID'),
  validateRequest
], upload.array('images', 5), uploadReviewImages);

/**
 * @swagger
 * /api/reviews/{id}/helpful:
 *   post:
 *     summary: Mark review as helpful or not helpful
 *     tags: [Reviews]
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
 *               - helpful
 *             properties:
 *               helpful:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Review feedback updated
 */
router.post('/:id/helpful', authMiddleware, [
  param('id').isMongoId().withMessage('Invalid review ID'),
  body('helpful').isBoolean().withMessage('Helpful status is required'),
  validateRequest
], markReviewHelpful);

/**
 * @swagger
 * /api/reviews/{id}/reply:
 *   post:
 *     summary: Add reply to review
 *     tags: [Reviews]
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
 *               - comment
 *             properties:
 *               comment:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reply added successfully
 */
router.post('/:id/reply', authMiddleware, [
  param('id').isMongoId().withMessage('Invalid review ID'),
  body('comment').trim().isLength({ min: 1, max: 500 }).withMessage('Comment is required'),
  validateRequest
], addReviewReply);

/**
 * @swagger
 * /api/reviews/{id}/flag:
 *   post:
 *     summary: Flag review as inappropriate
 *     tags: [Reviews]
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
 *                 enum: [spam, inappropriate, fake, offensive, other]
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Review flagged successfully
 */
router.post('/:id/flag', authMiddleware, [
  param('id').isMongoId().withMessage('Invalid review ID'),
  body('reason').isIn(['spam', 'inappropriate', 'fake', 'offensive', 'other']).withMessage('Valid reason is required'),
  body('description').optional().trim().isLength({ max: 200 }),
  validateRequest
], flagReview);

// Admin routes
router.get('/', authMiddleware, requireAdmin, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['pending', 'approved', 'rejected', 'flagged']),
  query('rating').optional().isInt({ min: 1, max: 5 }),
  validateRequest
], getReviews);

router.put('/:id/moderate', authMiddleware, requireAdmin, [
  param('id').isMongoId().withMessage('Invalid review ID'),
  body('status').isIn(['approved', 'rejected', 'flagged']).withMessage('Valid status is required'),
  body('moderationNote').optional().trim().isLength({ max: 500 }),
  validateRequest
], moderateReview);

router.get('/stats/overview', authMiddleware, requireAdmin, getReviewStats);

export default router;