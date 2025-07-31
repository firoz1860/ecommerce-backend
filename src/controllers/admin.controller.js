import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Category from '../models/Category.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import logger from '../utils/logger.js';
import fs from 'fs';
import csv from 'csv-parser';

// Get dashboard statistics
const getDashboardStats = asyncHandler(async (req, res) => {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfYear = new Date(today.getFullYear(), 0, 1);
  
  const [
    totalUsers,
    totalProducts,
    totalOrders,
    totalRevenue,
    todayOrders,
    todayRevenue,
    monthlyOrders,
    monthlyRevenue,
    lowStockProducts,
    recentOrders
  ] = await Promise.all([
    User.countDocuments({ role: 'customer' }),
    Product.countDocuments({ isActive: true }),
    Order.countDocuments(),
    Order.aggregate([
      { $group: { _id: null, total: { $sum: '$pricing.total' } } }
    ]).then(result => result[0]?.total || 0),
    Order.countDocuments({ createdAt: { $gte: startOfDay } }),
    Order.aggregate([
      { $match: { createdAt: { $gte: startOfDay } } },
      { $group: { _id: null, total: { $sum: '$pricing.total' } } }
    ]).then(result => result[0]?.total || 0),
    Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
    Order.aggregate([
      { $match: { createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$pricing.total' } } }
    ]).then(result => result[0]?.total || 0),
    Product.countDocuments({
      $expr: { $lte: ['$stock', '$lowStockThreshold'] },
      isActive: true
    }),
    Order.find()
      .populate('user', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(5)
  ]);
  
  const stats = {
    overview: {
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue
    },
    today: {
      orders: todayOrders,
      revenue: todayRevenue
    },
    monthly: {
      orders: monthlyOrders,
      revenue: monthlyRevenue
    },
    alerts: {
      lowStockProducts
    },
    recentOrders
  };
  
  res.json(new ApiResponse(200, stats, 'Dashboard stats retrieved successfully'));
});

// Get detailed analytics
const getAnalytics = asyncHandler(async (req, res) => {
  const { period = 'month', startDate, endDate } = req.query;
  
  let start, end;
  const now = new Date();
  
  if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
  } else {
    switch (period) {
      case 'day':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'week':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        end = now;
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = now;
        break;
      case 'quarter':
        start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        end = now;
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        end = now;
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = now;
    }
  }
  
  const [salesData, topProducts, topCategories, userGrowth] = await Promise.all([
    // Sales data over time
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: { $nin: ['cancelled', 'refunded'] }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: period === 'day' ? '%H' : period === 'week' ? '%Y-%m-%d' : '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          revenue: { $sum: '$pricing.total' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]),
    
    // Top selling products
    Order.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalSold: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.total' }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' }
    ]),
    
    // Top categories
    Order.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $group: {
          _id: '$product.category',
          totalSold: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.total' }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: '$category' }
    ]),
    
    // User growth
    User.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          role: 'customer'
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          newUsers: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ])
  ]);
  
  const analytics = {
    period,
    dateRange: { start, end },
    salesData,
    topProducts,
    topCategories,
    userGrowth
  };
  
  res.json(new ApiResponse(200, analytics, 'Analytics data retrieved successfully'));
});

// Get all users
const getUsers = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    role,
    status
  } = req.query;
  
  const query = {};
  
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }
  
  if (role) query.role = role;
  if (status) query.isActive = status === 'active';
  
  const users = await User.find(query)
    .select('-password -refreshTokens')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);
  
  const total = await User.countDocuments(query);
  
  res.json(new ApiResponse(200, {
    users,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  }, 'Users retrieved successfully'));
});

// Get user details
const getUserDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const user = await User.findById(id).select('-password -refreshTokens');
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  
  // Get user statistics
  const [orderCount, totalSpent, lastOrder] = await Promise.all([
    Order.countDocuments({ user: id }),
    Order.aggregate([
      { $match: { user: user._id } },
      { $group: { _id: null, total: { $sum: '$pricing.total' } } }
    ]).then(result => result[0]?.total || 0),
    Order.findOne({ user: id }).sort({ createdAt: -1 })
  ]);
  
  const userDetails = {
    ...user.toJSON(),
    statistics: {
      orderCount,
      totalSpent,
      lastOrderDate: lastOrder?.createdAt
    }
  };
  
  res.json(new ApiResponse(200, userDetails, 'User details retrieved successfully'));
});

// Update user status
const updateUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive, reason } = req.body;
  
  const user = await User.findById(id);
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  
  user.isActive = isActive;
  await user.save();
  
  logger.info(`User status updated: ${user.email} - Active: ${isActive} - Reason: ${reason}`);
  
  res.json(new ApiResponse(200, user, 'User status updated successfully'));
});

// Delete user
const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const user = await User.findById(id);
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  
  // Check if user has orders
  const orderCount = await Order.countDocuments({ user: id });
  
  if (orderCount > 0) {
    // Deactivate instead of delete if user has orders
    user.isActive = false;
    await user.save();
    
    logger.info(`User deactivated instead of deleted due to existing orders: ${user.email}`);
    
    res.json(new ApiResponse(200, null, 'User deactivated due to existing orders'));
  } else {
    await User.findByIdAndDelete(id);
    
    logger.info(`User deleted: ${user.email}`);
    
    res.json(new ApiResponse(200, null, 'User deleted successfully'));
  }
});

// Get products for admin
const getProducts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    category,
    status,
    lowStock
  } = req.query;
  
  const query = {};
  
  if (category) query.category = category;
  if (status) query.isActive = status === 'active';
  if (lowStock === 'true') {
    query.$expr = { $lte: ['$stock', '$lowStockThreshold'] };
  }
  
  const products = await Product.find(query)
    .populate('category', 'name')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);
  
  const total = await Product.countDocuments(query);
  
  res.json(new ApiResponse(200, {
    products,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  }, 'Products retrieved successfully'));
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
  
  logger.info(`Bulk update applied to ${result.modifiedCount} products by admin ${req.user.userId}`);
  
  res.json(new ApiResponse(200, {
    modifiedCount: result.modifiedCount
  }, 'Products updated successfully'));
});

// Bulk delete products
const bulkDeleteProducts = asyncHandler(async (req, res) => {
  const { productIds } = req.body;
  
  if (!Array.isArray(productIds) || productIds.length === 0) {
    throw new ApiError(400, 'Product IDs array is required');
  }
  
  const result = await Product.deleteMany({ _id: { $in: productIds } });
  
  logger.info(`Bulk delete: ${result.deletedCount} products deleted by admin ${req.user.userId}`);
  
  res.json(new ApiResponse(200, {
    deletedCount: result.deletedCount
  }, 'Products deleted successfully'));
});

// Import products from CSV
const importProducts = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'CSV file is required');
  }
  
  const products = [];
  const errors = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (row) => {
        try {
          // Validate and transform CSV row to product object
          const product = {
            name: row.name,
            description: row.description,
            price: parseFloat(row.price),
            category: row.category, // This should be a valid category ID
            brand: row.brand,
            sku: row.sku,
            stock: parseInt(row.stock),
            isActive: row.isActive === 'true'
          };
          
          products.push(product);
        } catch (error) {
          errors.push(`Row error: ${error.message}`);
        }
      })
      .on('end', async () => {
        try {
          if (products.length > 0) {
            const result = await Product.insertMany(products, { ordered: false });
            
            logger.info(`Products imported: ${result.length} by admin ${req.user.userId}`);
            
            res.json(new ApiResponse(200, {
              imported: result.length,
              errors
            }, 'Products imported successfully'));
          } else {
            throw new ApiError(400, 'No valid products found in CSV');
          }
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
});

// Export products to CSV
const exportProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({})
    .populate('category', 'name')
    .lean();
  
  // Convert to CSV format
  const csvData = products.map(product => ({
    id: product._id,
    name: product.name,
    description: product.description,
    price: product.price,
    category: product.category?.name,
    brand: product.brand,
    sku: product.sku,
    stock: product.stock,
    isActive: product.isActive,
    createdAt: product.createdAt
  }));
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=products.csv');
  
  // Simple CSV generation (in production, use a proper CSV library)
  const csvString = [
    Object.keys(csvData[0]).join(','),
    ...csvData.map(row => Object.values(row).join(','))
  ].join('\n');
  
  res.send(csvString);
});

// Get orders for admin
const getOrders = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    startDate,
    endDate
  } = req.query;
  
  const query = {};
  
  if (status) query.status = status;
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  
  const orders = await Order.find(query)
    .populate('user', 'firstName lastName email')
    .populate('items.product', 'name')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);
  
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

// Get order details for admin
const getOrderDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const order = await Order.findById(id)
    .populate('user', 'firstName lastName email phone')
    .populate('items.product', 'name images sku');
  
  if (!order) {
    throw new ApiError(404, 'Order not found');
  }
  
  res.json(new ApiResponse(200, order, 'Order details retrieved successfully'));
});

// Update order status (Admin)
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, note } = req.body;
  
  const order = await Order.findById(id);
  
  if (!order) {
    throw new ApiError(404, 'Order not found');
  }
  
  order.addStatusHistory(status, note, req.user.userId);
  await order.save();
  
  logger.info(`Order status updated by admin: ${order.orderNumber} to ${status}`);
  
  res.json(new ApiResponse(200, order, 'Order status updated successfully'));
});

// Process refund (Admin)
const processRefund = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { amount, reason } = req.body;
  
  const order = await Order.findById(id);
  
  if (!order) {
    throw new ApiError(404, 'Order not found');
  }
  
  // Process refund logic here
  order.addStatusHistory('refunded', `Refund processed: $${amount} - ${reason}`, req.user.userId);
  order.refundAmount = amount;
  order.refundReason = reason;
  
  await order.save();
  
  logger.info(`Refund processed by admin: ${order.orderNumber} - $${amount}`);
  
  res.json(new ApiResponse(200, order, 'Refund processed successfully'));
});

// Placeholder implementations for remaining functions
const getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({}).sort({ sortOrder: 1, name: 1 });
  res.json(new ApiResponse(200, categories, 'Categories retrieved successfully'));
});

const createCategory = asyncHandler(async (req, res) => {
  const category = new Category(req.body);
  await category.save();
  res.status(201).json(new ApiResponse(201, category, 'Category created successfully'));
});

const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const category = await Category.findByIdAndUpdate(id, req.body, { new: true });
  if (!category) throw new ApiError(404, 'Category not found');
  res.json(new ApiResponse(200, category, 'Category updated successfully'));
});

const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await Category.findByIdAndDelete(id);
  res.json(new ApiResponse(200, null, 'Category deleted successfully'));
});

const getSalesReport = asyncHandler(async (req, res) => {
  // Implementation for sales report
  res.json(new ApiResponse(200, {}, 'Sales report generated'));
});

const getInventoryReport = asyncHandler(async (req, res) => {
  // Implementation for inventory report
  res.json(new ApiResponse(200, {}, 'Inventory report generated'));
});

const getUserReport = asyncHandler(async (req, res) => {
  // Implementation for user report
  res.json(new ApiResponse(200, {}, 'User report generated'));
});

const getCoupons = asyncHandler(async (req, res) => {
  // Implementation for getting coupons
  res.json(new ApiResponse(200, [], 'Coupons retrieved successfully'));
});

const createCoupon = asyncHandler(async (req, res) => {
  // Implementation for creating coupon
  res.status(201).json(new ApiResponse(201, {}, 'Coupon created successfully'));
});

const updateCoupon = asyncHandler(async (req, res) => {
  // Implementation for updating coupon
  res.json(new ApiResponse(200, {}, 'Coupon updated successfully'));
});

const deleteCoupon = asyncHandler(async (req, res) => {
  // Implementation for deleting coupon
  res.json(new ApiResponse(200, null, 'Coupon deleted successfully'));
});

const getReviews = asyncHandler(async (req, res) => {
  // Implementation for getting reviews
  res.json(new ApiResponse(200, [], 'Reviews retrieved successfully'));
});

const moderateReview = asyncHandler(async (req, res) => {
  // Implementation for moderating review
  res.json(new ApiResponse(200, {}, 'Review moderated successfully'));
});

const getSupport = asyncHandler(async (req, res) => {
  // Implementation for getting support tickets
  res.json(new ApiResponse(200, [], 'Support tickets retrieved successfully'));
});

const respondToSupport = asyncHandler(async (req, res) => {
  // Implementation for responding to support
  res.json(new ApiResponse(200, {}, 'Support response sent successfully'));
});

const closeSupport = asyncHandler(async (req, res) => {
  // Implementation for closing support ticket
  res.json(new ApiResponse(200, {}, 'Support ticket closed successfully'));
});

const getSystemHealth = asyncHandler(async (req, res) => {
  // Implementation for system health check
  res.json(new ApiResponse(200, { status: 'healthy' }, 'System health retrieved'));
});

const getSystemLogs = asyncHandler(async (req, res) => {
  // Implementation for getting system logs
  res.json(new ApiResponse(200, [], 'System logs retrieved successfully'));
});

const getSettings = asyncHandler(async (req, res) => {
  // Implementation for getting settings
  res.json(new ApiResponse(200, {}, 'Settings retrieved successfully'));
});

const updateSettings = asyncHandler(async (req, res) => {
  // Implementation for updating settings
  res.json(new ApiResponse(200, {}, 'Settings updated successfully'));
});

const backupDatabase = asyncHandler(async (req, res) => {
  // Implementation for database backup
  res.json(new ApiResponse(200, {}, 'Database backup initiated'));
});

const restoreDatabase = asyncHandler(async (req, res) => {
  // Implementation for database restore
  res.json(new ApiResponse(200, {}, 'Database restore initiated'));
});

const sendBulkEmail = asyncHandler(async (req, res) => {
  // Implementation for sending bulk email
  res.json(new ApiResponse(200, {}, 'Bulk email sent successfully'));
});

const getEmailTemplates = asyncHandler(async (req, res) => {
  // Implementation for getting email templates
  res.json(new ApiResponse(200, [], 'Email templates retrieved successfully'));
});

const updateEmailTemplate = asyncHandler(async (req, res) => {
  // Implementation for updating email template
  res.json(new ApiResponse(200, {}, 'Email template updated successfully'));
});

export {
  getDashboardStats,
  getUsers,
  getUserDetails,
  updateUserStatus,
  deleteUser,
  getProducts,
  bulkUpdateProducts,
  bulkDeleteProducts,
  importProducts,
  exportProducts,
  getOrders,
  updateOrderStatus,
  getOrderDetails,
  processRefund,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getAnalytics,
  getSalesReport,
  getInventoryReport,
  getUserReport,
  getSystemLogs,
  getSystemHealth,
  createCoupon,
  getCoupons,
  updateCoupon,
  deleteCoupon,
  getReviews,
  moderateReview,
  getSupport,
  respondToSupport,
  closeSupport,
  getSettings,
  updateSettings,
  backupDatabase,
  restoreDatabase,
  sendBulkEmail,
  getEmailTemplates,
  updateEmailTemplate
};