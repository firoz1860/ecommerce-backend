import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import Category from '../models/Category.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';

// Get sales analytics
const getSalesAnalytics = asyncHandler(async (req, res) => {
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
  
  const salesData = await Order.aggregate([
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
            format: period === 'day' ? '%H' : '%Y-%m-%d',
            date: '$createdAt'
          }
        },
        totalSales: { $sum: '$pricing.total' },
        orderCount: { $sum: 1 },
        averageOrderValue: { $avg: '$pricing.total' }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  
  const totalSales = salesData.reduce((sum, item) => sum + item.totalSales, 0);
  const totalOrders = salesData.reduce((sum, item) => sum + item.orderCount, 0);
  
  res.json(new ApiResponse(200, {
    period,
    dateRange: { start, end },
    salesData,
    summary: {
      totalSales,
      totalOrders,
      averageOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0
    }
  }, 'Sales analytics retrieved successfully'));
});

// Get product analytics
const getProductAnalytics = asyncHandler(async (req, res) => {
  const { period = 'month', category, limit = 10 } = req.query;
  
  const now = new Date();
  let start;
  
  switch (period) {
    case 'day':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'quarter':
      start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      break;
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  
  const matchStage = {
    createdAt: { $gte: start, $lte: now },
    status: { $nin: ['cancelled', 'refunded'] }
  };
  
  const topProducts = await Order.aggregate([
    { $match: matchStage },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        totalSold: { $sum: '$items.quantity' },
        revenue: { $sum: '$items.total' },
        orderCount: { $sum: 1 }
      }
    },
    { $sort: { revenue: -1 } },
    { $limit: parseInt(limit) },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' }
  ]);
  
  // Filter by category if specified
  let filteredProducts = topProducts;
  if (category) {
    filteredProducts = topProducts.filter(item => 
      item.product.category.toString() === category
    );
  }
  
  const lowStockProducts = await Product.find({
    $expr: { $lte: ['$stock', '$lowStockThreshold'] },
    isActive: true
  }).limit(10);
  
  res.json(new ApiResponse(200, {
    period,
    topProducts: filteredProducts,
    lowStockProducts,
    totalProducts: await Product.countDocuments({ isActive: true })
  }, 'Product analytics retrieved successfully'));
});

// Get user analytics
const getUserAnalytics = asyncHandler(async (req, res) => {
  const { period = 'month' } = req.query;
  
  const now = new Date();
  let start;
  
  switch (period) {
    case 'day':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'quarter':
      start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      break;
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  
  const [userGrowth, userStats] = await Promise.all([
    User.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: now },
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
    ]),
    User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: {
            $sum: { $cond: ['$isActive', 1, 0] }
          },
          verifiedUsers: {
            $sum: { $cond: ['$isEmailVerified', 1, 0] }
          }
        }
      }
    ])
  ]);
  
  res.json(new ApiResponse(200, {
    period,
    userGrowth,
    summary: userStats[0] || {
      totalUsers: 0,
      activeUsers: 0,
      verifiedUsers: 0
    }
  }, 'User analytics retrieved successfully'));
});

// Get order analytics
const getOrderAnalytics = asyncHandler(async (req, res) => {
  const { period = 'month' } = req.query;
  
  const now = new Date();
  let start;
  
  switch (period) {
    case 'day':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'quarter':
      start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      break;
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  
  const [orderStats, statusBreakdown] = await Promise.all([
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: now }
        }
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$pricing.total' },
          averageOrderValue: { $avg: '$pricing.total' },
          completedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          }
        }
      }
    ]),
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: now }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ])
  ]);
  
  res.json(new ApiResponse(200, {
    period,
    summary: orderStats[0] || {},
    statusBreakdown
  }, 'Order analytics retrieved successfully'));
});

// Get revenue analytics
const getRevenueAnalytics = asyncHandler(async (req, res) => {
  const { period = 'month', breakdown } = req.query;
  
  const now = new Date();
  let start;
  
  switch (period) {
    case 'day':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'quarter':
      start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      break;
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  
  const revenueData = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: now },
        status: { $nin: ['cancelled', 'refunded'] }
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
        revenue: { $sum: '$pricing.total' },
        orders: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  
  let breakdownData = null;
  
  if (breakdown === 'category') {
    breakdownData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: now },
          status: { $nin: ['cancelled', 'refunded'] }
        }
      },
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
        $lookup: {
          from: 'categories',
          localField: 'product.category',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: '$category' },
      {
        $group: {
          _id: '$category.name',
          revenue: { $sum: '$items.total' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { revenue: -1 } }
    ]);
  }
  
  const totalRevenue = revenueData.reduce((sum, item) => sum + item.revenue, 0);
  
  res.json(new ApiResponse(200, {
    period,
    revenueData,
    breakdownData,
    totalRevenue
  }, 'Revenue analytics retrieved successfully'));
});

// Get inventory analytics
const getInventoryAnalytics = asyncHandler(async (req, res) => {
  const [inventoryStats, lowStockProducts, topCategories] = await Promise.all([
    Product.aggregate([
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          activeProducts: {
            $sum: { $cond: ['$isActive', 1, 0] }
          },
          totalStock: { $sum: '$stock' },
          lowStockCount: {
            $sum: {
              $cond: [
                { $lte: ['$stock', '$lowStockThreshold'] },
                1,
                0
              ]
            }
          },
          outOfStockCount: {
            $sum: {
              $cond: [
                { $eq: ['$stock', 0] },
                1,
                0
              ]
            }
          }
        }
      }
    ]),
    Product.find({
      $expr: { $lte: ['$stock', '$lowStockThreshold'] },
      isActive: true
    }).populate('category', 'name').limit(10),
    Product.aggregate([
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: '$category' },
      {
        $group: {
          _id: '$category.name',
          productCount: { $sum: 1 },
          totalStock: { $sum: '$stock' }
        }
      },
      { $sort: { productCount: -1 } },
      { $limit: 10 }
    ])
  ]);
  
  res.json(new ApiResponse(200, {
    summary: inventoryStats[0] || {},
    lowStockProducts,
    topCategories
  }, 'Inventory analytics retrieved successfully'));
});

// Get customer analytics
const getCustomerAnalytics = asyncHandler(async (req, res) => {
  const { period = 'month' } = req.query;
  
  const now = new Date();
  let start;
  
  switch (period) {
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'quarter':
      start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      break;
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  
  const [customerStats, topCustomers, customerSegments] = await Promise.all([
    User.aggregate([
      {
        $match: { role: 'customer' }
      },
      {
        $lookup: {
          from: 'orders',
          localField: '_id',
          foreignField: 'user',
          as: 'orders'
        }
      },
      {
        $addFields: {
          orderCount: { $size: '$orders' },
          totalSpent: {
            $sum: '$orders.pricing.total'
          }
        }
      },
      {
        $group: {
          _id: null,
          totalCustomers: { $sum: 1 },
          activeCustomers: {
            $sum: {
              $cond: [{ $gt: ['$orderCount', 0] }, 1, 0]
            }
          },
          averageOrdersPerCustomer: { $avg: '$orderCount' },
          averageSpentPerCustomer: { $avg: '$totalSpent' }
        }
      }
    ]),
    User.aggregate([
      {
        $match: { role: 'customer' }
      },
      {
        $lookup: {
          from: 'orders',
          localField: '_id',
          foreignField: 'user',
          as: 'orders'
        }
      },
      {
        $addFields: {
          totalSpent: {
            $sum: '$orders.pricing.total'
          }
        }
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 },
      {
        $project: {
          firstName: 1,
          lastName: 1,
          email: 1,
          totalSpent: 1,
          orderCount: { $size: '$orders' }
        }
      }
    ]),
    User.aggregate([
      {
        $match: { role: 'customer' }
      },
      {
        $lookup: {
          from: 'orders',
          localField: '_id',
          foreignField: 'user',
          as: 'orders'
        }
      },
      {
        $addFields: {
          orderCount: { $size: '$orders' },
          totalSpent: {
            $sum: '$orders.pricing.total'
          }
        }
      },
      {
        $bucket: {
          groupBy: '$totalSpent',
          boundaries: [0, 100, 500, 1000, 5000, Infinity],
          default: 'Other',
          output: {
            count: { $sum: 1 },
            averageSpent: { $avg: '$totalSpent' }
          }
        }
      }
    ])
  ]);
  
  res.json(new ApiResponse(200, {
    period,
    summary: customerStats[0] || {},
    topCustomers,
    customerSegments
  }, 'Customer analytics retrieved successfully'));
});

// Get traffic analytics (placeholder)
const getTrafficAnalytics = asyncHandler(async (req, res) => {
  // This would integrate with analytics services like Google Analytics
  const mockData = {
    pageViews: 15420,
    uniqueVisitors: 8930,
    bounceRate: 0.35,
    averageSessionDuration: 245,
    topPages: [
      { page: '/products', views: 5420 },
      { page: '/categories', views: 3210 },
      { page: '/cart', views: 2890 }
    ]
  };
  
  res.json(new ApiResponse(200, mockData, 'Traffic analytics retrieved successfully'));
});

// Get conversion analytics
const getConversionAnalytics = asyncHandler(async (req, res) => {
  const { period = 'month' } = req.query;
  
  const now = new Date();
  let start;
  
  switch (period) {
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'quarter':
      start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      break;
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  
  // Mock conversion funnel data
  const conversionData = {
    visitors: 10000,
    productViews: 7500,
    cartAdditions: 3200,
    checkoutInitiated: 1800,
    ordersCompleted: 1200,
    conversionRate: 0.12,
    cartAbandonmentRate: 0.44
  };
  
  res.json(new ApiResponse(200, {
    period,
    ...conversionData
  }, 'Conversion analytics retrieved successfully'));
});

// Export analytics report
const exportAnalyticsReport = asyncHandler(async (req, res) => {
  const { type, format = 'csv', period = 'month' } = req.query;
  
  // This would generate and return the requested report format
  // For now, return a success message
  
  res.json(new ApiResponse(200, {
    message: `${type} report in ${format} format will be generated and sent to your email`,
    type,
    format,
    period
  }, 'Report export initiated successfully'));
});

export {
  getSalesAnalytics,
  getProductAnalytics,
  getUserAnalytics,
  getOrderAnalytics,
  getRevenueAnalytics,
  getInventoryAnalytics,
  getCustomerAnalytics,
  getTrafficAnalytics,
  getConversionAnalytics,
  exportAnalyticsReport
};