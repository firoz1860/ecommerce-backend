import express from 'express';
import { body, param, query } from 'express-validator';
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist,
  updateWishlist,
  shareWishlist,
  getSharedWishlist,
  moveToCart
} from '../controllers/wishlist.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validation.middleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/wishlist:
 *   get:
 *     summary: Get user's wishlist
 *     tags: [Wishlist]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wishlist retrieved successfully
 */
router.get('/', authMiddleware, getWishlist);

/**
 * @swagger
 * /api/wishlist:
 *   put:
 *     summary: Update wishlist details
 *     tags: [Wishlist]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               isPublic:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Wishlist updated successfully
 */
router.put('/', authMiddleware, [
  body('name').optional().trim().isLength({ min: 1, max: 100 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('isPublic').optional().isBoolean(),
  validateRequest
], updateWishlist);

/**
 * @swagger
 * /api/wishlist/items:
 *   post:
 *     summary: Add item to wishlist
 *     tags: [Wishlist]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *             properties:
 *               productId:
 *                 type: string
 *               variantId:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Item added to wishlist successfully
 */
router.post('/items', authMiddleware, [
  body('productId').isMongoId().withMessage('Valid product ID is required'),
  body('variantId').optional().isMongoId(),
  body('notes').optional().trim().isLength({ max: 200 }),
  validateRequest
], addToWishlist);

/**
 * @swagger
 * /api/wishlist/items/{productId}:
 *   delete:
 *     summary: Remove item from wishlist
 *     tags: [Wishlist]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Item removed from wishlist successfully
 */
router.delete('/items/:productId', authMiddleware, [
  param('productId').isMongoId().withMessage('Invalid product ID'),
  validateRequest
], removeFromWishlist);

/**
 * @swagger
 * /api/wishlist/items/{productId}/move-to-cart:
 *   post:
 *     summary: Move wishlist item to cart
 *     tags: [Wishlist]
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
 *             properties:
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *                 default: 1
 *     responses:
 *       200:
 *         description: Item moved to cart successfully
 */
router.post('/items/:productId/move-to-cart', authMiddleware, [
  param('productId').isMongoId().withMessage('Invalid product ID'),
  body('quantity').optional().isInt({ min: 1 }),
  validateRequest
], moveToCart);

/**
 * @swagger
 * /api/wishlist/clear:
 *   delete:
 *     summary: Clear entire wishlist
 *     tags: [Wishlist]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wishlist cleared successfully
 */
router.delete('/clear', authMiddleware, clearWishlist);

/**
 * @swagger
 * /api/wishlist/share:
 *   post:
 *     summary: Generate shareable link for wishlist
 *     tags: [Wishlist]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Share link generated successfully
 */
router.post('/share', authMiddleware, shareWishlist);

/**
 * @swagger
 * /api/wishlist/shared/{token}:
 *   get:
 *     summary: Get shared wishlist by token
 *     tags: [Wishlist]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Shared wishlist retrieved successfully
 */
router.get('/shared/:token', [
  param('token').isLength({ min: 32, max: 32 }).withMessage('Invalid share token'),
  validateRequest
], getSharedWishlist);

export default router;