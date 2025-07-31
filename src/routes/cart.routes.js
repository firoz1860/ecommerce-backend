import express from 'express';
import { body, param } from 'express-validator';
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  validateCart,
  getCartSummary,
  moveToWishlist,
  applyCoupon,
  removeCoupon,
  saveForLater,
  moveFromSavedItems
} from '../controllers/cart.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validation.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @swagger
 * /api/cart:
 *   get:
 *     summary: Get user's cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart retrieved successfully
 */
router.get('/', getCart);

/**
 * @swagger
 * /api/cart/summary:
 *   get:
 *     summary: Get cart summary
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart summary retrieved successfully
 */
router.get('/summary', getCartSummary);

/**
 * @swagger
 * /api/cart/validate:
 *   get:
 *     summary: Validate cart items availability
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart validation completed
 */
router.get('/validate', validateCart);

/**
 * @swagger
 * /api/cart/items:
 *   post:
 *     summary: Add item to cart
 *     tags: [Cart]
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
 *               - quantity
 *             properties:
 *               productId:
 *                 type: string
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *               variantId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Item added to cart successfully
 */
router.post('/items', [
  body('productId').isMongoId().withMessage('Valid product ID is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('variantId').optional().isMongoId().withMessage('Invalid variant ID'),
  validateRequest
], addToCart);

/**
 * @swagger
 * /api/cart/items/{productId}:
 *   put:
 *     summary: Update cart item quantity
 *     tags: [Cart]
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
 *               - quantity
 *             properties:
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *               variantId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cart item updated successfully
 */
router.put('/items/:productId', [
  param('productId').isMongoId().withMessage('Invalid product ID'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('variantId').optional().isMongoId().withMessage('Invalid variant ID'),
  validateRequest
], updateCartItem);

/**
 * @swagger
 * /api/cart/items/{productId}:
 *   delete:
 *     summary: Remove item from cart
 *     tags: [Cart]
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
 *         description: Item removed from cart successfully
 */
router.delete('/items/:productId', [
  param('productId').isMongoId().withMessage('Invalid product ID'),
  validateRequest
], removeFromCart);

/**
 * @swagger
 * /api/cart/items/{productId}/move-to-wishlist:
 *   post:
 *     summary: Move cart item to wishlist
 *     tags: [Cart]
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
 *         description: Item moved to wishlist successfully
 */
router.post('/items/:productId/move-to-wishlist', [
  param('productId').isMongoId().withMessage('Invalid product ID'),
  validateRequest
], moveToWishlist);

/**
 * @swagger
 * /api/cart/items/{productId}/save-for-later:
 *   post:
 *     summary: Save cart item for later
 *     tags: [Cart]
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
 *         description: Item saved for later successfully
 */
router.post('/items/:productId/save-for-later', [
  param('productId').isMongoId().withMessage('Invalid product ID'),
  validateRequest
], saveForLater);

/**
 * @swagger
 * /api/cart/saved-items/{productId}/move-to-cart:
 *   post:
 *     summary: Move saved item back to cart
 *     tags: [Cart]
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
 *         description: Item moved to cart successfully
 */
router.post('/saved-items/:productId/move-to-cart', [
  param('productId').isMongoId().withMessage('Invalid product ID'),
  validateRequest
], moveFromSavedItems);

/**
 * @swagger
 * /api/cart/clear:
 *   delete:
 *     summary: Clear entire cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart cleared successfully
 */
router.delete('/clear', clearCart);

/**
 * @swagger
 * /api/cart/coupon:
 *   post:
 *     summary: Apply coupon to cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - couponCode
 *             properties:
 *               couponCode:
 *                 type: string
 *     responses:
 *       200:
 *         description: Coupon applied successfully
 */
router.post('/coupon', [
  body('couponCode').trim().isLength({ min: 1 }).withMessage('Coupon code is required'),
  validateRequest
], applyCoupon);

/**
 * @swagger
 * /api/cart/coupon:
 *   delete:
 *     summary: Remove coupon from cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Coupon removed successfully
 */
router.delete('/coupon', removeCoupon);

export default router;