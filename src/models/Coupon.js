import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    index: true,
    uppercase: true,
    trim: true,
    maxlength: 20
  },
  description: {
    type: String,
    trim: true,
    maxlength: 200
  },
  type: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  value: {
    type: Number,
    required: true,
    min: 0
  },
  minAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  maxAmount: {
    type: Number,
    min: 0
  },
  maxUses: {
    type: Number,
    default: null
  },
  usedCount: {
    type: Number,
    default: 0,
    min: 0
  },
  usedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    usedAt: {
      type: Date,
      default: Date.now
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    }
  }],
  isActive: {
    type: Boolean,
    index: true,
    default: true
  },
  startsAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    index: true,
    required: true
  },
  applicableCategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  applicableProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  excludeCategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  excludeProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  userRestrictions: {
    newUsersOnly: {
      type: Boolean,
      default: false
    },
    specificUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    userRoles: [{
      type: String,
      enum: ['customer', 'premium']
    }]
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Virtual for checking if coupon is expired
couponSchema.virtual('isExpired').get(function() {
  return this.expiresAt < new Date();
});

// Virtual for checking if coupon is valid
couponSchema.virtual('isValid').get(function() {
  const now = new Date();
  return this.isActive && 
         this.startsAt <= now && 
         this.expiresAt > now &&
         (this.maxUses === null || this.usedCount < this.maxUses);
});

// Method to check if user can use coupon
couponSchema.methods.canUserUse = function(userId) {
  // Check if user already used this coupon
  const hasUsed = this.usedBy.some(usage => usage.user.toString() === userId.toString());
  if (hasUsed) return false;

  // Check user restrictions
  if (this.userRestrictions.specificUsers.length > 0) {
    return this.userRestrictions.specificUsers.includes(userId);
  }

  return true;
};

// Method to apply coupon usage
couponSchema.methods.applyCoupon = function(userId, orderId) {
  this.usedCount += 1;
  this.usedBy.push({
    user: userId,
    orderId: orderId,
    usedAt: new Date()
  });
  return this.save();
};

// Method to calculate discount
couponSchema.methods.calculateDiscount = function(amount) {
  if (this.type === 'percentage') {
    const discount = (amount * this.value) / 100;
    return this.maxAmount ? Math.min(discount, this.maxAmount) : discount;
  } else {
    return Math.min(this.value, amount);
  }
};

const Coupon = mongoose.model('Coupon', couponSchema);

export default Coupon;


// import mongoose from 'mongoose';

// const couponSchema = new mongoose.Schema({
//   code: {
//     type: String,
//     required: true,
//     unique: true,
//     uppercase: true,
//     trim: true,
//     maxlength: 20
//   },
//   description: {
//     type: String,
//     trim: true,
//     maxlength: 200
//   },
//   type: {
//     type: String,
//     enum: ['percentage', 'fixed'],
//     required: true
//   },
//   value: {
//     type: Number,
//     required: true,
//     min: 0
//   },
//   minAmount: {
//     type: Number,
//     default: 0,
//     min: 0
//   },
//   maxAmount: {
//     type: Number,
//     min: 0
//   },
//   maxUses: {
//     type: Number,
//     default: null
//   },
//   usedCount: {
//     type: Number,
//     default: 0,
//     min: 0
//   },
//   usedBy: [{
//     user: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     usedAt: {
//       type: Date,
//       default: Date.now
//     },
//     orderId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'Order'
//     }
//   }],
//   isActive: {
//     type: Boolean,
//     default: true
//   },
//   startsAt: {
//     type: Date,
//     default: Date.now
//   },
//   expiresAt: {
//     type: Date,
//     required: true
//   },
//   applicableCategories: [{
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Category'
//   }],
//   applicableProducts: [{
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Product'
//   }],
//   excludeCategories: [{
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Category'
//   }],
//   excludeProducts: [{
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Product'
//   }],
//   userRestrictions: {
//     newUsersOnly: {
//       type: Boolean,
//       default: false
//     },
//     specificUsers: [{
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     }],
//     userRoles: [{
//       type: String,
//       enum: ['customer', 'premium']
//     }]
//   },
//   createdBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   }
// }, {
//   timestamps: true
// });

// // Indexes
// couponSchema.index({ code: 1 });
// couponSchema.index({ isActive: 1, expiresAt: 1 });
// couponSchema.index({ createdAt: -1 });

// // Virtual for checking if coupon is expired
// couponSchema.virtual('isExpired').get(function() {
//   return this.expiresAt < new Date();
// });

// // Virtual for checking if coupon is valid
// couponSchema.virtual('isValid').get(function() {
//   const now = new Date();
//   return this.isActive && 
//          this.startsAt <= now && 
//          this.expiresAt > now &&
//          (this.maxUses === null || this.usedCount < this.maxUses);
// });

// // Method to check if user can use coupon
// couponSchema.methods.canUserUse = function(userId) {
//   // Check if user already used this coupon
//   const hasUsed = this.usedBy.some(usage => usage.user.toString() === userId.toString());
//   if (hasUsed) return false;

//   // Check user restrictions
//   if (this.userRestrictions.specificUsers.length > 0) {
//     return this.userRestrictions.specificUsers.includes(userId);
//   }

//   return true;
// };

// // Method to apply coupon usage
// couponSchema.methods.applyCoupon = function(userId, orderId) {
//   this.usedCount += 1;
//   this.usedBy.push({
//     user: userId,
//     orderId: orderId,
//     usedAt: new Date()
//   });
//   return this.save();
// };

// // Method to calculate discount
// couponSchema.methods.calculateDiscount = function(amount) {
//   if (this.type === 'percentage') {
//     const discount = (amount * this.value) / 100;
//     return this.maxAmount ? Math.min(discount, this.maxAmount) : discount;
//   } else {
//     return Math.min(this.value, amount);
//   }
// };

// const Coupon = mongoose.model('Coupon', couponSchema);

// export default Coupon;