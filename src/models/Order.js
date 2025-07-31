import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  variant: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  // Snapshot of product details at time of order
  productSnapshot: {
    name: String,
    sku: String,
    image: String
  }
});

const shippingAddressSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true },
  country: { type: String, required: true, default: 'USA' },
  phone: String
});

const orderSchema = new mongoose.Schema({
  orderNumber: {
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
  items: [orderItemSchema],
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'],
    index: true,
    default: 'pending'
  },
  statusHistory: [{
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'refunded']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  shippingAddress: {
    type: shippingAddressSchema,
    required: true
  },
  billingAddress: shippingAddressSchema,
  payment: {
    method: {
      type: String,
      enum: ['stripe', 'paypal', 'cash_on_delivery'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded'],
      default: 'pending'
    },
    transactionId: String,
    paymentIntentId: String,
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: 'USD'
    },
    paidAt: Date,
    refundedAt: Date
  },
  pricing: {
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    shipping: {
      type: Number,
      default: 0,
      min: 0
    },
    tax: {
      type: Number,
      default: 0,
      min: 0
    },
    discount: {
      type: Number,
      default: 0,
      min: 0
    },
    total: {
      type: Number,
      required: true,
      min: 0
    }
  },
  shipping: {
    method: {
      type: String,
      enum: ['standard', 'express', 'overnight', 'pickup'],
      default: 'standard'
    },
    cost: {
      type: Number,
      default: 0,
      min: 0
    },
    estimatedDelivery: Date,
    actualDelivery: Date,
    trackingNumber: String,
    carrier: String
  },
  coupon: {
    code: String,
    discount: Number,
    type: {
      type: String,
      enum: ['percentage', 'fixed']
    }
  },
  notes: String,
  internalNotes: String,
  estimatedDelivery: Date,
  actualDelivery: Date,
  cancelledAt: Date,
  cancelReason: String,
  refundAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  refundReason: String
}, {
  timestamps: true
});

// Pre-save middleware to generate order number
orderSchema.pre('save', async function(next) {
  if (this.isNew) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Get count of orders today
    const startOfDay = new Date(year, date.getMonth(), date.getDate());
    const endOfDay = new Date(year, date.getMonth(), date.getDate() + 1);
    
    const count = await this.constructor.countDocuments({
      createdAt: { $gte: startOfDay, $lt: endOfDay }
    });
    
    this.orderNumber = `ORD-${year}${month}${day}-${String(count + 1).padStart(4, '0')}`;
  }
  
  next();
});

// Method to add status to history
orderSchema.methods.addStatusHistory = function(status, note = '', updatedBy = null) {
  this.statusHistory.push({
    status,
    note,
    updatedBy,
    timestamp: new Date()
  });
  this.status = status;
};

// Method to calculate totals
orderSchema.methods.calculateTotals = function() {
  this.pricing.subtotal = this.items.reduce((sum, item) => sum + item.total, 0);
  this.pricing.total = this.pricing.subtotal + this.pricing.shipping + this.pricing.tax - this.pricing.discount;
};

// Method to check if order can be cancelled
orderSchema.methods.canBeCancelled = function() {
  return ['pending', 'confirmed', 'processing'].includes(this.status);
};

// Method to check if order can be refunded
orderSchema.methods.canBeRefunded = function() {
  return ['delivered'].includes(this.status) && this.payment.status === 'succeeded';
};

// Method to get order summary
orderSchema.methods.getSummary = function() {
  return {
    orderNumber: this.orderNumber,
    status: this.status,
    total: this.pricing.total,
    itemsCount: this.items.length,
    createdAt: this.createdAt,
    estimatedDelivery: this.estimatedDelivery
  };
};

// Static method to get order statistics
orderSchema.statics.getStatistics = async function(startDate, endDate) {
  const pipeline = [
    {
      $match: {
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$pricing.total' },
        averageOrderValue: { $avg: '$pricing.total' },
        statusBreakdown: {
          $push: '$status'
        }
      }
    }
  ];
  
  const result = await this.aggregate(pipeline);
  return result[0] || {
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    statusBreakdown: []
  };
};

// Transform output
orderSchema.methods.toJSON = function() {
  const orderObject = this.toObject();
  delete orderObject.internalNotes;
  return orderObject;
};

const Order = mongoose.model('Order', orderSchema);

export default Order;


// import mongoose from 'mongoose';

// const orderItemSchema = new mongoose.Schema({
//   product: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Product',
//     required: true
//   },
//   variant: {
//     type: mongoose.Schema.Types.ObjectId,
//     required: false
//   },
//   quantity: {
//     type: Number,
//     required: true,
//     min: 1
//   },
//   price: {
//     type: Number,
//     required: true,
//     min: 0
//   },
//   total: {
//     type: Number,
//     required: true,
//     min: 0
//   },
//   // Snapshot of product details at time of order
//   productSnapshot: {
//     name: String,
//     sku: String,
//     image: String
//   }
// });

// const shippingAddressSchema = new mongoose.Schema({
//   firstName: { type: String, required: true },
//   lastName: { type: String, required: true },
//   street: { type: String, required: true },
//   city: { type: String, required: true },
//   state: { type: String, required: true },
//   zipCode: { type: String, required: true },
//   country: { type: String, required: true, default: 'USA' },
//   phone: String
// });

// const orderSchema = new mongoose.Schema({
//   orderNumber: {
//     type: String,
//     unique: true,
//     required: true
//   },
//   user: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   items: [orderItemSchema],
//   status: {
//     type: String,
//     enum: ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'],
//     default: 'pending'
//   },
//   statusHistory: [{
//     status: {
//       type: String,
//       enum: ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'refunded']
//     },
//     timestamp: {
//       type: Date,
//       default: Date.now
//     },
//     note: String,
//     updatedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     }
//   }],
//   shippingAddress: {
//     type: shippingAddressSchema,
//     required: true
//   },
//   billingAddress: shippingAddressSchema,
//   payment: {
//     method: {
//       type: String,
//       enum: ['stripe', 'paypal', 'cash_on_delivery'],
//       required: true
//     },
//     status: {
//       type: String,
//       enum: ['pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded'],
//       default: 'pending'
//     },
//     transactionId: String,
//     paymentIntentId: String,
//     amount: {
//       type: Number,
//       required: true,
//       min: 0
//     },
//     currency: {
//       type: String,
//       default: 'USD'
//     },
//     paidAt: Date,
//     refundedAt: Date
//   },
//   pricing: {
//     subtotal: {
//       type: Number,
//       required: true,
//       min: 0
//     },
//     shipping: {
//       type: Number,
//       default: 0,
//       min: 0
//     },
//     tax: {
//       type: Number,
//       default: 0,
//       min: 0
//     },
//     discount: {
//       type: Number,
//       default: 0,
//       min: 0
//     },
//     total: {
//       type: Number,
//       required: true,
//       min: 0
//     }
//   },
//   shipping: {
//     method: {
//       type: String,
//       enum: ['standard', 'express', 'overnight', 'pickup'],
//       default: 'standard'
//     },
//     cost: {
//       type: Number,
//       default: 0,
//       min: 0
//     },
//     estimatedDelivery: Date,
//     actualDelivery: Date,
//     trackingNumber: String,
//     carrier: String
//   },
//   coupon: {
//     code: String,
//     discount: Number,
//     type: {
//       type: String,
//       enum: ['percentage', 'fixed']
//     }
//   },
//   notes: String,
//   internalNotes: String,
//   estimatedDelivery: Date,
//   actualDelivery: Date,
//   cancelledAt: Date,
//   cancelReason: String,
//   refundAmount: {
//     type: Number,
//     default: 0,
//     min: 0
//   },
//   refundReason: String
// }, {
//   timestamps: true
// });

// // Indexes for efficient queries
// orderSchema.index({ user: 1, createdAt: -1 });
// orderSchema.index({ orderNumber: 1 });
// orderSchema.index({ status: 1 });
// orderSchema.index({ 'payment.status': 1 });
// orderSchema.index({ createdAt: -1 });

// // Pre-save middleware to generate order number
// orderSchema.pre('save', async function(next) {
//   if (this.isNew) {
//     const date = new Date();
//     const year = date.getFullYear();
//     const month = String(date.getMonth() + 1).padStart(2, '0');
//     const day = String(date.getDate()).padStart(2, '0');
    
//     // Get count of orders today
//     const startOfDay = new Date(year, date.getMonth(), date.getDate());
//     const endOfDay = new Date(year, date.getMonth(), date.getDate() + 1);
    
//     const count = await this.constructor.countDocuments({
//       createdAt: { $gte: startOfDay, $lt: endOfDay }
//     });
    
//     this.orderNumber = `ORD-${year}${month}${day}-${String(count + 1).padStart(4, '0')}`;
//   }
  
//   next();
// });

// // Method to add status to history
// orderSchema.methods.addStatusHistory = function(status, note = '', updatedBy = null) {
//   this.statusHistory.push({
//     status,
//     note,
//     updatedBy,
//     timestamp: new Date()
//   });
//   this.status = status;
// };

// // Method to calculate totals
// orderSchema.methods.calculateTotals = function() {
//   this.pricing.subtotal = this.items.reduce((sum, item) => sum + item.total, 0);
//   this.pricing.total = this.pricing.subtotal + this.pricing.shipping + this.pricing.tax - this.pricing.discount;
// };

// // Method to check if order can be cancelled
// orderSchema.methods.canBeCancelled = function() {
//   return ['pending', 'confirmed', 'processing'].includes(this.status);
// };

// // Method to check if order can be refunded
// orderSchema.methods.canBeRefunded = function() {
//   return ['delivered'].includes(this.status) && this.payment.status === 'succeeded';
// };

// // Method to get order summary
// orderSchema.methods.getSummary = function() {
//   return {
//     orderNumber: this.orderNumber,
//     status: this.status,
//     total: this.pricing.total,
//     itemsCount: this.items.length,
//     createdAt: this.createdAt,
//     estimatedDelivery: this.estimatedDelivery
//   };
// };

// // Static method to get order statistics
// orderSchema.statics.getStatistics = async function(startDate, endDate) {
//   const pipeline = [
//     {
//       $match: {
//         createdAt: {
//           $gte: startDate,
//           $lte: endDate
//         }
//       }
//     },
//     {
//       $group: {
//         _id: null,
//         totalOrders: { $sum: 1 },
//         totalRevenue: { $sum: '$pricing.total' },
//         averageOrderValue: { $avg: '$pricing.total' },
//         statusBreakdown: {
//           $push: '$status'
//         }
//       }
//     }
//   ];
  
//   const result = await this.aggregate(pipeline);
//   return result[0] || {
//     totalOrders: 0,
//     totalRevenue: 0,
//     averageOrderValue: 0,
//     statusBreakdown: []
//   };
// };

// // Transform output
// orderSchema.methods.toJSON = function() {
//   const orderObject = this.toObject();
//   delete orderObject.internalNotes;
//   return orderObject;
// };

// const Order = mongoose.model('Order', orderSchema);

// export default Order;