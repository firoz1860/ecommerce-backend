import express from 'express';
import { body, param } from 'express-validator';
import {
  getProfile,
  updateProfile,
  changePassword,
  uploadAvatar,
  deleteAvatar,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getAddresses,
  addToWishlist,
  removeFromWishlist,
  getWishlist,
  deactivateAccount,
  getUserOrders,
  getUserStats
} from '../controllers/user.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validation.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/profile', getProfile);

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.put('/profile', [
  body('firstName').optional().trim().isLength({ min: 1, max: 50 }),
  body('lastName').optional().trim().isLength({ min: 1, max: 50 }),
  body('phone').optional().trim().isMobilePhone(),
  validateRequest
], updateProfile);

/**
 * @swagger
 * /api/users/change-password:
 *   put:
 *     summary: Change user password
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password changed successfully
 */
router.put('/change-password', [
  body('currentPassword').exists().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  validateRequest
], changePassword);

/**
 * @swagger
 * /api/users/avatar:
 *   post:
 *     summary: Upload user avatar
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar uploaded successfully
 */
router.post('/avatar', upload.single('avatar'), uploadAvatar);

/**
 * @swagger
 * /api/users/avatar:
 *   delete:
 *     summary: Delete user avatar
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Avatar deleted successfully
 */
router.delete('/avatar', deleteAvatar);

// Address management
router.get('/addresses', getAddresses);
router.post('/addresses', [
  body('type').optional().isIn(['home', 'work', 'other']),
  body('street').trim().isLength({ min: 1 }).withMessage('Street is required'),
  body('city').trim().isLength({ min: 1 }).withMessage('City is required'),
  body('state').trim().isLength({ min: 1 }).withMessage('State is required'),
  body('zipCode').trim().isLength({ min: 1 }).withMessage('Zip code is required'),
  body('country').optional().trim(),
  validateRequest
], addAddress);

router.put('/addresses/:addressId', [
  param('addressId').isMongoId().withMessage('Invalid address ID'),
  body('type').optional().isIn(['home', 'work', 'other']),
  body('street').optional().trim().isLength({ min: 1 }),
  body('city').optional().trim().isLength({ min: 1 }),
  body('state').optional().trim().isLength({ min: 1 }),
  body('zipCode').optional().trim().isLength({ min: 1 }),
  validateRequest
], updateAddress);

router.delete('/addresses/:addressId', [
  param('addressId').isMongoId().withMessage('Invalid address ID'),
  validateRequest
], deleteAddress);

router.put('/addresses/:addressId/default', [
  param('addressId').isMongoId().withMessage('Invalid address ID'),
  validateRequest
], setDefaultAddress);

// Wishlist management
router.get('/wishlist', getWishlist);
router.post('/wishlist/:productId', [
  param('productId').isMongoId().withMessage('Invalid product ID'),
  validateRequest
], addToWishlist);

router.delete('/wishlist/:productId', [
  param('productId').isMongoId().withMessage('Invalid product ID'),
  validateRequest
], removeFromWishlist);

// Account management
router.delete('/account', deactivateAccount);

// User orders and stats
router.get('/orders', getUserOrders);
router.get('/stats', getUserStats);

export default router;