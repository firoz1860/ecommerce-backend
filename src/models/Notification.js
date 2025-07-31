import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  type: {
    type: String,
    enum: ['order', 'payment', 'shipping', 'product', 'promotion', 'system', 'support'],
    index: true,
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  isRead: {
    type: Boolean,
    index: true,
    default: false
  },
  readAt: Date,
  data: {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    supportTicketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SupportTicket'
    },
    url: String,
    actionRequired: Boolean
  },
  channels: [{
    type: String,
    enum: ['in_app', 'email', 'sms', 'push']
  }],
  sentChannels: [{
    channel: {
      type: String,
      enum: ['in_app', 'email', 'sms', 'push']
    },
    sentAt: Date,
    status: {
      type: String,
      enum: ['sent', 'delivered', 'failed']
    },
    error: String
  }],
  scheduledFor: Date,
  expiresAt: Date
}, {
  timestamps: true
});

// Method to mark as read
notificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

// Static method to create notification
notificationSchema.statics.createNotification = async function(data) {
  const notification = new this(data);
  await notification.save();
  
  // Emit real-time notification if socket helpers available
  if (global.socketHelpers) {
    global.socketHelpers.emitNotification(data.user, notification);
  }
  
  return notification;
};

// Static method to mark all as read for user
notificationSchema.statics.markAllAsRead = async function(userId) {
  return this.updateMany(
    { user: userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
};

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;


// import mongoose from 'mongoose';

// const notificationSchema = new mongoose.Schema({
//   user: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   title: {
//     type: String,
//     required: true,
//     trim: true,
//     maxlength: 100
//   },
//   message: {
//     type: String,
//     required: true,
//     trim: true,
//     maxlength: 500
//   },
//   type: {
//     type: String,
//     enum: ['order', 'payment', 'shipping', 'product', 'promotion', 'system', 'support'],
//     required: true
//   },
//   priority: {
//     type: String,
//     enum: ['low', 'medium', 'high'],
//     default: 'medium'
//   },
//   isRead: {
//     type: Boolean,
//     default: false
//   },
//   readAt: Date,
//   data: {
//     orderId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'Order'
//     },
//     productId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'Product'
//     },
//     supportTicketId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'SupportTicket'
//     },
//     url: String,
//     actionRequired: Boolean
//   },
//   channels: [{
//     type: String,
//     enum: ['in_app', 'email', 'sms', 'push']
//   }],
//   sentChannels: [{
//     channel: {
//       type: String,
//       enum: ['in_app', 'email', 'sms', 'push']
//     },
//     sentAt: Date,
//     status: {
//       type: String,
//       enum: ['sent', 'delivered', 'failed']
//     },
//     error: String
//   }],
//   scheduledFor: Date,
//   expiresAt: Date
// }, {
//   timestamps: true
// });

// // Indexes
// notificationSchema.index({ user: 1, createdAt: -1 });
// notificationSchema.index({ user: 1, isRead: 1 });
// notificationSchema.index({ type: 1 });
// notificationSchema.index({ scheduledFor: 1 });
// notificationSchema.index({ expiresAt: 1 });

// // Method to mark as read
// notificationSchema.methods.markAsRead = function() {
//   this.isRead = true;
//   this.readAt = new Date();
//   return this.save();
// };

// // Static method to create notification
// notificationSchema.statics.createNotification = async function(data) {
//   const notification = new this(data);
//   await notification.save();
  
//   // Emit real-time notification if socket helpers available
//   if (global.socketHelpers) {
//     global.socketHelpers.emitNotification(data.user, notification);
//   }
  
//   return notification;
// };

// // Static method to mark all as read for user
// notificationSchema.statics.markAllAsRead = async function(userId) {
//   return this.updateMany(
//     { user: userId, isRead: false },
//     { isRead: true, readAt: new Date() }
//   );
// };

// const Notification = mongoose.model('Notification', notificationSchema);

// export default Notification;