import mongoose from 'mongoose';

const wishlistItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  variant: {
    type: mongoose.Schema.Types.ObjectId
  },
  addedAt: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 200
  }
});

const wishlistSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
    unique: true
  },
  name: {
    type: String,
    default: 'My Wishlist',
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  items: [wishlistItemSchema],
  isPublic: {
    type: Boolean,
    default: false
  },
  shareToken: {
    type: String,
    unique: true,
    index: true,
    sparse: true
  },
  totalItems: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Pre-save middleware to calculate totals
wishlistSchema.pre('save', function(next) {
  this.totalItems = this.items.length;
  next();
});

// Method to add item
wishlistSchema.methods.addItem = function(productId, variantId = null, notes = '') {
  const existingItem = this.items.find(item => 
    item.product.toString() === productId.toString() &&
    (!variantId || item.variant?.toString() === variantId?.toString())
  );
  
  if (existingItem) {
    throw new Error('Item already in wishlist');
  }
  
  this.items.push({
    product: productId,
    variant: variantId,
    notes
  });
  
  return this.save();
};

// Method to remove item
wishlistSchema.methods.removeItem = function(productId, variantId = null) {
  this.items = this.items.filter(item => 
    !(item.product.toString() === productId.toString() &&
      (!variantId || item.variant?.toString() === variantId?.toString()))
  );
  
  return this.save();
};

// Method to clear wishlist
wishlistSchema.methods.clearWishlist = function() {
  this.items = [];
  return this.save();
};

// Method to generate share token
wishlistSchema.methods.generateShareToken = function() {
  this.shareToken = require('crypto').randomBytes(16).toString('hex');
  this.isPublic = true;
  return this.save();
};

// Static method to get or create wishlist
wishlistSchema.statics.getOrCreateWishlist = async function(userId) {
  let wishlist = await this.findOne({ user: userId }).populate('items.product');
  
  if (!wishlist) {
    wishlist = new this({ user: userId });
    await wishlist.save();
  }
  
  return wishlist;
};

const Wishlist = mongoose.model('Wishlist', wishlistSchema);

export default Wishlist;

// import mongoose from 'mongoose';

// const wishlistItemSchema = new mongoose.Schema({
//   product: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Product',
//     required: true
//   },
//   variant: {
//     type: mongoose.Schema.Types.ObjectId
//   },
//   addedAt: {
//     type: Date,
//     default: Date.now
//   },
//   notes: {
//     type: String,
//     trim: true,
//     maxlength: 200
//   }
// });

// const wishlistSchema = new mongoose.Schema({
//   user: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true,
//     unique: true
//   },
//   name: {
//     type: String,
//     default: 'My Wishlist',
//     trim: true,
//     maxlength: 100
//   },
//   description: {
//     type: String,
//     trim: true,
//     maxlength: 500
//   },
//   items: [wishlistItemSchema],
//   isPublic: {
//     type: Boolean,
//     default: false
//   },
//   shareToken: {
//     type: String,
//     unique: true,
//     sparse: true
//   },
//   totalItems: {
//     type: Number,
//     default: 0
//   }
// }, {
//   timestamps: true
// });

// // Indexes
// wishlistSchema.index({ user: 1 });
// wishlistSchema.index({ shareToken: 1 });
// wishlistSchema.index({ 'items.product': 1 });

// // Pre-save middleware to calculate totals
// wishlistSchema.pre('save', function(next) {
//   this.totalItems = this.items.length;
//   next();
// });

// // Method to add item
// wishlistSchema.methods.addItem = function(productId, variantId = null, notes = '') {
//   const existingItem = this.items.find(item => 
//     item.product.toString() === productId.toString() &&
//     (!variantId || item.variant?.toString() === variantId?.toString())
//   );
  
//   if (existingItem) {
//     throw new Error('Item already in wishlist');
//   }
  
//   this.items.push({
//     product: productId,
//     variant: variantId,
//     notes
//   });
  
//   return this.save();
// };

// // Method to remove item
// wishlistSchema.methods.removeItem = function(productId, variantId = null) {
//   this.items = this.items.filter(item => 
//     !(item.product.toString() === productId.toString() &&
//       (!variantId || item.variant?.toString() === variantId?.toString()))
//   );
  
//   return this.save();
// };

// // Method to clear wishlist
// wishlistSchema.methods.clearWishlist = function() {
//   this.items = [];
//   return this.save();
// };

// // Method to generate share token
// wishlistSchema.methods.generateShareToken = function() {
//   this.shareToken = require('crypto').randomBytes(16).toString('hex');
//   this.isPublic = true;
//   return this.save();
// };

// // Static method to get or create wishlist
// wishlistSchema.statics.getOrCreateWishlist = async function(userId) {
//   let wishlist = await this.findOne({ user: userId }).populate('items.product');
  
//   if (!wishlist) {
//     wishlist = new this({ user: userId });
//     await wishlist.save();
//   }
  
//   return wishlist;
// };

// const Wishlist = mongoose.model('Wishlist', wishlistSchema);

// export default Wishlist;