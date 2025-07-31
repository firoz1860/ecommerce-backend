import express from 'express';
import { body, param, query } from 'express-validator';
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImages,
  deleteProductImage,
  addProductReview,
  updateProductReview,
  deleteProductReview,
  getProductReviews,
  markReviewHelpful,
  getRelatedProducts,
  getFeaturedProducts,
  searchProducts,
  getProductsByCategory,
  updateProductStock,
  bulkUpdateProducts,
  getProductAnalytics
} from '../controllers/product.controller.js';
import { authMiddleware, requireAdmin, requireSeller } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validation.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';
import { cacheMiddleware } from '../middlewares/cache.middleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Get products with filtering and pagination
 *     tags: [Products]
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
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: rating
 *         schema:
 *           type: number
 *       - in: query
 *         name: brand
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [price, rating, createdAt, name, popularity]
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: Products retrieved successfully
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('minPrice').optional().isFloat({ min: 0 }),
  query('maxPrice').optional().isFloat({ min: 0 }),
  query('rating').optional().isFloat({ min: 0, max: 5 }),
  query('sortBy').optional().isIn(['price', 'rating', 'createdAt', 'name', 'popularity']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
  validateRequest
], cacheMiddleware(300), getProducts);

/**
 * @swagger
 * /api/products/search:
 *   get:
 *     summary: Search products
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
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
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/search', [
  query('q').trim().isLength({ min: 1 }).withMessage('Search query is required'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validateRequest
], searchProducts);

/**
 * @swagger
 * /api/products/featured:
 *   get:
 *     summary: Get featured products
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: Featured products retrieved successfully
 */
router.get('/featured', cacheMiddleware(600), getFeaturedProducts);

/**
 * @swagger
 * /api/products/category/{categoryId}:
 *   get:
 *     summary: Get products by category
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Products retrieved successfully
 */
router.get('/category/:categoryId', [
  param('categoryId').isMongoId().withMessage('Invalid category ID'),
  validateRequest
], cacheMiddleware(300), getProductsByCategory);

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get product by ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product retrieved successfully
 *       404:
 *         description: Product not found
 */
router.get('/:id', [
  param('id').isMongoId().withMessage('Invalid product ID'),
  validateRequest
], cacheMiddleware(300), getProduct);

/**
 * @swagger
 * /api/products/{id}/related:
 *   get:
 *     summary: Get related products
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Related products retrieved successfully
 */
router.get('/:id/related', [
  param('id').isMongoId().withMessage('Invalid product ID'),
  validateRequest
], cacheMiddleware(600), getRelatedProducts);

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Create new product (Admin/Seller only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - description
 *               - price
 *               - category
 *               - brand
 *               - sku
 *               - stock
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               category:
 *                 type: string
 *               brand:
 *                 type: string
 *               sku:
 *                 type: string
 *               stock:
 *                 type: number
 *     responses:
 *       201:
 *         description: Product created successfully
 */
router.post('/', authMiddleware, requireSeller, [
  body('name').trim().isLength({ min: 1, max: 200 }).withMessage('Product name is required'),
  body('description').trim().isLength({ min: 1, max: 2000 }).withMessage('Description is required'),
  body('price').isFloat({ min: 0 }).withMessage('Valid price is required'),
  body('category').isMongoId().withMessage('Valid category ID is required'),
  body('brand').trim().isLength({ min: 1 }).withMessage('Brand is required'),
  body('sku').trim().isLength({ min: 1 }).withMessage('SKU is required'),
  body('stock').isInt({ min: 0 }).withMessage('Valid stock quantity is required'),
  validateRequest
], createProduct);

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Update product (Admin/Seller only)
 *     tags: [Products]
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
 *         description: Product updated successfully
 */
router.put('/:id', authMiddleware, requireSeller, [
  param('id').isMongoId().withMessage('Invalid product ID'),
  body('name').optional().trim().isLength({ min: 1, max: 200 }),
  body('description').optional().trim().isLength({ min: 1, max: 2000 }),
  body('price').optional().isFloat({ min: 0 }),
  body('stock').optional().isInt({ min: 0 }),
  validateRequest
], updateProduct);

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Delete product (Admin only)
 *     tags: [Products]
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
 *         description: Product deleted successfully
 */
router.delete('/:id', authMiddleware, requireAdmin, [
  param('id').isMongoId().withMessage('Invalid product ID'),
  validateRequest
], deleteProduct);

// Product images
router.post('/:id/images', authMiddleware, requireSeller, [
  param('id').isMongoId().withMessage('Invalid product ID'),
  validateRequest
], upload.array('images', 5), uploadProductImages);

router.delete('/:id/images/:imageId', authMiddleware, requireSeller, [
  param('id').isMongoId().withMessage('Invalid product ID'),
  param('imageId').exists().withMessage('Image ID is required'),
  validateRequest
], deleteProductImage);

// Product reviews
router.get('/:id/reviews', [
  param('id').isMongoId().withMessage('Invalid product ID'),
  validateRequest
], getProductReviews);

router.post('/:id/reviews', authMiddleware, [
  param('id').isMongoId().withMessage('Invalid product ID'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').trim().isLength({ min: 1, max: 500 }).withMessage('Comment is required'),
  validateRequest
], addProductReview);

router.put('/:id/reviews/:reviewId', authMiddleware, [
  param('id').isMongoId().withMessage('Invalid product ID'),
  param('reviewId').isMongoId().withMessage('Invalid review ID'),
  body('rating').optional().isInt({ min: 1, max: 5 }),
  body('comment').optional().trim().isLength({ min: 1, max: 500 }),
  validateRequest
], updateProductReview);

router.delete('/:id/reviews/:reviewId', authMiddleware, [
  param('id').isMongoId().withMessage('Invalid product ID'),
  param('reviewId').isMongoId().withMessage('Invalid review ID'),
  validateRequest
], deleteProductReview);

router.post('/:id/reviews/:reviewId/helpful', authMiddleware, [
  param('id').isMongoId().withMessage('Invalid product ID'),
  param('reviewId').isMongoId().withMessage('Invalid review ID'),
  validateRequest
], markReviewHelpful);

// Admin/Seller routes
router.put('/:id/stock', authMiddleware, requireSeller, [
  param('id').isMongoId().withMessage('Invalid product ID'),
  body('stock').isInt({ min: 0 }).withMessage('Valid stock quantity is required'),
  validateRequest
], updateProductStock);

router.put('/bulk-update', authMiddleware, requireAdmin, bulkUpdateProducts);

router.get('/:id/analytics', authMiddleware, requireSeller, [
  param('id').isMongoId().withMessage('Invalid product ID'),
  validateRequest
], getProductAnalytics);

export default router;