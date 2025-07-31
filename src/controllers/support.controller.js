import SupportTicket from '../models/Support.js';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { uploadImage } from '../config/cloudinary.js';
import EmailService from '../services/email.service.js';
import logger from '../utils/logger.js';

// Create support ticket
const createSupportTicket = asyncHandler(async (req, res) => {
  const {
    subject,
    description,
    category,
    priority = 'medium',
    relatedOrder,
    relatedProduct
  } = req.body;
  
  const ticketData = {
    user: req.user.userId,
    subject,
    description,
    category,
    priority,
    relatedOrder,
    relatedProduct
  };
  
  const ticket = new SupportTicket(ticketData);
  await ticket.save();
  
  // Add initial message
  await ticket.addMessage(req.user.userId, description);
  
  // Send notification to admins
  try {
    const user = await User.findById(req.user.userId);
    await EmailService.sendEmail({
      to: process.env.SUPPORT_EMAIL || 'support@example.com',
      subject: `New Support Ticket: ${ticket.ticketNumber}`,
      template: 'support-ticket-created',
      data: {
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        category: ticket.category,
        priority: ticket.priority,
        customerName: user.fullName,
        customerEmail: user.email
      }
    });
  } catch (error) {
    logger.error('Failed to send support ticket notification:', error);
  }
  
  logger.info(`Support ticket created: ${ticket.ticketNumber} by user ${req.user.userId}`);
  
  res.status(201).json(new ApiResponse(201, ticket, 'Support ticket created successfully'));
});

// Get user's support tickets
const getUserTickets = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status,
    category
  } = req.query;
  
  const query = { user: req.user.userId };
  
  if (status) query.status = status;
  if (category) query.category = category;
  
  const tickets = await SupportTicket.find(query)
    .populate('assignedTo', 'firstName lastName')
    .populate('relatedOrder', 'orderNumber')
    .populate('relatedProduct', 'name')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);
  
  const total = await SupportTicket.countDocuments(query);
  
  res.json(new ApiResponse(200, {
    tickets,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  }, 'Support tickets retrieved successfully'));
});

// Get single support ticket
const getSupportTicket = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const ticket = await SupportTicket.findById(id)
    .populate('user', 'firstName lastName email avatar')
    .populate('assignedTo', 'firstName lastName')
    .populate('relatedOrder', 'orderNumber status')
    .populate('relatedProduct', 'name images')
    .populate('messages.sender', 'firstName lastName avatar role')
    .populate('resolvedBy', 'firstName lastName')
    .populate('closedBy', 'firstName lastName');
  
  if (!ticket) {
    throw new ApiError(404, 'Support ticket not found');
  }
  
  // Check permissions
  if (ticket.user._id.toString() !== req.user.userId && req.user.role !== 'admin') {
    throw new ApiError(403, 'Access denied');
  }
  
  res.json(new ApiResponse(200, ticket, 'Support ticket retrieved successfully'));
});

// Add message to support ticket
const addTicketMessage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { message, isInternal = false } = req.body;
  
  const ticket = await SupportTicket.findById(id);
  if (!ticket) {
    throw new ApiError(404, 'Support ticket not found');
  }
  
  // Check permissions
  if (ticket.user.toString() !== req.user.userId && req.user.role !== 'admin') {
    throw new ApiError(403, 'Access denied');
  }
  
  // Only admins can send internal messages
  if (isInternal && req.user.role !== 'admin') {
    throw new ApiError(403, 'Only admins can send internal messages');
  }
  
  // Handle file attachments if any
  let attachments = [];
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      const result = await uploadImage(file.path, 'support');
      attachments.push({
        url: result.url,
        filename: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size
      });
    }
  }
  
  await ticket.addMessage(req.user.userId, message, isInternal, attachments);
  
  // Emit real-time update
  if (global.socketHelpers) {
    global.socketHelpers.emitSupportMessage(ticket._id, {
      sender: req.user.userId,
      message,
      isInternal,
      attachments,
      timestamp: new Date()
    });
  }
  
  logger.info(`Message added to ticket ${ticket.ticketNumber} by user ${req.user.userId}`);
  
  res.json(new ApiResponse(200, null, 'Message added successfully'));
});

// Update support ticket
const updateSupportTicket = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const ticket = await SupportTicket.findById(id);
  if (!ticket) {
    throw new ApiError(404, 'Support ticket not found');
  }
  
  // Check permissions
  if (req.user.role !== 'admin') {
    throw new ApiError(403, 'Only admins can update tickets');
  }
  
  Object.keys(updates).forEach(key => {
    if (updates[key] !== undefined) {
      ticket[key] = updates[key];
    }
  });
  
  await ticket.save();
  
  logger.info(`Support ticket updated: ${ticket.ticketNumber} by user ${req.user.userId}`);
  
  res.json(new ApiResponse(200, ticket, 'Support ticket updated successfully'));
});

// Resolve support ticket
const resolveSupportTicket = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { resolution } = req.body;
  
  const ticket = await SupportTicket.findById(id);
  if (!ticket) {
    throw new ApiError(404, 'Support ticket not found');
  }
  
  // Check permissions
  if (req.user.role !== 'admin') {
    throw new ApiError(403, 'Only admins can resolve tickets');
  }
  
  await ticket.resolve(req.user.userId, resolution);
  
  // Send resolution email to customer
  try {
    const user = await User.findById(ticket.user);
    await EmailService.sendEmail({
      to: user.email,
      subject: `Ticket Resolved: ${ticket.ticketNumber}`,
      template: 'support-ticket-resolved',
      data: {
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        resolution,
        customerName: user.fullName
      }
    });
  } catch (error) {
    logger.error('Failed to send ticket resolution email:', error);
  }
  
  logger.info(`Support ticket resolved: ${ticket.ticketNumber} by user ${req.user.userId}`);
  
  res.json(new ApiResponse(200, ticket, 'Support ticket resolved successfully'));
});

// Close support ticket
const closeSupportTicket = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const ticket = await SupportTicket.findById(id);
  if (!ticket) {
    throw new ApiError(404, 'Support ticket not found');
  }
  
  // Check permissions
  if (ticket.user.toString() !== req.user.userId && req.user.role !== 'admin') {
    throw new ApiError(403, 'Access denied');
  }
  
  await ticket.close(req.user.userId);
  
  logger.info(`Support ticket closed: ${ticket.ticketNumber} by user ${req.user.userId}`);
  
  res.json(new ApiResponse(200, ticket, 'Support ticket closed successfully'));
});

// Escalate support ticket (Admin)
const escalateSupportTicket = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  
  const ticket = await SupportTicket.findById(id);
  if (!ticket) {
    throw new ApiError(404, 'Support ticket not found');
  }
  
  await ticket.escalate(req.user.userId, reason);
  
  logger.info(`Support ticket escalated: ${ticket.ticketNumber} by user ${req.user.userId}`);
  
  res.json(new ApiResponse(200, ticket, 'Support ticket escalated successfully'));
});

// Rate support ticket resolution
const rateSupportTicket = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rating, feedback } = req.body;
  
  const ticket = await SupportTicket.findById(id);
  if (!ticket) {
    throw new ApiError(404, 'Support ticket not found');
  }
  
  // Check permissions
  if (ticket.user.toString() !== req.user.userId) {
    throw new ApiError(403, 'You can only rate your own tickets');
  }
  
  if (ticket.status !== 'resolved') {
    throw new ApiError(400, 'Can only rate resolved tickets');
  }
  
  ticket.customerSatisfaction = {
    rating,
    feedback,
    ratedAt: new Date()
  };
  
  await ticket.save();
  
  logger.info(`Support ticket rated: ${ticket.ticketNumber} by user ${req.user.userId}`);
  
  res.json(new ApiResponse(200, null, 'Support ticket rated successfully'));
});

// Get all support tickets (Admin)
const getAllSupportTickets = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    priority,
    category,
    assignedTo,
    search
  } = req.query;
  
  const query = {};
  
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (category) query.category = category;
  if (assignedTo) query.assignedTo = assignedTo;
  
  if (search) {
    query.$or = [
      { ticketNumber: { $regex: search, $options: 'i' } },
      { subject: { $regex: search, $options: 'i' } }
    ];
  }
  
  const tickets = await SupportTicket.find(query)
    .populate('user', 'firstName lastName email')
    .populate('assignedTo', 'firstName lastName')
    .sort({ priority: -1, createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);
  
  const total = await SupportTicket.countDocuments(query);
  
  res.json(new ApiResponse(200, {
    tickets,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  }, 'Support tickets retrieved successfully'));
});

// Get support statistics (Admin)
const getSupportStats = asyncHandler(async (req, res) => {
  const stats = await SupportTicket.aggregate([
    {
      $group: {
        _id: null,
        totalTickets: { $sum: 1 },
        openTickets: {
          $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] }
        },
        inProgressTickets: {
          $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
        },
        resolvedTickets: {
          $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
        },
        closedTickets: {
          $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] }
        },
        averageRating: {
          $avg: '$customerSatisfaction.rating'
        }
      }
    }
  ]);
  
  const categoryStats = await SupportTicket.aggregate([
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const priorityStats = await SupportTicket.aggregate([
    {
      $group: {
        _id: '$priority',
        count: { $sum: 1 }
      }
    }
  ]);
  
  res.json(new ApiResponse(200, {
    overview: stats[0] || {},
    categoryBreakdown: categoryStats,
    priorityBreakdown: priorityStats
  }, 'Support statistics retrieved successfully'));
});

export {
  createSupportTicket,
  getUserTickets,
  getSupportTicket,
  addTicketMessage,
  updateSupportTicket,
  resolveSupportTicket,
  closeSupportTicket,
  escalateSupportTicket,
  rateSupportTicket,
  getAllSupportTickets,
  getSupportStats
};