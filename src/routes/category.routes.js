import express from 'express';
import { body, param, query } from 'express-validator';
import {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryTree,
  getCategoryProducts,
  uploadCategoryImage,
  deleteCategoryImage,
  reorderCategories,
  getCategoryAnalytics
} from '../controllers/category.controller.js';
import { authMiddleware, requireAdmin } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validation.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';
import { cacheMiddleware } from '../middlewares/cache.middleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Get all categories
 *     tags: [Categories]
 *     parameters:
 *       - in: query
 *         name: parent
 *         schema:
 *           type: string
 *         description: Parent category ID to get subcategories
 *       - in: query
 *         name: level
 *         schema:
 *           type: integer
 *         description: Category level (0 for root categories)
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 */
router.get('/', [
  query('parent').optional().isMongoId().withMessage('Invalid parent category ID'),
  query('level').optional().isInt({ min: 0 }),
  query('active').optional().isBoolean(),
  validateRequest
], cacheMiddleware(600), getCategories);

/**
 * @swagger
 * /api/categories/tree:
 *   get:
 *     summary: Get category tree structure
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: Category tree retrieved successfully
 */
router.get('/tree', cacheMiddleware(600), getCategoryTree);

/**
 * @swagger
 * /api/categories/{id}:
 *   get:
 *     summary: Get category by ID
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category retrieved successfully
 *       404:
 *         description: Category not found
 */
router.get('/:id', [
  param('id').isMongoId().withMessage('Invalid category ID'),
  validateRequest
], cacheMiddleware(300), getCategory);

/**
 * @swagger
 * /api/categories/{id}/products:
 *   get:
 *     summary: Get products in category
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
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
 *       - in: query
 *         name: includeSubcategories
 *         schema:
 *           type: boolean
 *           default: true
 *     responses:
 *       200:
 *         description: Category products retrieved successfully
 */
router.get('/:id/products', [
  param('id').isMongoId().withMessage('Invalid category ID'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('includeSubcategories').optional().isBoolean(),
  validateRequest
], cacheMiddleware(300), getCategoryProducts);

/**
 * @swagger
 * /api/categories:
 *   post:
 *     summary: Create new category (Admin only)
 *     tags: [Categories]
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
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               parent:
 *                 type: string
 *               icon:
 *                 type: string
 *               sortOrder:
 *                 type: number
 *     responses:
 *       201:
 *         description: Category created successfully
 */
router.post('/', authMiddleware, requireAdmin, [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Category name is required'),
  body('description').optional().trim().isLength({ max: 500 }),
  body('parent')
    .optional({ nullable: true })
    .custom(value => value === null || mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid parent category ID'),
  body('icon').optional().trim(),
  body('sortOrder').optional().isInt({ min: 0 }),
  validateRequest
], createCategory);


/**
 * @swagger
 * /api/categories/{id}:
 *   put:
 *     summary: Update category (Admin only)
 *     tags: [Categories]
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
 *         description: Category updated successfully
 */
router.put('/:id', authMiddleware, requireAdmin, [
  param('id').isMongoId().withMessage('Invalid category ID'),
  body('name').optional().trim().isLength({ min: 1, max: 100 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('parent').optional().isMongoId(),
  body('isActive').optional().isBoolean(),
  body('sortOrder').optional().isInt({ min: 0 }),
  validateRequest
], updateCategory);

/**
 * @swagger
 * /api/categories/{id}:
 *   delete:
 *     summary: Delete category (Admin only)
 *     tags: [Categories]
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
 *         description: Category deleted successfully
 */
router.delete('/:id', authMiddleware, requireAdmin, [
  param('id').isMongoId().withMessage('Invalid category ID'),
  validateRequest
], deleteCategory);

// Category image management
router.post('/:id/image', authMiddleware, requireAdmin, [
  param('id').isMongoId().withMessage('Invalid category ID'),
  validateRequest
], upload.single('image'), uploadCategoryImage);

router.delete('/:id/image', authMiddleware, requireAdmin, [
  param('id').isMongoId().withMessage('Invalid category ID'),
  validateRequest
], deleteCategoryImage);

// Category management
router.put('/reorder', authMiddleware, requireAdmin, [
  body('categories').isArray().withMessage('Categories array is required'),
  body('categories.*.id').isMongoId().withMessage('Invalid category ID'),
  body('categories.*.sortOrder').isInt({ min: 0 }).withMessage('Valid sort order is required'),
  validateRequest
], reorderCategories);

router.get('/:id/analytics', authMiddleware, requireAdmin, [
  param('id').isMongoId().withMessage('Invalid category ID'),
  validateRequest
], getCategoryAnalytics);

export default router;