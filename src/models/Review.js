import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    index: true,
    required: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  rating: {
    type: Number,
    required: true,
    index: true,
    min: 1,
    max: 5
  },
  title: {
    type: String,
    trim: true,
    maxlength: 100
  },
  comment: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  pros: [{
    type: String,
    trim: true,
    maxlength: 100
  }],
  cons: [{
    type: String,
    trim: true,
    maxlength: 100
  }],
  images: [{
    url: String,
    public_id: String,
    alt: String
  }],
  helpful: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    helpfulAt: {
      type: Date,
      default: Date.now
    }
  }],
  notHelpful: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notHelpfulAt: {
      type: Date,
      default: Date.now
    }
  }],
  isVerifiedPurchase: {
    type: Boolean,
    index: true,
    default: false
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'flagged'],
    index: true,
    default: 'pending'
  },
  moderationNote: String,
  moderatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  moderatedAt: Date,
  replies: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    isSellerReply: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  flags: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      enum: ['spam', 'inappropriate', 'fake', 'offensive', 'other']
    },
    description: String,
    flaggedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Virtual for helpful count
reviewSchema.virtual('helpfulCount').get(function() {
  return this.helpful.length;
});

// Virtual for not helpful count
reviewSchema.virtual('notHelpfulCount').get(function() {
  return this.notHelpful.length;
});

// Method to mark as helpful
reviewSchema.methods.markHelpful = function(userId) {
  const alreadyHelpful = this.helpful.some(h => h.user.toString() === userId.toString());
  const alreadyNotHelpful = this.notHelpful.some(nh => nh.user.toString() === userId.toString());
  
  if (alreadyHelpful) {
    // Remove from helpful
    this.helpful = this.helpful.filter(h => h.user.toString() !== userId.toString());
  } else {
    // Remove from not helpful if exists
    if (alreadyNotHelpful) {
      this.notHelpful = this.notHelpful.filter(nh => nh.user.toString() !== userId.toString());
    }
    // Add to helpful
    this.helpful.push({ user: userId });
  }
  
  return this.save();
};

// Method to mark as not helpful
reviewSchema.methods.markNotHelpful = function(userId) {
  const alreadyNotHelpful = this.notHelpful.some(nh => nh.user.toString() === userId.toString());
  const alreadyHelpful = this.helpful.some(h => h.user.toString() === userId.toString());
  
  if (alreadyNotHelpful) {
    // Remove from not helpful
    this.notHelpful = this.notHelpful.filter(nh => nh.user.toString() !== userId.toString());
  } else {
    // Remove from helpful if exists
    if (alreadyHelpful) {
      this.helpful = this.helpful.filter(h => h.user.toString() !== userId.toString());
    }
    // Add to not helpful
    this.notHelpful.push({ user: userId });
  }
  
  return this.save();
};

const Review = mongoose.model('Review', reviewSchema);

export default Review;

// import mongoose from 'mongoose';

// const reviewSchema = new mongoose.Schema({
//   user: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   product: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Product',
//     required: true
//   },
//   order: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Order'
//   },
//   rating: {
//     type: Number,
//     required: true,
//     min: 1,
//     max: 5
//   },
//   title: {
//     type: String,
//     trim: true,
//     maxlength: 100
//   },
//   comment: {
//     type: String,
//     required: true,
//     trim: true,
//     maxlength: 1000
//   },
//   pros: [{
//     type: String,
//     trim: true,
//     maxlength: 100
//   }],
//   cons: [{
//     type: String,
//     trim: true,
//     maxlength: 100
//   }],
//   images: [{
//     url: String,
//     public_id: String,
//     alt: String
//   }],
//   helpful: [{
//     user: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     helpfulAt: {
//       type: Date,
//       default: Date.now
//     }
//   }],
//   notHelpful: [{
//     user: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     notHelpfulAt: {
//       type: Date,
//       default: Date.now
//     }
//   }],
//   isVerifiedPurchase: {
//     type: Boolean,
//     default: false
//   },
//   status: {
//     type: String,
//     enum: ['pending', 'approved', 'rejected', 'flagged'],
//     default: 'pending'
//   },
//   moderationNote: String,
//   moderatedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   },
//   moderatedAt: Date,
//   replies: [{
//     user: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//       required: true
//     },
//     comment: {
//       type: String,
//       required: true,
//       trim: true,
//       maxlength: 500
//     },
//     isSellerReply: {
//       type: Boolean,
//       default: false
//     },
//     createdAt: {
//       type: Date,
//       default: Date.now
//     }
//   }],
//   flags: [{
//     user: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     reason: {
//       type: String,
//       enum: ['spam', 'inappropriate', 'fake', 'offensive', 'other']
//     },
//     description: String,
//     flaggedAt: {
//       type: Date,
//       default: Date.now
//     }
//   }]
// }, {
//   timestamps: true
// });

// // Indexes
// reviewSchema.index({ product: 1, createdAt: -1 });
// reviewSchema.index({ user: 1, product: 1 }, { unique: true });
// reviewSchema.index({ rating: 1 });
// reviewSchema.index({ status: 1 });
// reviewSchema.index({ isVerifiedPurchase: 1 });

// // Virtual for helpful count
// reviewSchema.virtual('helpfulCount').get(function() {
//   return this.helpful.length;
// });

// // Virtual for not helpful count
// reviewSchema.virtual('notHelpfulCount').get(function() {
//   return this.notHelpful.length;
// });

// // Method to mark as helpful
// reviewSchema.methods.markHelpful = function(userId) {
//   const alreadyHelpful = this.helpful.some(h => h.user.toString() === userId.toString());
//   const alreadyNotHelpful = this.notHelpful.some(nh => nh.user.toString() === userId.toString());
  
//   if (alreadyHelpful) {
//     // Remove from helpful
//     this.helpful = this.helpful.filter(h => h.user.toString() !== userId.toString());
//   } else {
//     // Remove from not helpful if exists
//     if (alreadyNotHelpful) {
//       this.notHelpful = this.notHelpful.filter(nh => nh.user.toString() !== userId.toString());
//     }
//     // Add to helpful
//     this.helpful.push({ user: userId });
//   }
  
//   return this.save();
// };

// // Method to mark as not helpful
// reviewSchema.methods.markNotHelpful = function(userId) {
//   const alreadyNotHelpful = this.notHelpful.some(nh => nh.user.toString() === userId.toString());
//   const alreadyHelpful = this.helpful.some(h => h.user.toString() === userId.toString());
  
//   if (alreadyNotHelpful) {
//     // Remove from not helpful
//     this.notHelpful = this.notHelpful.filter(nh => nh.user.toString() !== userId.toString());
//   } else {
//     // Remove from helpful if exists
//     if (alreadyHelpful) {
//       this.helpful = this.helpful.filter(h => h.user.toString() !== userId.toString());
//     }
//     // Add to not helpful
//     this.notHelpful.push({ user: userId });
//   }
  
//   return this.save();
// };

// const Review = mongoose.model('Review', reviewSchema);

// export default Review;