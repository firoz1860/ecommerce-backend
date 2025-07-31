import Category from '../models/Category.js';
import Product from '../models/Product.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { uploadImage, deleteImage } from '../config/cloudinary.js';
import { getRedisClient } from '../config/redis.js';
import logger from '../utils/logger.js';
import { promises as fs } from 'fs';

// Get all categories
const getCategories = asyncHandler(async (req, res) => {
  const { parent, level, active } = req.query;
  
  const query = {};
  
  if (parent !== undefined) {
    query.parent = parent === 'null' ? null : parent;
  }
  
  if (level !== undefined) {
    query.level = parseInt(level);
  }
  
  if (active !== undefined) {
    query.isActive = active === 'true';
  }
  
  const categories = await Category.find(query)
    .populate('parent', 'name slug')
    .sort({ sortOrder: 1, name: 1 });
  
  res.json(new ApiResponse(200, categories, 'Categories retrieved successfully'));
});

// Get category tree
const getCategoryTree = asyncHandler(async (req, res) => {
  const tree = await Category.getTree();
  
  res.json(new ApiResponse(200, tree, 'Category tree retrieved successfully'));
});

// Get single category
const getCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const category = await Category.findById(id)
    .populate('parent', 'name slug')
    .populate('children')
    .populate('featuredProducts', 'name price images rating');
  
  if (!category) {
    throw new ApiError(404, 'Category not found');
  }
  
  res.json(new ApiResponse(200, category, 'Category retrieved successfully'));
});

// Get category products
const getCategoryProducts = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 20, includeSubcategories = true } = req.query;
  
  const category = await Category.findById(id);
  if (!category) {
    throw new ApiError(404, 'Category not found');
  }
  
  let categoryIds = [id];
  
  // Include subcategories if requested
  if (includeSubcategories === 'true') {
    const subcategories = await category.getDescendants();
    categoryIds = categoryIds.concat(subcategories.map(cat => cat._id));
  }
  
  const query = {
    isActive: true,
    category: { $in: categoryIds }
  };
  
  const products = await Product.find(query)
    .populate('category', 'name slug')
    .sort({ 'rating.average': -1, createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);
  
  const total = await Product.countDocuments(query);
  
  res.json(new ApiResponse(200, {
    products,
    category: category.toJSON(),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  }, 'Category products retrieved successfully'));
});

// Create category (Admin only)
const createCategory = asyncHandler(async (req, res) => {
  const { name, description, parent, icon, sortOrder } = req.body;
  
  // Check if category name already exists at the same level
  const existingCategory = await Category.findOne({
    name: new RegExp(`^${name}$`, 'i'),
    parent: parent || null
  });
  
  if (existingCategory) {
    throw new ApiError(409, 'Category with this name already exists at this level');
  }
  
  const categoryData = {
    name,
    description,
    parent: parent || null,
    icon,
    sortOrder: sortOrder || 0
  };
  
  const category = new Category(categoryData);
  await category.save();
  
  // Clear cache
  const redis = getRedisClient();
  await redis.del('cache:/api/categories*');
  
  logger.info(`Category created: ${category.name} by user ${req.user.userId}`);
  
  res.status(201).json(new ApiResponse(201, category, 'Category created successfully'));
});

// Update category (Admin only)
const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const category = await Category.findById(id);
  if (!category) {
    throw new ApiError(404, 'Category not found');
  }
  
  // Check for name conflicts if name is being updated
  if (updates.name && updates.name !== category.name) {
    const existingCategory = await Category.findOne({
      _id: { $ne: id },
      name: new RegExp(`^${updates.name}$`, 'i'),
      parent: updates.parent !== undefined ? updates.parent : category.parent
    });
    
    if (existingCategory) {
      throw new ApiError(409, 'Category with this name already exists at this level');
    }
  }
  
  // Prevent setting category as its own parent
  if (updates.parent && updates.parent.toString() === id) {
    throw new ApiError(400, 'Category cannot be its own parent');
  }
  
  // Update fields
  Object.keys(updates).forEach(key => {
    if (updates[key] !== undefined) {
      category[key] = updates[key];
    }
  });
  
  await category.save();
  
  // Clear cache
  const redis = getRedisClient();
  await redis.del('cache:/api/categories*');
  
  logger.info(`Category updated: ${category.name} by user ${req.user.userId}`);
  
  res.json(new ApiResponse(200, category, 'Category updated successfully'));
});

// Delete category (Admin only)
const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const category = await Category.findById(id);
  if (!category) {
    throw new ApiError(404, 'Category not found');
  }
  
  // Check if category has products
  const productCount = await Product.countDocuments({ category: id });
  if (productCount > 0) {
    throw new ApiError(400, 'Cannot delete category with existing products');
  }
  
  // Check if category has subcategories
  const subcategoryCount = await Category.countDocuments({ parent: id });
  if (subcategoryCount > 0) {
    throw new ApiError(400, 'Cannot delete category with subcategories');
  }
  
  // Delete category image if exists
  if (category.image?.public_id) {
    try {
      await deleteImage(category.image.public_id);
    } catch (error) {
      logger.error('Failed to delete category image:', error);
    }
  }
  
  await Category.findByIdAndDelete(id);
  
  // Clear cache
  const redis = getRedisClient();
  await redis.del('cache:/api/categories*');
  
  logger.info(`Category deleted: ${category.name} by user ${req.user.userId}`);
  
  res.json(new ApiResponse(200, null, 'Category deleted successfully'));
});

// Upload category image
const uploadCategoryImage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!req.file) {
    throw new ApiError(400, 'Image file is required');
  }
  
  const category = await Category.findById(id);
  if (!category) {
    throw new ApiError(404, 'Category not found');
  }
  
  try {
    // Delete old image if exists
    if (category.image?.public_id) {
      await deleteImage(category.image.public_id);
    }
    
    // Upload new image
    const result = await uploadImage(req.file.path, 'categories');
    
    category.image = {
      url: result.url,
      public_id: result.public_id,
      alt: category.name
    };
    
    await category.save();

// Delete local uploaded file after Cloudinary upload
    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
        console.log(`Deleted local file: ${req.file.path}`);
      } catch (err) {
        console.warn(`Failed to delete local file: ${err.message}`);
      }
    }

        
    logger.info(`Image uploaded for category: ${category.name}`);
    
    res.json(new ApiResponse(200, { image: category.image }, 'Category image uploaded successfully'));
  } catch (error) {
    throw new ApiError(500, 'Image upload failed');
  }
});

// Delete category image
const deleteCategoryImage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const category = await Category.findById(id);
  if (!category) {
    throw new ApiError(404, 'Category not found');
  }
  
  if (category.image?.public_id) {
    try {
      await deleteImage(category.image.public_id);
    } catch (error) {
      logger.error('Failed to delete image from Cloudinary:', error);
    }
  }
  
  category.image = undefined;
  await category.save();
  
  logger.info(`Image deleted for category: ${category.name}`);
  
  res.json(new ApiResponse(200, null, 'Category image deleted successfully'));
});

// Reorder categories
const reorderCategories = asyncHandler(async (req, res) => {
  const { categories } = req.body;
  
  if (!Array.isArray(categories)) {
    throw new ApiError(400, 'Categories array is required');
  }
  
  // Update sort order for each category
  const updatePromises = categories.map(({ id, sortOrder }) =>
    Category.findByIdAndUpdate(id, { sortOrder })
  );
  
  await Promise.all(updatePromises);
  
  // Clear cache
  const redis = getRedisClient();
  await redis.del('cache:/api/categories*');
  
  logger.info(`Categories reordered by user ${req.user.userId}`);
  
  res.json(new ApiResponse(200, null, 'Categories reordered successfully'));
});

// Get category analytics
const getCategoryAnalytics = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const category = await Category.findById(id);
  if (!category) {
    throw new ApiError(404, 'Category not found');
  }
  
  // Get category and subcategory IDs
  const subcategories = await category.getDescendants();
  const categoryIds = [id, ...subcategories.map(cat => cat._id)];
  
  // Get analytics data
  const [productCount, totalSales, averageRating] = await Promise.all([
    Product.countDocuments({ category: { $in: categoryIds }, isActive: true }),
    Product.aggregate([
      { $match: { category: { $in: categoryIds } } },
      { $group: { _id: null, totalSales: { $sum: '$salesCount' } } }
    ]),
    Product.aggregate([
      { $match: { category: { $in: categoryIds }, 'rating.count': { $gt: 0 } } },
      { $group: { _id: null, averageRating: { $avg: '$rating.average' } } }
    ])
  ]);
  
  const analytics = {
    productCount,
    totalSales: totalSales[0]?.totalSales || 0,
    averageRating: averageRating[0]?.averageRating || 0,
    subcategoryCount: subcategories.length
  };
  
  res.json(new ApiResponse(200, analytics, 'Category analytics retrieved successfully'));
});

export {
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
};