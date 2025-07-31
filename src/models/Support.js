import mongoose from 'mongoose';

const supportTicketSchema = new mongoose.Schema({
  ticketNumber: {
    type: String,
    unique: true,
    index: true,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    required: true
  },
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  category: {
    type: String,
    enum: ['order', 'product', 'payment', 'shipping', 'account', 'technical', 'other'],
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    index: true,
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'],
    index: true,
    default: 'open'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  relatedOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  relatedProduct: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  messages: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    isInternal: {
      type: Boolean,
      default: false
    },
    attachments: [{
      url: String,
      filename: String,
      fileType: String,
      fileSize: Number
    }],
    sentAt: {
      type: Date,
      default: Date.now
    }
  }],
  tags: [{
    type: String,
    trim: true
  }],
  resolution: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  resolvedAt: Date,
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  closedAt: Date,
  closedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  customerSatisfaction: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: String,
    ratedAt: Date
  },
  escalated: {
    type: Boolean,
    default: false
  },
  escalatedAt: Date,
  escalatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  escalationReason: String
}, {
  timestamps: true
});

// Pre-save middleware to generate ticket number
supportTicketSchema.pre('save', async function(next) {
  if (this.isNew) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const count = await this.constructor.countDocuments({
      createdAt: { 
        $gte: new Date(year, date.getMonth(), date.getDate()),
        $lt: new Date(year, date.getMonth(), date.getDate() + 1)
      }
    });
    
    this.ticketNumber = `TKT-${year}${month}${day}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Method to add message
supportTicketSchema.methods.addMessage = function(senderId, message, isInternal = false, attachments = []) {
  this.messages.push({
    sender: senderId,
    message,
    isInternal,
    attachments
  });
  
  // Update status if customer responds
  if (this.status === 'waiting_customer' && !isInternal) {
    this.status = 'in_progress';
  }
  
  return this.save();
};

// Method to resolve ticket
supportTicketSchema.methods.resolve = function(resolvedBy, resolution) {
  this.status = 'resolved';
  this.resolution = resolution;
  this.resolvedAt = new Date();
  this.resolvedBy = resolvedBy;
  return this.save();
};

// Method to close ticket
supportTicketSchema.methods.close = function(closedBy) {
  this.status = 'closed';
  this.closedAt = new Date();
  this.closedBy = closedBy;
  return this.save();
};

// Method to escalate ticket
supportTicketSchema.methods.escalate = function(escalatedBy, reason) {
  this.escalated = true;
  this.escalatedAt = new Date();
  this.escalatedBy = escalatedBy;
  this.escalationReason = reason;
  this.priority = 'urgent';
  return this.save();
};

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);

export default SupportTicket;

// import mongoose from 'mongoose';

// const supportTicketSchema = new mongoose.Schema({
//   ticketNumber: {
//     type: String,
//     unique: true,
//     required: true
//   },
//   user: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   subject: {
//     type: String,
//     required: true,
//     trim: true,
//     maxlength: 200
//   },
//   description: {
//     type: String,
//     required: true,
//     trim: true,
//     maxlength: 2000
//   },
//   category: {
//     type: String,
//     enum: ['order', 'product', 'payment', 'shipping', 'account', 'technical', 'other'],
//     required: true
//   },
//   priority: {
//     type: String,
//     enum: ['low', 'medium', 'high', 'urgent'],
//     default: 'medium'
//   },
//   status: {
//     type: String,
//     enum: ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'],
//     default: 'open'
//   },
//   assignedTo: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   },
//   relatedOrder: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Order'
//   },
//   relatedProduct: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Product'
//   },
//   messages: [{
//     sender: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//       required: true
//     },
//     message: {
//       type: String,
//       required: true,
//       trim: true,
//       maxlength: 2000
//     },
//     isInternal: {
//       type: Boolean,
//       default: false
//     },
//     attachments: [{
//       url: String,
//       filename: String,
//       fileType: String,
//       fileSize: Number
//     }],
//     sentAt: {
//       type: Date,
//       default: Date.now
//     }
//   }],
//   tags: [{
//     type: String,
//     trim: true
//   }],
//   resolution: {
//     type: String,
//     trim: true,
//     maxlength: 1000
//   },
//   resolvedAt: Date,
//   resolvedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   },
//   closedAt: Date,
//   closedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   },
//   customerSatisfaction: {
//     rating: {
//       type: Number,
//       min: 1,
//       max: 5
//     },
//     feedback: String,
//     ratedAt: Date
//   },
//   escalated: {
//     type: Boolean,
//     default: false
//   },
//   escalatedAt: Date,
//   escalatedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   },
//   escalationReason: String
// }, {
//   timestamps: true
// });

// // Indexes
// supportTicketSchema.index({ ticketNumber: 1 });
// supportTicketSchema.index({ user: 1, createdAt: -1 });
// supportTicketSchema.index({ status: 1, priority: 1 });
// supportTicketSchema.index({ assignedTo: 1, status: 1 });
// supportTicketSchema.index({ category: 1 });

// // Pre-save middleware to generate ticket number
// supportTicketSchema.pre('save', async function(next) {
//   if (this.isNew) {
//     const date = new Date();
//     const year = date.getFullYear();
//     const month = String(date.getMonth() + 1).padStart(2, '0');
//     const day = String(date.getDate()).padStart(2, '0');
    
//     const count = await this.constructor.countDocuments({
//       createdAt: { 
//         $gte: new Date(year, date.getMonth(), date.getDate()),
//         $lt: new Date(year, date.getMonth(), date.getDate() + 1)
//       }
//     });
    
//     this.ticketNumber = `TKT-${year}${month}${day}-${String(count + 1).padStart(4, '0')}`;
//   }
//   next();
// });

// // Method to add message
// supportTicketSchema.methods.addMessage = function(senderId, message, isInternal = false, attachments = []) {
//   this.messages.push({
//     sender: senderId,
//     message,
//     isInternal,
//     attachments
//   });
  
//   // Update status if customer responds
//   if (this.status === 'waiting_customer' && !isInternal) {
//     this.status = 'in_progress';
//   }
  
//   return this.save();
// };

// // Method to resolve ticket
// supportTicketSchema.methods.resolve = function(resolvedBy, resolution) {
//   this.status = 'resolved';
//   this.resolution = resolution;
//   this.resolvedAt = new Date();
//   this.resolvedBy = resolvedBy;
//   return this.save();
// };

// // Method to close ticket
// supportTicketSchema.methods.close = function(closedBy) {
//   this.status = 'closed';
//   this.closedAt = new Date();
//   this.closedBy = closedBy;
//   return this.save();
// };

// // Method to escalate ticket
// supportTicketSchema.methods.escalate = function(escalatedBy, reason) {
//   this.escalated = true;
//   this.escalatedAt = new Date();
//   this.escalatedBy = escalatedBy;
//   this.escalationReason = reason;
//   this.priority = 'urgent';
//   return this.save();
// };

// const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);

// export default SupportTicket;