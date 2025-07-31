import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Order from '../models/Order.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { uploadImage, deleteImage } from '../config/cloudinary.js';
import { getRedisClient } from '../config/redis.js';
import logger from '../utils/logger.js';
import { promises as fs } from 'fs';
// Get products with filtering and pagination
const getProducts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    category,
    minPrice,
    maxPrice,
    rating,
    brand,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    inStock = true
  } = req.query;

  // Build query
  const query = { isActive: true };
  
  if (category) query.category = category;
  if (brand) query.brand = new RegExp(brand, 'i');
  if (inStock === 'true') query.stock = { $gt: 0 };
  
  // Price range
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = parseFloat(minPrice);
    if (maxPrice) query.price.$lte = parseFloat(maxPrice);
  }
  
  // Rating filter
  if (rating) {
    query['rating.average'] = { $gte: parseFloat(rating) };
  }
  
  // Search
  if (search) {
    query.$text = { $search: search };
  }
  
  // Sort options
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
  
  // Execute query
  const products = await Product.find(query)
    .populate('category', 'name slug')
    .sort(sortOptions)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();
  
  const total = await Product.countDocuments(query);
  
  // Update view counts for search results
  if (search && products.length > 0) {
    const productIds = products.map(p => p._id);
    await Product.updateMany(
      { _id: { $in: productIds } },
      { $inc: { views: 1 } }
    );
  }
  
  res.json(new ApiResponse(200, {
    products,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    },
    filters: {
      category,
      minPrice,
      maxPrice,
      rating,
      brand,
      search
    }
  }, 'Products retrieved successfully'));
});

// Search products
const searchProducts = asyncHandler(async (req, res) => {
  const { q, page = 1, limit = 20 } = req.query;
  
  if (!q || q.trim().length === 0) {
    throw new ApiError(400, 'Search query is required');
  }
  
  const searchQuery = {
    $and: [
      { isActive: true },
      {
        $or: [
          { name: { $regex: q, $options: 'i' } },
          { description: { $regex: q, $options: 'i' } },
          { brand: { $regex: q, $options: 'i' } },
          { tags: { $in: [new RegExp(q, 'i')] } }
        ]
      }
    ]
  };
  
  const products = await Product.find(searchQuery)
    .populate('category', 'name slug')
    .sort({ views: -1, 'rating.average': -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);
  
  const total = await Product.countDocuments(searchQuery);
  
  // Update view counts
  if (products.length > 0) {
    const productIds = products.map(p => p._id);
    await Product.updateMany(
      { _id: { $in: productIds } },
      { $inc: { views: 1 } }
    );
  }
  
  res.json(new ApiResponse(200, {
    products,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    },
    searchQuery: q
  }, 'Search results retrieved successfully'));
});

// Get featured products
const getFeaturedProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({
    isActive: true,
    isFeatured: true,
    stock: { $gt: 0 }
  })
    .populate('category', 'name slug')
    .sort({ 'rating.average': -1, salesCount: -1 })
    .limit(12);
  
  res.json(new ApiResponse(200, products, 'Featured products retrieved successfully'));
});

// Get products by category
const getProductsByCategory = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;
  const { page = 1, limit = 20, includeSubcategories = true } = req.query;
  
  const category = await Category.findById(categoryId);
  if (!category) {
    throw new ApiError(404, 'Category not found');
  }
  
  let categoryIds = [categoryId];
  
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

// Get single product
const getProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const product = await Product.findById(id)
    .populate('category', 'name slug')
    .populate('reviews.user', 'firstName lastName avatar');
  
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }
  
  if (!product.isActive) {
    throw new ApiError(404, 'Product not available');
  }
  
  // Increment view count
  product.views += 1;
  await product.save();
  
  res.json(new ApiResponse(200, product, 'Product retrieved successfully'));
});

// Get related products
const getRelatedProducts = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }
  
  const relatedProducts = await Product.find({
    _id: { $ne: id },
    isActive: true,
    $or: [
      { category: product.category },
      { brand: product.brand },
      { tags: { $in: product.tags } }
    ]
  })
    .populate('category', 'name slug')
    .sort({ 'rating.average': -1, salesCount: -1 })
    .limit(8);
  
  res.json(new ApiResponse(200, relatedProducts, 'Related products retrieved successfully'));
});

// Create product (Admin/Seller)
const createProduct = asyncHandler(async (req, res) => {
  const productData = req.body;
  
  // Check if SKU already exists
  const existingProduct = await Product.findOne({ sku: productData.sku });
  if (existingProduct) {
    throw new ApiError(409, 'Product with this SKU already exists');
  }
  
  // Verify category exists
  const category = await Category.findById(productData.category);
  if (!category) {
    throw new ApiError(404, 'Category not found');
  }
  
  // Set supplier if user is seller
  if (req.user.role === 'seller') {
    productData.supplier = req.user.userId;
  }
  
  const product = new Product(productData);
  await product.save();
  
  logger.info(`Product created: ${product.name} by user ${req.user.userId}`);
  
  res.status(201).json(new ApiResponse(201, product, 'Product created successfully'));
});

// Update product
const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }
  
  // Check permissions
  if (req.user.role === 'seller' && product.supplier?.toString() !== req.user.userId) {
    throw new ApiError(403, 'You can only update your own products');
  }
  
  // Update fields
  Object.keys(updates).forEach(key => {
    if (updates[key] !== undefined) {
      product[key] = updates[key];
    }
  });
  
  await product.save();
  
  // Clear cache
  const redis = getRedisClient();
  await redis.del(`product:${id}`);
  
  logger.info(`Product updated: ${product.name} by user ${req.user.userId}`);
  
  res.json(new ApiResponse(200, product, 'Product updated successfully'));
});

// Delete product (Admin only)
const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }
  
  // Delete product images from Cloudinary
  if (product.images && product.images.length > 0) {
    for (const image of product.images) {
      if (image.public_id) {
        try {
          await deleteImage(image.public_id);
        } catch (error) {
          logger.error('Failed to delete image from Cloudinary:', error);
        }
      }
    }
  }
  
  await Product.findByIdAndDelete(id);
  
  // Clear cache
  const redis = getRedisClient();
  await redis.del(`product:${id}`);
  
  logger.info(`Product deleted: ${product.name} by user ${req.user.userId}`);
  
  res.json(new ApiResponse(200, null, 'Product deleted successfully'));
});

// Upload product images
const uploadProductImages = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!req.files || req.files.length === 0) {
    throw new ApiError(400, 'At least one image is required');
  }
  
  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }
  
  if (req.user.role === 'seller' && product.supplier?.toString() !== req.user.userId) {
    throw new ApiError(403, 'You can only update your own products');
  }

  const uploadedImages = [];

  try {
    for (const file of req.files) {
      const result = await uploadImage(file.path, 'products');
      uploadedImages.push({
        url: result.url,
        public_id: result.public_id,
        alt: product.name,
        isMain: product.images.length === 0 && uploadedImages.length === 0
      });
      console.log("Deleting file at:", file.path);


      // Delete the file after uploading to Cloudinary
      // await fs.unlink(file.path);
      try {
        await fs.unlink(file.path);
      } catch (err) {
        console.error("Failed to delete file:", err.message);
      }

    }

    product.images.push(...uploadedImages);
    await product.save();

    logger.info(`Images uploaded for product: ${product.name}`);
    
    res.json(new ApiResponse(200, { images: uploadedImages }, 'Images uploaded successfully'));
  } catch (error) {
    for (const image of uploadedImages) {
      try {
        await deleteImage(image.public_id);
      } catch (cleanupError) {
        logger.error('Failed to cleanup uploaded image:', cleanupError);
      }
    }
    throw new ApiError(500, 'Image upload failed');
  }
});




// Delete product image
const deleteProductImage = asyncHandler(async (req, res) => {
  const { id, imageId } = req.params;
  
  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }
  
  // Check permissions
  if (req.user.role === 'seller' && product.supplier?.toString() !== req.user.userId) {
    throw new ApiError(403, 'You can only update your own products');
  }
  
  const imageIndex = product.images.findIndex(img => img.public_id === imageId);
  if (imageIndex === -1) {
    throw new ApiError(404, 'Image not found');
  }
  
  const image = product.images[imageIndex];
  
  try {
    await deleteImage(image.public_id);
  } catch (error) {
    logger.error('Failed to delete image from Cloudinary:', error);
  }
  
  product.images.splice(imageIndex, 1);
  
  // If deleted image was main, set first remaining image as main
  if (image.isMain && product.images.length > 0) {
    product.images[0].isMain = true;
  }
  
  await product.save();
  
  logger.info(`Image deleted for product: ${product.name}`);
  
  res.json(new ApiResponse(200, null, 'Image deleted successfully'));
});

// Get product reviews
const getProductReviews = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 10, rating } = req.query;
  
  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }
  
  let reviews = product.reviews;
  
  // Filter by rating if specified
  if (rating) {
    reviews = reviews.filter(review => review.rating === parseInt(rating));
  }
  
  // Sort by creation date (newest first)
  reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // Pagination
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + parseInt(limit);
  const paginatedReviews = reviews.slice(startIndex, endIndex);
  
  // Populate user data
  await Product.populate(paginatedReviews, {
    path: 'user',
    select: 'firstName lastName avatar'
  });
  
  res.json(new ApiResponse(200, {
    reviews: paginatedReviews,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: reviews.length,
      pages: Math.ceil(reviews.length / limit)
    },
    summary: {
      averageRating: product.rating.average,
      totalReviews: product.rating.count
    }
  }, 'Product reviews retrieved successfully'));
});

// Add product review
const addProductReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rating, comment } = req.body;
  
  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }
  
  // Check if user already reviewed this product
  const existingReview = product.reviews.find(
    review => review.user.toString() === req.user.userId
  );
  
  if (existingReview) {
    throw new ApiError(400, 'You have already reviewed this product');
  }
  
  // Check if user purchased this product
  const hasPurchased = await Order.findOne({
    user: req.user.userId,
    'items.product': id,
    status: 'delivered'
  });
  
  const review = {
    user: req.user.userId,
    rating,
    comment,
    isVerifiedPurchase: !!hasPurchased
  };
  
  product.reviews.push(review);
  product.calculateAverageRating();
  await product.save();
  
  logger.info(`Review added for product ${id} by user ${req.user.userId}`);
  
  res.status(201).json(new ApiResponse(201, review, 'Review added successfully'));
});

// Update product review
const updateProductReview = asyncHandler(async (req, res) => {
  const { id, reviewId } = req.params;
  const { rating, comment } = req.body;
  
  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }
  
  const review = product.reviews.id(reviewId);
  if (!review) {
    throw new ApiError(404, 'Review not found');
  }
  
  // Check if user owns this review
  if (review.user.toString() !== req.user.userId) {
    throw new ApiError(403, 'You can only update your own reviews');
  }
  
  if (rating !== undefined) review.rating = rating;
  if (comment !== undefined) review.comment = comment;
  
  product.calculateAverageRating();
  await product.save();
  
  logger.info(`Review updated for product ${id} by user ${req.user.userId}`);
  
  res.json(new ApiResponse(200, review, 'Review updated successfully'));
});

// Delete product review
const deleteProductReview = asyncHandler(async (req, res) => {
  const { id, reviewId } = req.params;
  
  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }
  
  const review = product.reviews.id(reviewId);
  if (!review) {
    throw new ApiError(404, 'Review not found');
  }
  
  // Check if user owns this review or is admin
  if (review.user.toString() !== req.user.userId && req.user.role !== 'admin') {
    throw new ApiError(403, 'You can only delete your own reviews');
  }
  
  review.deleteOne();
  product.calculateAverageRating();
  await product.save();
  
  logger.info(`Review deleted for product ${id} by user ${req.user.userId}`);
  
  res.json(new ApiResponse(200, null, 'Review deleted successfully'));
});

// Mark review as helpful
const markReviewHelpful = asyncHandler(async (req, res) => {
  const { id, reviewId } = req.params;
  
  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }
  
  const review = product.reviews.id(reviewId);
  if (!review) {
    throw new ApiError(404, 'Review not found');
  }
  
  const userId = req.user.userId;
  const helpfulIndex = review.helpful.indexOf(userId);
  
  if (helpfulIndex > -1) {
    // Remove helpful vote
    review.helpful.splice(helpfulIndex, 1);
  } else {
    // Add helpful vote
    review.helpful.push(userId);
  }
  
  await product.save();
  
  res.json(new ApiResponse(200, {
    helpful: review.helpful.length,
    isHelpful: helpfulIndex === -1
  }, 'Review helpful status updated'));
});

// Update product stock
const updateProductStock = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { stock } = req.body;
  
  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }
  
  // Check permissions
  if (req.user.role === 'seller' && product.supplier?.toString() !== req.user.userId) {
    throw new ApiError(403, 'You can only update your own products');
  }
  
  const oldStock = product.stock;
  product.stock = stock;
  await product.save();
  
  // Emit inventory alert if stock is low
  if (stock <= product.lowStockThreshold && global.socketHelpers) {
    global.socketHelpers.emitInventoryAlert(product);
  }
  
  logger.info(`Stock updated for product ${id}: ${oldStock} -> ${stock}`);
  
  res.json(new ApiResponse(200, { stock: product.stock }, 'Stock updated successfully'));
});

// Bulk update products
const bulkUpdateProducts = asyncHandler(async (req, res) => {
  const { productIds, updates } = req.body;
  
  if (!Array.isArray(productIds) || productIds.length === 0) {
    throw new ApiError(400, 'Product IDs array is required');
  }
  
  const result = await Product.updateMany(
    { _id: { $in: productIds } },
    { $set: updates }
  );
  
  logger.info(`Bulk update applied to ${result.modifiedCount} products`);
  
  res.json(new ApiResponse(200, {
    modifiedCount: result.modifiedCount
  }, 'Products updated successfully'));
});

// Get product analytics
const getProductAnalytics = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }
  
  // Check permissions
  if (req.user.role === 'seller' && product.supplier?.toString() !== req.user.userId) {
    throw new ApiError(403, 'You can only view analytics for your own products');
  }
  
  // Get sales data
  const salesData = await Order.aggregate([
    { $unwind: '$items' },
    { $match: { 'items.product': product._id } },
    {
      $group: {
        _id: null,
        totalSales: { $sum: '$items.quantity' },
        totalRevenue: { $sum: '$items.total' },
        averageOrderValue: { $avg: '$items.total' }
      }
    }
  ]);
  
  const analytics = {
    views: product.views,
    salesCount: product.salesCount,
    rating: product.rating,
    stock: product.stock,
    sales: salesData[0] || {
      totalSales: 0,
      totalRevenue: 0,
      averageOrderValue: 0
    }
  };
  
  res.json(new ApiResponse(200, analytics, 'Product analytics retrieved successfully'));
});

export {
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
};