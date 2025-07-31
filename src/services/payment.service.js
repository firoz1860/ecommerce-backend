import { createPaymentIntent, confirmPayment, constructEvent } from '../config/stripe.js';
import Order from '../models/Order.js';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';

class PaymentService {
  // Create payment intent
  async createPaymentIntent(order) {
    try {
      const paymentIntent = await createPaymentIntent(
        order.pricing.total,
        'usd',
        {
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          userId: order.user.toString()
        }
      );
      
      // Update order with payment intent ID
      order.payment.paymentIntentId = paymentIntent.id;
      order.payment.status = 'processing';
      await order.save();
      
      logger.info(`Payment intent created for order ${order.orderNumber}`);
      
      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      };
    } catch (error) {
      logger.error('Payment intent creation failed:', error);
      throw new ApiError(500, 'Payment setup failed');
    }
  }
  
  // Handle webhook events
  async handleWebhook(payload, signature) {
    try {
      const event = constructEvent(payload, signature);
      
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object);
          break;
          
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(event.data.object);
          break;
          
        case 'payment_intent.canceled':
          await this.handlePaymentCancellation(event.data.object);
          break;
          
        default:
          logger.info(`Unhandled event type: ${event.type}`);
      }
      
      return { received: true };
    } catch (error) {
      logger.error('Webhook handling failed:', error);
      throw new ApiError(400, 'Webhook signature verification failed');
    }
  }
  
  // Handle successful payment
  async handlePaymentSuccess(paymentIntent) {
    try {
      const order = await Order.findOne({
        'payment.paymentIntentId': paymentIntent.id
      });
      
      if (!order) {
        throw new Error(`Order not found for payment intent ${paymentIntent.id}`);
      }
      
      // Update order status
      order.payment.status = 'succeeded';
      order.payment.transactionId = paymentIntent.id;
      order.payment.paidAt = new Date();
      order.addStatusHistory('confirmed', 'Payment received successfully');
      
      await order.save();
      
      // Emit socket event for real-time updates
      const io = require('../server.js').io;
      if (io) {
        io.to(`order-${order._id}`).emit('orderStatusUpdate', {
          orderId: order._id,
          status: order.status,
          payment: order.payment
        });
      }
      
      logger.info(`Payment succeeded for order ${order.orderNumber}`);
      
      // Here you could trigger other services like inventory update, email notifications, etc.
      
    } catch (error) {
      logger.error('Payment success handling failed:', error);
    }
  }
  
  // Handle payment failure
  async handlePaymentFailure(paymentIntent) {
    try {
      const order = await Order.findOne({
        'payment.paymentIntentId': paymentIntent.id
      });
      
      if (!order) {
        throw new Error(`Order not found for payment intent ${paymentIntent.id}`);
      }
      
      // Update order status
      order.payment.status = 'failed';
      order.addStatusHistory('cancelled', 'Payment failed');
      
      await order.save();
      
      // Emit socket event
      const io = require('../server.js').io;
      if (io) {
        io.to(`order-${order._id}`).emit('orderStatusUpdate', {
          orderId: order._id,
          status: order.status,
          payment: order.payment
        });
      }
      
      logger.info(`Payment failed for order ${order.orderNumber}`);
      
    } catch (error) {
      logger.error('Payment failure handling failed:', error);
    }
  }
  
  // Handle payment cancellation
  async handlePaymentCancellation(paymentIntent) {
    try {
      const order = await Order.findOne({
        'payment.paymentIntentId': paymentIntent.id
      });
      
      if (!order) {
        throw new Error(`Order not found for payment intent ${paymentIntent.id}`);
      }
      
      // Update order status
      order.payment.status = 'cancelled';
      order.addStatusHistory('cancelled', 'Payment cancelled by user');
      
      await order.save();
      
      logger.info(`Payment cancelled for order ${order.orderNumber}`);
      
    } catch (error) {
      logger.error('Payment cancellation handling failed:', error);
    }
  }
  
  // Process refund
  async processRefund(orderId, amount, reason) {
    try {
      const order = await Order.findById(orderId);
      
      if (!order) {
        throw new ApiError(404, 'Order not found');
      }
      
      if (order.payment.status !== 'succeeded') {
        throw new ApiError(400, 'Cannot refund unpaid order');
      }
      
      // Create refund with Stripe
      const refund = await stripe.refunds.create({
        payment_intent: order.payment.paymentIntentId,
        amount: Math.round(amount * 100), // Convert to cents
        reason: 'requested_by_customer'
      });
      
      // Update order
      order.payment.status = 'refunded';
      order.refundAmount = amount;
      order.refundReason = reason;
      order.payment.refundedAt = new Date();
      order.addStatusHistory('refunded', `Refund processed: $${amount}`);
      
      await order.save();
      
      logger.info(`Refund processed for order ${order.orderNumber}: $${amount}`);
      
      return refund;
    } catch (error) {
      logger.error('Refund processing failed:', error);
      throw new ApiError(500, 'Refund processing failed');
    }
  }
}

export default new PaymentService();