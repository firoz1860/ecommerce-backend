import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { uploadImage, deleteImage } from '../config/cloudinary.js';
import logger from '../utils/logger.js';
import fs from 'fs/promises';

// Get user profile
const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId);
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  
  res.json(new ApiResponse(200, user, 'Profile retrieved successfully'));
});

// Update user profile
const updateProfile = asyncHandler(async (req, res) => {
  const { firstName, lastName, phone } = req.body;
  
  const user = await User.findById(req.user.userId);
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  
  // Update fields if provided
  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (phone !== undefined) user.phone = phone;
  
  await user.save();
  
  logger.info(`Profile updated for user: ${user.email}`);
  
  res.json(new ApiResponse(200, user, 'Profile updated successfully'));
});

// Change password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  const user = await User.findById(req.user.userId);
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  
  // Verify current password
  const isCurrentPasswordValid = await user.comparePassword(currentPassword);
  if (!isCurrentPasswordValid) {
    throw new ApiError(400, 'Current password is incorrect');
  }
  
  // Update password
  user.password = newPassword;
  await user.save();
  
  logger.info(`Password changed for user: ${user.email}`);
  
  res.json(new ApiResponse(200, null, 'Password changed successfully'));
});

// Upload avatar
const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'Avatar image is required');
  }
  
  const user = await User.findById(req.user.userId);
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  
  try {
    // Delete old avatar if exists
    if (user.avatar?.public_id) {
      await deleteImage(user.avatar.public_id);
    }
    
    // Upload new avatar
    const result = await uploadImage(req.file.path, 'avatars');
    
    user.avatar = {
      url: result.url,
      public_id: result.public_id
    };
    
    await user.save();
    
      //  Delete the local file from "uploads/" folder
    await fs.unlink(req.file.path);
    
    logger.info(`Avatar uploaded for user: ${user.email}`);
    
    res.json(new ApiResponse(200, { avatar: user.avatar }, 'Avatar uploaded successfully'));
  } catch (error) {
    throw new ApiError(500, 'Avatar upload failed');
  }
});

// Delete avatar
const deleteAvatar = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId);
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  
  if (user.avatar?.public_id) {
    try {
      await deleteImage(user.avatar.public_id);
    } catch (error) {
      logger.error('Failed to delete avatar from Cloudinary:', error);
    }
  }
  
  user.avatar = undefined;
  await user.save();
  
  logger.info(`Avatar deleted for user: ${user.email}`);
  
  res.json(new ApiResponse(200, null, 'Avatar deleted successfully'));
});

// Get user addresses
const getAddresses = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId);
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  
  res.json(new ApiResponse(200, user.addresses, 'Addresses retrieved successfully'));
});

// Add address
const addAddress = asyncHandler(async (req, res) => {
  const { type, street, city, state, zipCode, country, isDefault } = req.body;
  
  const user = await User.findById(req.user.userId);
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  
  // If this is set as default, unset other default addresses
  if (isDefault) {
    user.addresses.forEach(addr => {
      addr.isDefault = false;
    });
  }
  
  const newAddress = {
    type: type || 'home',
    street,
    city,
    state,
    zipCode,
    country: country || 'USA',
    isDefault: isDefault || user.addresses.length === 0
  };
  
  user.addresses.push(newAddress);
  await user.save();
  
  const addedAddress = user.addresses[user.addresses.length - 1];
  
  logger.info(`Address added for user: ${user.email}`);
  
  res.json(new ApiResponse(201, addedAddress, 'Address added successfully'));
});

// Update address
const updateAddress = asyncHandler(async (req, res) => {
  const { addressId } = req.params;
  const updates = req.body;
  
  const user = await User.findById(req.user.userId);
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  
  const address = user.addresses.id(addressId);
  
  if (!address) {
    throw new ApiError(404, 'Address not found');
  }
  
  // Update address fields
  Object.keys(updates).forEach(key => {
    if (updates[key] !== undefined) {
      address[key] = updates[key];
    }
  });
  
  await user.save();
  
  logger.info(`Address updated for user: ${user.email}`);
  
  res.json(new ApiResponse(200, address, 'Address updated successfully'));
});

// Delete address
const deleteAddress = asyncHandler(async (req, res) => {
  const { addressId } = req.params;
  
  const user = await User.findById(req.user.userId);
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  
  const address = user.addresses.id(addressId);
  
  if (!address) {
    throw new ApiError(404, 'Address not found');
  }
  
  const wasDefault = address.isDefault;
  address.deleteOne();
  
  // If deleted address was default, set first remaining address as default
  if (wasDefault && user.addresses.length > 0) {
    user.addresses[0].isDefault = true;
  }
  
  await user.save();
  
  logger.info(`Address deleted for user: ${user.email}`);
  
  res.json(new ApiResponse(200, null, 'Address deleted successfully'));
});

// Set default address
const setDefaultAddress = asyncHandler(async (req, res) => {
  const { addressId } = req.params;
  
  const user = await User.findById(req.user.userId);
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  
  const address = user.addresses.id(addressId);
  
  if (!address) {
    throw new ApiError(404, 'Address not found');
  }
  
  // Unset all default addresses
  user.addresses.forEach(addr => {
    addr.isDefault = false;
  });
  
  // Set this address as default
  address.isDefault = true;
  
  await user.save();
  
  logger.info(`Default address set for user: ${user.email}`);
  
  res.json(new ApiResponse(200, address, 'Default address set successfully'));
});

// Get wishlist
const getWishlist = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId).populate({
    path: 'wishlist',
    populate: {
      path: 'category',
      select: 'name slug'
    }
  });
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  
  res.json(new ApiResponse(200, user.wishlist, 'Wishlist retrieved successfully'));
});

// Add to wishlist
const addToWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  
  const user = await User.findById(req.user.userId);
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  
  // Check if product exists
  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }
  
  // Check if already in wishlist
  if (user.wishlist.includes(productId)) {
    throw new ApiError(400, 'Product already in wishlist');
  }
  
  user.wishlist.push(productId);
  await user.save();
  
  logger.info(`Product ${productId} added to wishlist for user: ${user.email}`);
  
  res.json(new ApiResponse(200, null, 'Product added to wishlist'));
});

// Remove from wishlist
const removeFromWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  
  const user = await User.findById(req.user.userId);
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  
  user.wishlist = user.wishlist.filter(id => id.toString() !== productId);
  await user.save();
  
  logger.info(`Product ${productId} removed from wishlist for user: ${user.email}`);
  
  res.json(new ApiResponse(200, null, 'Product removed from wishlist'));
});

// Deactivate account
const deactivateAccount = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId);
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  
  user.isActive = false;
  user.refreshTokens = []; // Clear all refresh tokens
  await user.save();
  
  logger.info(`Account deactivated for user: ${user.email}`);
  
  res.json(new ApiResponse(200, null, 'Account deactivated successfully'));
});

// Get user orders
const getUserOrders = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  
  const query = { user: req.user.userId };
  if (status) query.status = status;
  
  const orders = await Order.find(query)
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .populate('items.product', 'name images price');
  
  const total = await Order.countDocuments(query);
  
  res.json(new ApiResponse(200, {
    orders,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  }, 'Orders retrieved successfully'));
});

// Get user stats
const getUserStats = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  
  const [orderStats, wishlistCount] = await Promise.all([
    Order.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: '$pricing.total' },
          averageOrderValue: { $avg: '$pricing.total' }
        }
      }
    ]),
    User.findById(userId).then(user => user?.wishlist?.length || 0)
  ]);
  
  const stats = {
    totalOrders: orderStats[0]?.totalOrders || 0,
    totalSpent: orderStats[0]?.totalSpent || 0,
    averageOrderValue: orderStats[0]?.averageOrderValue || 0,
    wishlistItems: wishlistCount
  };
  
  res.json(new ApiResponse(200, stats, 'User stats retrieved successfully'));
});

export {
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
};