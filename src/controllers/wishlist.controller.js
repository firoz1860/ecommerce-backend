import Wishlist from '../models/Wishlist.js';
import Product from '../models/Product.js';
import Cart from '../models/Cart.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import logger from '../utils/logger.js';

// Get user's wishlist
const getWishlist = asyncHandler(async (req, res) => {
  const wishlist = await Wishlist.getOrCreateWishlist(req.user.userId);
  
  res.json(new ApiResponse(200, wishlist, 'Wishlist retrieved successfully'));
});

// Update wishlist details
const updateWishlist = asyncHandler(async (req, res) => {
  const { name, description, isPublic } = req.body;
  
  const wishlist = await Wishlist.getOrCreateWishlist(req.user.userId);
  
  if (name !== undefined) wishlist.name = name;
  if (description !== undefined) wishlist.description = description;
  if (isPublic !== undefined) wishlist.isPublic = isPublic;
  
  await wishlist.save();
  
  logger.info(`Wishlist updated for user ${req.user.userId}`);
  
  res.json(new ApiResponse(200, wishlist, 'Wishlist updated successfully'));
});

// Add item to wishlist
const addToWishlist = asyncHandler(async (req, res) => {
  const { productId, variantId, notes } = req.body;
  
  // Check if product exists
  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }
  
  if (!product.isActive) {
    throw new ApiError(400, 'Product is not available');
  }
  
  const wishlist = await Wishlist.getOrCreateWishlist(req.user.userId);
  
  try {
    await wishlist.addItem(productId, variantId, notes);
    await wishlist.populate('items.product', 'name price images');
    
    logger.info(`Item added to wishlist: ${productId} for user ${req.user.userId}`);
    
    res.json(new ApiResponse(200, wishlist, 'Item added to wishlist successfully'));
  } catch (error) {
    if (error.message === 'Item already in wishlist') {
      throw new ApiError(400, 'Item already in wishlist');
    }
    throw error;
  }
});

// Remove item from wishlist
const removeFromWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { variantId } = req.query;
  
  const wishlist = await Wishlist.findOne({ user: req.user.userId });
  if (!wishlist) {
    throw new ApiError(404, 'Wishlist not found');
  }
  
  await wishlist.removeItem(productId, variantId);
  await wishlist.populate('items.product', 'name price images');
  
  logger.info(`Item removed from wishlist: ${productId} for user ${req.user.userId}`);
  
  res.json(new ApiResponse(200, wishlist, 'Item removed from wishlist successfully'));
});

// Clear entire wishlist
const clearWishlist = asyncHandler(async (req, res) => {
  const wishlist = await Wishlist.findOne({ user: req.user.userId });
  if (!wishlist) {
    throw new ApiError(404, 'Wishlist not found');
  }
  
  await wishlist.clearWishlist();
  
  logger.info(`Wishlist cleared for user ${req.user.userId}`);
  
  res.json(new ApiResponse(200, wishlist, 'Wishlist cleared successfully'));
});

// Move wishlist item to cart
const moveToCart = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { quantity = 1 } = req.body;
  
  const wishlist = await Wishlist.findOne({ user: req.user.userId });
  if (!wishlist) {
    throw new ApiError(404, 'Wishlist not found');
  }
  
  // Check if item exists in wishlist
  const wishlistItem = wishlist.items.find(item => 
    item.product.toString() === productId
  );
  
  if (!wishlistItem) {
    throw new ApiError(404, 'Item not found in wishlist');
  }
  
  // Get product details
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
  
  // Add to cart
  const cart = await Cart.getOrCreateCart(req.user.userId);
  const price = product.salePrice && product.salePrice < product.price 
    ? product.salePrice 
    : product.price;
  
  await cart.addItem(productId, quantity, price, wishlistItem.variant);
  
  // Remove from wishlist
  await wishlist.removeItem(productId, wishlistItem.variant);
  
  logger.info(`Item moved from wishlist to cart: ${productId} for user ${req.user.userId}`);
  
  res.json(new ApiResponse(200, null, 'Item moved to cart successfully'));
});

// Generate shareable link for wishlist
const shareWishlist = asyncHandler(async (req, res) => {
  const wishlist = await Wishlist.getOrCreateWishlist(req.user.userId);
  
  await wishlist.generateShareToken();
  
  const shareUrl = `${process.env.FRONTEND_URL}/wishlist/shared/${wishlist.shareToken}`;
  
  logger.info(`Wishlist share link generated for user ${req.user.userId}`);
  
  res.json(new ApiResponse(200, {
    shareToken: wishlist.shareToken,
    shareUrl
  }, 'Share link generated successfully'));
});

// Get shared wishlist by token
const getSharedWishlist = asyncHandler(async (req, res) => {
  const { token } = req.params;
  
  const wishlist = await Wishlist.findOne({ 
    shareToken: token,
    isPublic: true 
  }).populate('items.product', 'name price images rating')
    .populate('user', 'firstName lastName');
  
  if (!wishlist) {
    throw new ApiError(404, 'Shared wishlist not found or not public');
  }
  
  res.json(new ApiResponse(200, wishlist, 'Shared wishlist retrieved successfully'));
});

export {
  getWishlist,
  updateWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist,
  moveToCart,
  shareWishlist,
  getSharedWishlist
};