import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { getRedisClient } from '../config/redis.js';
import logger from '../utils/logger.js';

// Get user's cart
const getCart = asyncHandler(async (req, res) => {
  const cart = await Cart.getOrCreateCart(req.user.userId);
  await cart.populate('items.product', 'name price images stock isActive');
  
  res.json(new ApiResponse(200, cart, 'Cart retrieved successfully'));
});

// Get cart summary
const getCartSummary = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user.userId });
  
  if (!cart) {
    return res.json(new ApiResponse(200, {
      totalItems: 0,
      totalAmount: 0,
      itemsCount: 0
    }, 'Cart summary retrieved successfully'));
  }
  
  const summary = cart.getSummary();
  
  res.json(new ApiResponse(200, summary, 'Cart summary retrieved successfully'));
});

// Add item to cart
const addToCart = asyncHandler(async (req, res) => {
  const { productId, quantity, variantId } = req.body;
  const userId = req.user.userId;
  
  // Validate product
  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }
  
  if (!product.isActive) {
    throw new ApiError(400, 'Product is not available');
  }
  
  if (product.stock < quantity) {
    throw new ApiError(400, `Only ${product.stock} units available`);
  }
  
  // Use Redis lock to prevent race conditions
  const redis = getRedisClient();
  const lockKey = `cart_lock:${userId}:${productId}`;
  const lockValue = Date.now().toString();
  
  try {
    // Acquire lock
    const lockAcquired = await redis.set(lockKey, lockValue, 'PX', 5000, 'NX');
    
    if (!lockAcquired) {
      throw new ApiError(409, 'Cart is being updated, please try again');
    }
    
    // Get or create cart
    const cart = await Cart.getOrCreateCart(userId);
    
    // Determine price (use sale price if available)
    const price = product.salePrice && product.salePrice < product.price 
      ? product.salePrice 
      : product.price;
    
    // Add item to cart
    await cart.addItem(productId, quantity, price, variantId);
    
    // Populate cart items
    await cart.populate('items.product', 'name price images stock');
    
    logger.info(`Item added to cart: ${productId} x${quantity} for user ${userId}`);
    
    res.json(new ApiResponse(200, cart, 'Item added to cart successfully'));
  } finally {
    // Release lock
    const currentLock = await redis.get(lockKey);
    if (currentLock === lockValue) {
      await redis.del(lockKey);
    }
  }
});

// Update cart item quantity
const updateCartItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { quantity, variantId } = req.body;
  const userId = req.user.userId;
  
  // Validate product and stock
  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }
  
  if (quantity > product.stock) {
    throw new ApiError(400, `Only ${product.stock} units available`);
  }
  
  // Use Redis lock
  const redis = getRedisClient();
  const lockKey = `cart_lock:${userId}:${productId}`;
  const lockValue = Date.now().toString();
  
  try {
    const lockAcquired = await redis.set(lockKey, lockValue, 'PX', 5000, 'NX');
    
    if (!lockAcquired) {
      throw new ApiError(409, 'Cart is being updated, please try again');
    }
    
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw new ApiError(404, 'Cart not found');
    }
    
    await cart.updateItem(productId, quantity, variantId);
    await cart.populate('items.product', 'name price images stock');
    
    logger.info(`Cart item updated: ${productId} quantity=${quantity} for user ${userId}`);
    
    res.json(new ApiResponse(200, cart, 'Cart item updated successfully'));
  } finally {
    const currentLock = await redis.get(lockKey);
    if (currentLock === lockValue) {
      await redis.del(lockKey);
    }
  }
});

// Remove item from cart
const removeFromCart = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { variantId } = req.query;
  const userId = req.user.userId;
  
  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    throw new ApiError(404, 'Cart not found');
  }
  
  await cart.removeItem(productId, variantId);
  await cart.populate('items.product', 'name price images stock');
  
  logger.info(`Item removed from cart: ${productId} for user ${userId}`);
  
  res.json(new ApiResponse(200, cart, 'Item removed from cart successfully'));
});

// Clear entire cart
const clearCart = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  
  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    throw new ApiError(404, 'Cart not found');
  }
  
  await cart.clearCart();
  
  logger.info(`Cart cleared for user ${userId}`);
  
  res.json(new ApiResponse(200, cart, 'Cart cleared successfully'));
});

// Validate cart items
const validateCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user.userId });
  
  if (!cart || cart.isEmpty()) {
    return res.json(new ApiResponse(200, {
      isValid: true,
      errors: [],
      cart: cart || { items: [], totalAmount: 0, totalItems: 0 }
    }, 'Cart validation completed'));
  }
  
  const errors = await cart.validateItems();
  const isValid = errors.length === 0;
  
  await cart.populate('items.product', 'name price images stock isActive');
  
  res.json(new ApiResponse(200, {
    isValid,
    errors,
    cart
  }, 'Cart validation completed'));
});

// Move cart item to wishlist
const moveToWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const userId = req.user.userId;
  
  // Get cart and user
  const [cart, user] = await Promise.all([
    Cart.findOne({ user: userId }),
    User.findById(userId)
  ]);
  
  if (!cart) {
    throw new ApiError(404, 'Cart not found');
  }
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  
  // Check if item exists in cart
  const cartItem = cart.items.find(item => item.product.toString() === productId);
  if (!cartItem) {
    throw new ApiError(404, 'Item not found in cart');
  }
  
  // Add to wishlist if not already there
  if (!user.wishlist.includes(productId)) {
    user.wishlist.push(productId);
    await user.save();
  }
  
  // Remove from cart
  await cart.removeItem(productId);
  
  logger.info(`Item moved to wishlist: ${productId} for user ${userId}`);
  
  res.json(new ApiResponse(200, null, 'Item moved to wishlist successfully'));
});

// Apply coupon to cart
const applyCoupon = asyncHandler(async (req, res) => {
  const { couponCode } = req.body;
  const userId = req.user.userId;
  
  // This is a placeholder implementation
  // In a real application, you would have a Coupon model and validation logic
  
  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    throw new ApiError(404, 'Cart not found');
  }
  
  // Mock coupon validation
  const mockCoupons = {
    'SAVE10': { type: 'percentage', value: 10, minAmount: 50 },
    'FLAT20': { type: 'fixed', value: 20, minAmount: 100 }
  };
  
  const coupon = mockCoupons[couponCode.toUpperCase()];
  if (!coupon) {
    throw new ApiError(400, 'Invalid coupon code');
  }
  
  if (cart.totalAmount < coupon.minAmount) {
    throw new ApiError(400, `Minimum order amount of $${coupon.minAmount} required`);
  }
  
  // Calculate discount
  let discount = 0;
  if (coupon.type === 'percentage') {
    discount = (cart.totalAmount * coupon.value) / 100;
  } else {
    discount = coupon.value;
  }
  
  // Apply discount (this would be stored in cart model in real implementation)
  const discountedTotal = Math.max(0, cart.totalAmount - discount);
  
  logger.info(`Coupon applied: ${couponCode} for user ${userId}`);
  
  res.json(new ApiResponse(200, {
    couponCode,
    discount,
    originalTotal: cart.totalAmount,
    discountedTotal
  }, 'Coupon applied successfully'));
});

// Remove coupon from cart
const removeCoupon = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  
  // In real implementation, you would remove coupon from cart model
  
  logger.info(`Coupon removed for user ${userId}`);
  
  res.json(new ApiResponse(200, null, 'Coupon removed successfully'));
});

// Save item for later
const saveForLater = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const userId = req.user.userId;
  
  // This would move item from cart to a "saved for later" list
  // For now, we'll just remove from cart
  
  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    throw new ApiError(404, 'Cart not found');
  }
  
  await cart.removeItem(productId);
  
  logger.info(`Item saved for later: ${productId} for user ${userId}`);
  
  res.json(new ApiResponse(200, null, 'Item saved for later'));
});

// Move saved item back to cart
const moveFromSavedItems = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const userId = req.user.userId;
  
  // This would move item from "saved for later" back to cart
  // For now, we'll just add to cart with quantity 1
  
  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }
  
  const cart = await Cart.getOrCreateCart(userId);
  const price = product.salePrice && product.salePrice < product.price 
    ? product.salePrice 
    : product.price;
  
  await cart.addItem(productId, 1, price);
  
  logger.info(`Item moved from saved to cart: ${productId} for user ${userId}`);
  
  res.json(new ApiResponse(200, null, 'Item moved to cart successfully'));
});

export {
  getCart,
  getCartSummary,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  validateCart,
  moveToWishlist,
  applyCoupon,
  removeCoupon,
  saveForLater,
  moveFromSavedItems
};