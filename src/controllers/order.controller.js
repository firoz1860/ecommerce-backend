import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import PaymentService from '../services/payment.service.js';
import EmailService from '../services/email.service.js';
import logger from '../utils/logger.js';

// Create new order
// const createOrder = asyncHandler(async (req, res) => {
//   const {
//     shippingAddress,
//     billingAddress,
//     paymentMethod,
//     shippingMethod = 'standard',
//     couponCode,
//     notes
//   } = req.body;
  
//   const userId = req.user.userId;
  
//   // Get user's cart
//   const cart = await Cart.findOne({ user: userId }).populate('items.product');
  
//   if (!cart || cart.isEmpty()) {
//     throw new ApiError(400, 'Cart is empty');
//   }
  
//   // Validate cart items
//   const validationErrors = await cart.validateItems();
//   if (validationErrors.length > 0) {
//     throw new ApiError(400, `Cart validation failed: ${validationErrors.join(', ')}`);
//   }
  
//   // Calculate shipping cost
//   const shippingCosts = {
//     standard: 5.99,
//     express: 12.99,
//     overnight: 24.99,
//     pickup: 0
//   };
  
//   const shippingCost = shippingCosts[shippingMethod] || 5.99;
  
//   // Calculate tax (8% for example)
//   const taxRate = 0.08;
//   const subtotal = cart.totalAmount;
//   const tax = subtotal * taxRate;
  
//   // Apply coupon discount (mock implementation)
//   let discount = 0;
//   if (couponCode) {
//     const mockCoupons = {
//       'SAVE10': { type: 'percentage', value: 10 },
//       'FLAT20': { type: 'fixed', value: 20 }
//     };
    
//     const coupon = mockCoupons[couponCode.toUpperCase()];
//     if (coupon) {
//       if (coupon.type === 'percentage') {
//         discount = (subtotal * coupon.value) / 100;
//       } else {
//         discount = coupon.value;
//       }
//     }
//   }
  
//   const total = subtotal + shippingCost + tax - discount;
  
//   // Create order
//   const orderData = {
//     user: userId,
//     items: cart.items.map(item => ({
//       product: item.product._id,
//       variant: item.variant,
//       quantity: item.quantity,
//       price: item.price,
//       total: item.price * item.quantity,
//       productSnapshot: {
//         name: item.product.name,
//         sku: item.product.sku,
//         image: item.product.images[0]?.url
//       }
//     })),
//     shippingAddress,
//     billingAddress: billingAddress || shippingAddress,
//     payment: {
//       method: paymentMethod,
//       amount: total
//     },
//     pricing: {
//       subtotal,
//       shipping: shippingCost,
//       tax,
//       discount,
//       total
//     },
//     shipping: {
//       method: shippingMethod,
//       cost: shippingCost,
//       estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
//     },
//     coupon: couponCode ? {
//       code: couponCode,
//       discount,
//       type: discount > 0 ? 'applied' : 'invalid'
//     } : undefined,
//     notes
//   };
  
//   const order = new Order(orderData);
  
//   // Add initial status to history
//   order.addStatusHistory('pending', 'Order created');
  
//   await order.save();
  
//   // Reserve stock for ordered items
//   for (const item of cart.items) {
//     await item.product.reserveStock(item.quantity);
//   }
  
//   // Clear cart
//   await cart.clearCart();
  
//   // Create payment intent if using Stripe
//   if (paymentMethod === 'stripe') {
//     try {
//       const paymentIntent = await PaymentService.createPaymentIntent(order);
//       order.payment.paymentIntentId = paymentIntent.paymentIntentId;
//       await order.save();
//     } catch (error) {
//       logger.error('Payment intent creation failed:', error);
//       throw new ApiError(500, 'Payment setup failed');
//     }
//   }
  
//   // Send order confirmation email
//   try {
//     const user = await User.findById(userId);
//     await EmailService.sendOrderConfirmation(order, user);
//   } catch (error) {
//     logger.error('Order confirmation email failed:', error);
//   }
  
//   // Emit socket event for real-time updates
//   if (global.socketHelpers) {
//     global.socketHelpers.emitOrderStatusUpdate(order._id, order.status, {
//       orderNumber: order.orderNumber,
//       total: order.pricing.total
//     });
//   }
  
//   logger.info(`Order created: ${order.orderNumber} for user ${userId}`);
  
//   res.status(201).json(new ApiResponse(201, order, 'Order created successfully'));
// });

const createOrder = asyncHandler(async (req, res) => {
  const {
    shippingAddress,
    billingAddress,
    paymentMethod,
    shippingMethod = 'standard',
    couponCode,
    notes
  } = req.body;

  const userId = req.user.userId;

  // Get user's cart
  const cart = await Cart.findOne({ user: userId }).populate('items.product');

  if (!cart || cart.isEmpty()) {
    throw new ApiError(400, 'Cart is empty');
  }

  // Validate cart items
  const validationErrors = await cart.validateItems();
  if (validationErrors.length > 0) {
    throw new ApiError(400, `Cart validation failed: ${validationErrors.join(', ')}`);
  }

  // Calculate shipping cost
  const shippingCosts = {
    standard: 5.99,
    express: 12.99,
    overnight: 24.99,
    pickup: 0
  };

  const shippingCost = shippingCosts[shippingMethod] || 5.99;

  // Calculate tax (8% for example)
  const taxRate = 0.08;
  const subtotal = cart.totalAmount;
  const tax = subtotal * taxRate;

  // Apply coupon discount (mock implementation)
  let discount = 0;
  let coupon = null;

  if (couponCode) {
    const mockCoupons = {
      'SAVE10': { type: 'percentage', value: 10 },
      'FLAT20': { type: 'fixed', value: 20 }
    };

    const appliedCoupon = mockCoupons[couponCode.toUpperCase()];
    if (appliedCoupon) {
      if (appliedCoupon.type === 'percentage') {
        discount = (subtotal * appliedCoupon.value) / 100;
      } else {
        discount = appliedCoupon.value;
      }
      coupon = {
        code: couponCode,
        discount,
        type: appliedCoupon.type
      };
    }
  }

  const total = subtotal + shippingCost + tax - discount;

  // Create order
  const order = new Order({
    user: userId,
    items: cart.items.map(item => ({
      product: item.product._id,
      variant: item.variant,
      quantity: item.quantity,
      price: item.price,
      total: item.price * item.quantity,
      productSnapshot: {
        name: item.product.name,
        sku: item.product.sku,
        image: item.product.images[0]?.url
      }
    })),
    shippingAddress,
    billingAddress: billingAddress || shippingAddress,
    payment: {
      method: paymentMethod,
      amount: total
    },
    pricing: {
      subtotal,
      shipping: shippingCost,
      tax,
      discount,
      total
    },
    shipping: {
      method: shippingMethod,
      cost: shippingCost,
      estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    },
    coupon,
    notes
  });

  // Add order number
  order.orderNumber = `ORD-${new Date().getFullYear()}${Date.now().toString().slice(-6)}`;

  // Add initial status to history
  order.addStatusHistory('pending', 'Order created');

  await order.save();

  // Reserve stock for ordered items
  for (const item of cart.items) {
    await item.product.reserveStock(item.quantity);
  }

  // Clear cart
  await cart.clearCart();

  // Create payment intent if using Stripe
  if (paymentMethod === 'stripe') {
    try {
      const paymentIntent = await PaymentService.createPaymentIntent(order);
      order.payment.paymentIntentId = paymentIntent.paymentIntentId;
      await order.save();
    } catch (error) {
      logger.error('Payment intent creation failed:', error);
      throw new ApiError(500, 'Payment setup failed');
    }
  }

  // Send order confirmation email
  try {
    const user = await User.findById(userId);
    await EmailService.sendOrderConfirmation(order, user);
  } catch (error) {
    logger.error('Order confirmation email failed:', error);
  }

  // Emit socket event for real-time updates
  if (global.socketHelpers) {
    global.socketHelpers.emitOrderStatusUpdate(order._id, order.status, {
      orderNumber: order.orderNumber,
      total: order.pricing.total
    });
  }

  logger.info(`Order created: ${order.orderNumber} for user ${userId}`);

  res.status(201).json(new ApiResponse(201, order, 'Order created successfully'));
});


// Get user orders
const getOrders = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status,
    startDate,
    endDate
  } = req.query;
  
  const query = { user: req.user.userId };
  
  if (status) query.status = status;
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  
  const orders = await Order.find(query)
    .populate('items.product', 'name images')
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

// Get single order
const getOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const order = await Order.findById(id)
    .populate('items.product', 'name images price')
    .populate('user', 'firstName lastName email');
  
  if (!order) {
    throw new ApiError(404, 'Order not found');
  }
  
  // Check if user owns this order or is admin
  if (order.user._id.toString() !== req.user.userId && req.user.role !== 'admin') {
    throw new ApiError(403, 'Access denied');
  }
  
  res.json(new ApiResponse(200, order, 'Order retrieved successfully'));
});

// Get order timeline
const getOrderTimeline = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const order = await Order.findById(id);
  
  if (!order) {
    throw new ApiError(404, 'Order not found');
  }
  
  // Check permissions
  if (order.user.toString() !== req.user.userId && req.user.role !== 'admin') {
    throw new ApiError(403, 'Access denied');
  }
  
  res.json(new ApiResponse(200, order.statusHistory, 'Order timeline retrieved successfully'));
});

// Track order
const trackOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const order = await Order.findById(id);
  
  if (!order) {
    throw new ApiError(404, 'Order not found');
  }
  
  // Check permissions
  if (order.user.toString() !== req.user.userId && req.user.role !== 'admin') {
    throw new ApiError(403, 'Access denied');
  }
  
  const trackingInfo = {
    orderNumber: order.orderNumber,
    status: order.status,
    trackingNumber: order.shipping.trackingNumber,
    carrier: order.shipping.carrier,
    estimatedDelivery: order.shipping.estimatedDelivery,
    actualDelivery: order.shipping.actualDelivery,
    statusHistory: order.statusHistory
  };
  
  res.json(new ApiResponse(200, trackingInfo, 'Order tracking information retrieved'));
});

// Get order invoice
const getOrderInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const order = await Order.findById(id)
    .populate('items.product', 'name sku')
    .populate('user', 'firstName lastName email');
  
  if (!order) {
    throw new ApiError(404, 'Order not found');
  }
  
  // Check permissions
  if (order.user._id.toString() !== req.user.userId && req.user.role !== 'admin') {
    throw new ApiError(403, 'Access denied');
  }
  
  // Generate invoice data
  const invoice = {
    orderNumber: order.orderNumber,
    orderDate: order.createdAt,
    customer: {
      name: order.user.fullName,
      email: order.user.email
    },
    billingAddress: order.billingAddress,
    shippingAddress: order.shippingAddress,
    items: order.items,
    pricing: order.pricing,
    payment: {
      method: order.payment.method,
      status: order.payment.status,
      paidAt: order.payment.paidAt
    }
  };
  
  res.json(new ApiResponse(200, invoice, 'Order invoice retrieved successfully'));
});

// Cancel order
const cancelOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  
  const order = await Order.findById(id).populate('items.product');
  
  if (!order) {
    throw new ApiError(404, 'Order not found');
  }
  
  // Check permissions
  if (order.user.toString() !== req.user.userId && req.user.role !== 'admin') {
    throw new ApiError(403, 'Access denied');
  }
  
  // Check if order can be cancelled
  if (!order.canBeCancelled()) {
    throw new ApiError(400, 'Order cannot be cancelled at this stage');
  }
  
  // Release reserved stock
  for (const item of order.items) {
    await item.product.releaseStock(item.quantity);
  }
  
  // Update order status
  order.addStatusHistory('cancelled', reason, req.user.userId);
  order.cancelledAt = new Date();
  order.cancelReason = reason;
  
  await order.save();
  
  // Emit socket event
  if (global.socketHelpers) {
    global.socketHelpers.emitOrderStatusUpdate(order._id, order.status, {
      reason
    });
  }
  
  logger.info(`Order cancelled: ${order.orderNumber} by user ${req.user.userId}`);
  
  res.json(new ApiResponse(200, order, 'Order cancelled successfully'));
});

// Request refund
const requestRefund = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason, amount, items } = req.body;
  
  const order = await Order.findById(id);
  
  if (!order) {
    throw new ApiError(404, 'Order not found');
  }
  
  // Check permissions
  if (order.user.toString() !== req.user.userId) {
    throw new ApiError(403, 'Access denied');
  }
  
  // Check if order can be refunded
  if (!order.canBeRefunded()) {
    throw new ApiError(400, 'Order is not eligible for refund');
  }
  
  const refundAmount = amount || order.pricing.total;
  
  // Process refund through payment service
  try {
    await PaymentService.processRefund(order._id, refundAmount, reason);
    
    order.addStatusHistory('refunded', `Refund processed: $${refundAmount}`, req.user.userId);
    order.refundAmount = refundAmount;
    order.refundReason = reason;
    
    await order.save();
    
    logger.info(`Refund requested for order: ${order.orderNumber}`);
    
    res.json(new ApiResponse(200, order, 'Refund request submitted successfully'));
  } catch (error) {
    throw new ApiError(500, 'Refund processing failed');
  }
});

// Rate order
const rateOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rating, comment, deliveryRating } = req.body;
  
  const order = await Order.findById(id);
  
  if (!order) {
    throw new ApiError(404, 'Order not found');
  }
  
  // Check permissions
  if (order.user.toString() !== req.user.userId) {
    throw new ApiError(403, 'Access denied');
  }
  
  // Check if order is delivered
  if (order.status !== 'delivered') {
    throw new ApiError(400, 'Order must be delivered to rate');
  }
  
  // Add rating to order (this would be stored in order model in real implementation)
  order.rating = {
    rating,
    comment,
    deliveryRating,
    ratedAt: new Date()
  };
  
  await order.save();
  
  logger.info(`Order rated: ${order.orderNumber} by user ${req.user.userId}`);
  
  res.json(new ApiResponse(200, null, 'Order rated successfully'));
});

// Reorder items
const reorderItems = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const order = await Order.findById(id).populate('items.product');
  
  if (!order) {
    throw new ApiError(404, 'Order not found');
  }
  
  // Check permissions
  if (order.user.toString() !== req.user.userId) {
    throw new ApiError(403, 'Access denied');
  }
  
  // Get or create cart
  const cart = await Cart.getOrCreateCart(req.user.userId);
  
  // Add available items to cart
  const addedItems = [];
  const unavailableItems = [];
  
  for (const item of order.items) {
    if (item.product && item.product.isActive && item.product.stock > 0) {
      const price = item.product.salePrice && item.product.salePrice < item.product.price
        ? item.product.salePrice
        : item.product.price;
      
      const quantityToAdd = Math.min(item.quantity, item.product.stock);
      await cart.addItem(item.product._id, quantityToAdd, price);
      addedItems.push({
        product: item.product.name,
        quantity: quantityToAdd
      });
    } else {
      unavailableItems.push(item.productSnapshot.name);
    }
  }
  
  logger.info(`Reorder processed for order: ${order.orderNumber}`);
  
  res.json(new ApiResponse(200, {
    addedItems,
    unavailableItems,
    message: `${addedItems.length} items added to cart`
  }, 'Reorder processed successfully'));
});

// Update order status (Admin only)
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, note, trackingNumber, carrier } = req.body;
  
  const order = await Order.findById(id).populate('user', 'firstName lastName email');
  
  if (!order) {
    throw new ApiError(404, 'Order not found');
  }
  
  // Update order status
  order.addStatusHistory(status, note, req.user.userId);
  
  // Update shipping info if provided
  if (trackingNumber) order.shipping.trackingNumber = trackingNumber;
  if (carrier) order.shipping.carrier = carrier;
  
  // Set delivery date if status is delivered
  if (status === 'delivered') {
    order.shipping.actualDelivery = new Date();
  }
  
  await order.save();
  
  // Send status update email
  try {
    await EmailService.sendOrderStatusUpdate(order, order.user);
  } catch (error) {
    logger.error('Status update email failed:', error);
  }
  
  // Emit socket event
  if (global.socketHelpers) {
    global.socketHelpers.emitOrderStatusUpdate(order._id, order.status, {
      note,
      trackingNumber,
      carrier
    });
  }
  
  logger.info(`Order status updated: ${order.orderNumber} to ${status}`);
  
  res.json(new ApiResponse(200, order, 'Order status updated successfully'));
});

// Process payment
const processPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const order = await Order.findById(id);
  
  if (!order) {
    throw new ApiError(404, 'Order not found');
  }
  
  // Check permissions
  if (order.user.toString() !== req.user.userId) {
    throw new ApiError(403, 'Access denied');
  }
  
  if (order.payment.method === 'stripe') {
    try {
      const paymentIntent = await PaymentService.createPaymentIntent(order);
      
      res.json(new ApiResponse(200, {
        clientSecret: paymentIntent.clientSecret,
        paymentIntentId: paymentIntent.paymentIntentId
      }, 'Payment intent created successfully'));
    } catch (error) {
      throw new ApiError(500, 'Payment processing failed');
    }
  } else {
    throw new ApiError(400, 'Invalid payment method');
  }
});

// Handle payment webhook
const handlePaymentWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['stripe-signature'];
  
  try {
    await PaymentService.handleWebhook(req.body, signature);
    res.json({ received: true });
  } catch (error) {
    logger.error('Webhook handling failed:', error);
    throw new ApiError(400, 'Webhook signature verification failed');
  }
});

// Update shipping address
const updateShippingAddress = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const order = await Order.findById(id);
  
  if (!order) {
    throw new ApiError(404, 'Order not found');
  }
  
  // Check permissions and order status
  if (order.user.toString() !== req.user.userId) {
    throw new ApiError(403, 'Access denied');
  }
  
  if (!['pending', 'confirmed'].includes(order.status)) {
    throw new ApiError(400, 'Cannot update shipping address after order is processed');
  }
  
  // Update shipping address
  Object.keys(updates).forEach(key => {
    if (updates[key] !== undefined) {
      order.shippingAddress[key] = updates[key];
    }
  });
  
  await order.save();
  
  logger.info(`Shipping address updated for order: ${order.orderNumber}`);
  
  res.json(new ApiResponse(200, order.shippingAddress, 'Shipping address updated successfully'));
});

// Add order note (Admin only)
const addOrderNote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { note, isInternal = false } = req.body;
  
  const order = await Order.findById(id);
  
  if (!order) {
    throw new ApiError(404, 'Order not found');
  }
  
  if (isInternal) {
    order.internalNotes = (order.internalNotes || '') + `\n[${new Date().toISOString()}] ${note}`;
  } else {
    order.notes = (order.notes || '') + `\n[${new Date().toISOString()}] ${note}`;
  }
  
  await order.save();
  
  logger.info(`Note added to order: ${order.orderNumber}`);
  
  res.json(new ApiResponse(200, null, 'Note added successfully'));
});

// Get order analytics (Admin only)
const getOrderAnalytics = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();
  
  const analytics = await Order.getStatistics(start, end);
  
  res.json(new ApiResponse(200, analytics, 'Order analytics retrieved successfully'));
});

export {
  createOrder,
  getOrders,
  getOrder,
  updateOrderStatus,
  cancelOrder,
  trackOrder,
  getOrderInvoice,
  requestRefund,
  rateOrder,
  reorderItems,
  getOrderAnalytics,
  processPayment,
  handlePaymentWebhook,
  updateShippingAddress,
  addOrderNote,
  getOrderTimeline
};