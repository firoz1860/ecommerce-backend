import Review from '../models/Review.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { uploadImage, deleteImage } from '../config/cloudinary.js';
import logger from '../utils/logger.js';

// Get all reviews (Admin)
const getReviews = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    rating,
    product,
    user
  } = req.query;
  
  const query = {};
  
  if (status) query.status = status;
  if (rating) query.rating = parseInt(rating);
  if (product) query.product = product;
  if (user) query.user = user;
  
  const reviews = await Review.find(query)
    .populate('user', 'firstName lastName avatar')
    .populate('product', 'name images')
    .populate('moderatedBy', 'firstName lastName')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);
  
  const total = await Review.countDocuments(query);
  
  res.json(new ApiResponse(200, {
    reviews,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  }, 'Reviews retrieved successfully'));
});

// Get single review
const getReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const review = await Review.findById(id)
    .populate('user', 'firstName lastName avatar')
    .populate('product', 'name images')
    .populate('order', 'orderNumber')
    .populate('replies.user', 'firstName lastName')
    .populate('moderatedBy', 'firstName lastName');
  
  if (!review) {
    throw new ApiError(404, 'Review not found');
  }
  
  res.json(new ApiResponse(200, review, 'Review retrieved successfully'));
});

// Create review
const createReview = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { rating, title, comment, pros, cons } = req.body;
  
  // Check if product exists
  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }
  
  // Check if user already reviewed this product
  const existingReview = await Review.findOne({
    user: req.user.userId,
    product: productId
  });
  
  if (existingReview) {
    throw new ApiError(400, 'You have already reviewed this product');
  }
  
  // Check if user purchased this product
  const order = await Order.findOne({
    user: req.user.userId,
    'items.product': productId,
    status: 'delivered'
  });
  
  const reviewData = {
    user: req.user.userId,
    product: productId,
    rating,
    title,
    comment,
    pros: pros || [],
    cons: cons || [],
    isVerifiedPurchase: !!order,
    order: order?._id
  };
  
  const review = new Review(reviewData);
  await review.save();
  
  // Update product rating
  await product.calculateAverageRating();
  
  logger.info(`Review created for product ${productId} by user ${req.user.userId}`);
  
  res.status(201).json(new ApiResponse(201, review, 'Review created successfully'));
});

// Update review
const updateReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const review = await Review.findById(id);
  if (!review) {
    throw new ApiError(404, 'Review not found');
  }
  
  // Check if user owns this review
  if (review.user.toString() !== req.user.userId) {
    throw new ApiError(403, 'You can only update your own reviews');
  }
  
  // Don't allow updating if review is not pending or approved
  if (!['pending', 'approved'].includes(review.status)) {
    throw new ApiError(400, 'Cannot update this review');
  }
  
  Object.keys(updates).forEach(key => {
    if (updates[key] !== undefined && ['rating', 'title', 'comment', 'pros', 'cons'].includes(key)) {
      review[key] = updates[key];
    }
  });
  
  // Reset status to pending if content changed
  if (['rating', 'comment'].some(field => updates[field] !== undefined)) {
    review.status = 'pending';
  }
  
  await review.save();
  
  // Update product rating
  const product = await Product.findById(review.product);
  await product.calculateAverageRating();
  
  logger.info(`Review updated: ${id} by user ${req.user.userId}`);
  
  res.json(new ApiResponse(200, review, 'Review updated successfully'));
});

// Delete review
const deleteReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const review = await Review.findById(id);
  if (!review) {
    throw new ApiError(404, 'Review not found');
  }
  
  // Check permissions
  if (review.user.toString() !== req.user.userId && req.user.role !== 'admin') {
    throw new ApiError(403, 'You can only delete your own reviews');
  }
  
  // Delete review images
  if (review.images && review.images.length > 0) {
    for (const image of review.images) {
      if (image.public_id) {
        try {
          await deleteImage(image.public_id);
        } catch (error) {
          logger.error('Failed to delete review image:', error);
        }
      }
    }
  }
  
  await Review.findByIdAndDelete(id);
  
  // Update product rating
  const product = await Product.findById(review.product);
  await product.calculateAverageRating();
  
  logger.info(`Review deleted: ${id} by user ${req.user.userId}`);
  
  res.json(new ApiResponse(200, null, 'Review deleted successfully'));
});

// Upload review images
const uploadReviewImages = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!req.files || req.files.length === 0) {
    throw new ApiError(400, 'At least one image is required');
  }
  
  const review = await Review.findById(id);
  if (!review) {
    throw new ApiError(404, 'Review not found');
  }
  
  // Check if user owns this review
  if (review.user.toString() !== req.user.userId) {
    throw new ApiError(403, 'You can only update your own reviews');
  }
  
  const uploadedImages = [];
  
  try {
    for (const file of req.files) {
      const result = await uploadImage(file.path, 'reviews');
      uploadedImages.push({
        url: result.url,
        public_id: result.public_id,
        alt: `Review image for ${review.product}`
      });
    }
    
    review.images.push(...uploadedImages);
    await review.save();
    
    logger.info(`Images uploaded for review: ${id}`);
    
    res.json(new ApiResponse(200, { images: uploadedImages }, 'Images uploaded successfully'));
  } catch (error) {
    // Clean up uploaded images on error
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

// Mark review as helpful/not helpful
const markReviewHelpful = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { helpful } = req.body; // true for helpful, false for not helpful
  
  const review = await Review.findById(id);
  if (!review) {
    throw new ApiError(404, 'Review not found');
  }
  
  if (helpful) {
    await review.markHelpful(req.user.userId);
  } else {
    await review.markNotHelpful(req.user.userId);
  }
  
  res.json(new ApiResponse(200, {
    helpfulCount: review.helpfulCount,
    notHelpfulCount: review.notHelpfulCount
  }, 'Review feedback updated'));
});

// Add reply to review
const addReviewReply = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { comment } = req.body;
  
  const review = await Review.findById(id);
  if (!review) {
    throw new ApiError(404, 'Review not found');
  }
  
  // Check if user is seller of the product or admin
  const product = await Product.findById(review.product);
  const isSellerReply = product.supplier?.toString() === req.user.userId || req.user.role === 'admin';
  
  review.replies.push({
    user: req.user.userId,
    comment,
    isSellerReply
  });
  
  await review.save();
  
  logger.info(`Reply added to review ${id} by user ${req.user.userId}`);
  
  res.json(new ApiResponse(200, review.replies[review.replies.length - 1], 'Reply added successfully'));
});

// Flag review
const flagReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason, description } = req.body;
  
  const review = await Review.findById(id);
  if (!review) {
    throw new ApiError(404, 'Review not found');
  }
  
  // Check if user already flagged this review
  const alreadyFlagged = review.flags.some(flag => 
    flag.user.toString() === req.user.userId
  );
  
  if (alreadyFlagged) {
    throw new ApiError(400, 'You have already flagged this review');
  }
  
  review.flags.push({
    user: req.user.userId,
    reason,
    description
  });
  
  // Auto-flag if multiple flags
  if (review.flags.length >= 3 && review.status !== 'flagged') {
    review.status = 'flagged';
  }
  
  await review.save();
  
  logger.info(`Review flagged: ${id} by user ${req.user.userId}`);
  
  res.json(new ApiResponse(200, null, 'Review flagged successfully'));
});

// Moderate review (Admin)
const moderateReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, moderationNote } = req.body;
  
  const review = await Review.findById(id);
  if (!review) {
    throw new ApiError(404, 'Review not found');
  }
  
  review.status = status;
  review.moderationNote = moderationNote;
  review.moderatedBy = req.user.userId;
  review.moderatedAt = new Date();
  
  await review.save();
  
  // Update product rating if review was approved/rejected
  if (['approved', 'rejected'].includes(status)) {
    const product = await Product.findById(review.product);
    await product.calculateAverageRating();
  }
  
  logger.info(`Review moderated: ${id} to ${status} by user ${req.user.userId}`);
  
  res.json(new ApiResponse(200, review, 'Review moderated successfully'));
});

// Get review statistics
const getReviewStats = asyncHandler(async (req, res) => {
  const stats = await Review.aggregate([
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        averageRating: { $avg: '$rating' },
        ratingDistribution: {
          $push: '$rating'
        },
        statusDistribution: {
          $push: '$status'
        }
      }
    }
  ]);
  
  const ratingCounts = {};
  const statusCounts = {};
  
  if (stats[0]) {
    // Count rating distribution
    for (let i = 1; i <= 5; i++) {
      ratingCounts[i] = stats[0].ratingDistribution.filter(r => r === i).length;
    }
    
    // Count status distribution
    ['pending', 'approved', 'rejected', 'flagged'].forEach(status => {
      statusCounts[status] = stats[0].statusDistribution.filter(s => s === status).length;
    });
  }
  
  res.json(new ApiResponse(200, {
    totalReviews: stats[0]?.totalReviews || 0,
    averageRating: stats[0]?.averageRating || 0,
    ratingDistribution: ratingCounts,
    statusDistribution: statusCounts
  }, 'Review statistics retrieved successfully'));
});

export {
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
};