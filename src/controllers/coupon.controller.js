import Coupon from '../models/Coupon.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import logger from '../utils/logger.js';

// Get all coupons (Admin)
const getCoupons = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    type,
    search
  } = req.query;
  
  const query = {};
  
  if (status === 'active') {
    query.isActive = true;
    query.expiresAt = { $gt: new Date() };
  } else if (status === 'expired') {
    query.expiresAt = { $lte: new Date() };
  } else if (status === 'inactive') {
    query.isActive = false;
  }
  
  if (type) query.type = type;
  
  if (search) {
    query.$or = [
      { code: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }
  
  const coupons = await Coupon.find(query)
    .populate('createdBy', 'firstName lastName')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);
  
  const total = await Coupon.countDocuments(query);
  
  res.json(new ApiResponse(200, {
    coupons,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  }, 'Coupons retrieved successfully'));
});

// Get single coupon (Admin)
const getCoupon = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const coupon = await Coupon.findById(id)
    .populate('createdBy', 'firstName lastName')
    .populate('applicableCategories', 'name')
    .populate('applicableProducts', 'name')
    .populate('usedBy.user', 'firstName lastName email');
  
  if (!coupon) {
    throw new ApiError(404, 'Coupon not found');
  }
  
  res.json(new ApiResponse(200, coupon, 'Coupon retrieved successfully'));
});

// Create coupon (Admin)
const createCoupon = asyncHandler(async (req, res) => {
  const couponData = {
    ...req.body,
    createdBy: req.user.userId
  };
  
  // Check if coupon code already exists
  const existingCoupon = await Coupon.findOne({ code: couponData.code.toUpperCase() });
  if (existingCoupon) {
    throw new ApiError(409, 'Coupon code already exists');
  }
  
  const coupon = new Coupon(couponData);
  await coupon.save();
  
  logger.info(`Coupon created: ${coupon.code} by user ${req.user.userId}`);
  
  res.status(201).json(new ApiResponse(201, coupon, 'Coupon created successfully'));
});

// Update coupon (Admin)
const updateCoupon = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const coupon = await Coupon.findById(id);
  if (!coupon) {
    throw new ApiError(404, 'Coupon not found');
  }
  
  // Don't allow updating code if coupon has been used
  if (updates.code && coupon.usedCount > 0) {
    throw new ApiError(400, 'Cannot update code for used coupon');
  }
  
  Object.keys(updates).forEach(key => {
    if (updates[key] !== undefined) {
      coupon[key] = updates[key];
    }
  });
  
  await coupon.save();
  
  logger.info(`Coupon updated: ${coupon.code} by user ${req.user.userId}`);
  
  res.json(new ApiResponse(200, coupon, 'Coupon updated successfully'));
});

// Delete coupon (Admin)
const deleteCoupon = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const coupon = await Coupon.findById(id);
  if (!coupon) {
    throw new ApiError(404, 'Coupon not found');
  }
  
  // Don't allow deleting used coupons
  if (coupon.usedCount > 0) {
    throw new ApiError(400, 'Cannot delete used coupon');
  }
  
  await Coupon.findByIdAndDelete(id);
  
  logger.info(`Coupon deleted: ${coupon.code} by user ${req.user.userId}`);
  
  res.json(new ApiResponse(200, null, 'Coupon deleted successfully'));
});

// Validate coupon
const validateCoupon = asyncHandler(async (req, res) => {
  const { code } = req.params;
  const { amount, products = [], categories = [] } = req.body;
  
  const coupon = await Coupon.findOne({ 
    code: code.toUpperCase(),
    isActive: true,
    startsAt: { $lte: new Date() },
    expiresAt: { $gt: new Date() }
  });
  
  if (!coupon) {
    throw new ApiError(404, 'Invalid or expired coupon');
  }
  
  // Check usage limits
  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
    throw new ApiError(400, 'Coupon usage limit exceeded');
  }
  
  // Check if user can use coupon
  if (!coupon.canUserUse(req.user.userId)) {
    throw new ApiError(400, 'You have already used this coupon');
  }
  
  // Check minimum amount
  if (amount < coupon.minAmount) {
    throw new ApiError(400, `Minimum order amount of $${coupon.minAmount} required`);
  }
  
  // Check applicable categories/products
  if (coupon.applicableCategories.length > 0) {
    const hasApplicableCategory = categories.some(cat => 
      coupon.applicableCategories.includes(cat)
    );
    if (!hasApplicableCategory) {
      throw new ApiError(400, 'Coupon not applicable to items in cart');
    }
  }
  
  if (coupon.applicableProducts.length > 0) {
    const hasApplicableProduct = products.some(prod => 
      coupon.applicableProducts.includes(prod)
    );
    if (!hasApplicableProduct) {
      throw new ApiError(400, 'Coupon not applicable to items in cart');
    }
  }
  
  const discount = coupon.calculateDiscount(amount);
  
  res.json(new ApiResponse(200, {
    coupon: {
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      description: coupon.description
    },
    discount,
    finalAmount: amount - discount
  }, 'Coupon is valid'));
});

// Apply coupon
const applyCoupon = asyncHandler(async (req, res) => {
  const { code } = req.params;
  const { orderId } = req.body;
  
  const coupon = await Coupon.findOne({ 
    code: code.toUpperCase(),
    isActive: true,
    startsAt: { $lte: new Date() },
    expiresAt: { $gt: new Date() }
  });
  
  if (!coupon) {
    throw new ApiError(404, 'Invalid or expired coupon');
  }
  
  // Apply coupon usage
  await coupon.applyCoupon(req.user.userId, orderId);
  
  logger.info(`Coupon applied: ${coupon.code} by user ${req.user.userId} for order ${orderId}`);
  
  res.json(new ApiResponse(200, null, 'Coupon applied successfully'));
});

// Get coupon usage statistics (Admin)
const getCouponStats = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const coupon = await Coupon.findById(id);
  if (!coupon) {
    throw new ApiError(404, 'Coupon not found');
  }
  
  const stats = {
    totalUses: coupon.usedCount,
    remainingUses: coupon.maxUses ? coupon.maxUses - coupon.usedCount : 'Unlimited',
    conversionRate: 0, // Would need view tracking to calculate
    totalDiscount: 0,
    averageOrderValue: 0
  };
  
  // Calculate total discount and average order value
  if (coupon.usedBy.length > 0) {
    const Order = (await import('../models/Order.js')).default;
    const orders = await Order.find({
      _id: { $in: coupon.usedBy.map(u => u.orderId) }
    });
    
    stats.totalDiscount = orders.reduce((sum, order) => sum + (order.pricing.discount || 0), 0);
    stats.averageOrderValue = orders.reduce((sum, order) => sum + order.pricing.total, 0) / orders.length;
  }
  
  res.json(new ApiResponse(200, stats, 'Coupon statistics retrieved successfully'));
});

export {
  getCoupons,
  getCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
  applyCoupon,
  getCouponStats
};