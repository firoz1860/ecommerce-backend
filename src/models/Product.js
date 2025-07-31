import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  helpful: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isVerifiedPurchase: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const variantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  value: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  sku: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  images: [{
    url: String,
    public_id: String,
    alt: String
  }]
});

const productSchema = new mongoose.Schema({
  name: {
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
  shortDescription: {
    type: String,
    trim: true,
    maxlength: 500
  },
  price: {
    type: Number,
    required: true,
    index: true,
    min: 0
  },
  salePrice: {
    type: Number,
    min: 0
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    index: true,
    required: true
  },
  subcategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  },
  brand: {
    type: String,
    required: true,
    trim: true
  },
  sku: {
    type: String,
    required: true,
    unique: true
  },
  images: [{
    url: String,
    public_id: String,
    alt: String,
    isMain: { type: Boolean, default: false }
  }],
  variants: [variantSchema],
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  lowStockThreshold: {
    type: Number,
    default: 10
  },
  weight: {
    type: Number,
    min: 0
  },
  dimensions: {
    length: Number,
    width: Number,
    height: Number,
    unit: { type: String, default: 'cm' }
  },
  tags: [{
    type: String,
    trim: true
  }],
  features: [{
    type: String,
    trim: true
  }],
  specifications: [{
    name: String,
    value: String
  }],
  reviews: [reviewSchema],
  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0, min: 0 }
  },
  isActive: {
    type: Boolean,
    index: true,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isDigital: {
    type: Boolean,
    default: false
  },
  shippingRequired: {
    type: Boolean,
    default: true
  },
  taxable: {
    type: Boolean,
    default: true
  },
  metaTitle: String,
  metaDescription: String,
  slug: {
    type: String,
    unique: true,
    index: true,
    lowercase: true
  },
  views: {
    type: Number,
    default: 0
  },
  salesCount: {
    type: Number,
    default: 0
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Virtual for discount percentage
productSchema.virtual('discountPercentage').get(function() {
  if (this.salePrice && this.salePrice < this.price) {
    return Math.round(((this.price - this.salePrice) / this.price) * 100);
  }
  return 0;
});

// Virtual for effective price
productSchema.virtual('effectivePrice').get(function() {
  return this.salePrice && this.salePrice < this.price ? this.salePrice : this.price;
});

// Virtual for stock status
productSchema.virtual('stockStatus').get(function() {
  if (this.stock === 0) return 'out_of_stock';
  if (this.stock <= this.lowStockThreshold) return 'low_stock';
  return 'in_stock';
});

// Pre-save middleware to generate slug
productSchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  next();
});

// Method to calculate average rating
productSchema.methods.calculateAverageRating = function() {
  if (this.reviews.length === 0) {
    this.rating.average = 0;
    this.rating.count = 0;
    return;
  }
  
  const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
  this.rating.average = Math.round((totalRating / this.reviews.length) * 10) / 10;
  this.rating.count = this.reviews.length;
};

// Method to check if product is available
productSchema.methods.isAvailable = function(quantity = 1) {
  return this.isActive && this.stock >= quantity;
};

// Method to reserve stock
productSchema.methods.reserveStock = async function(quantity) {
  if (this.stock < quantity) {
    throw new Error('Insufficient stock');
  }
  this.stock -= quantity;
  return this.save();
};

// Method to release stock
productSchema.methods.releaseStock = async function(quantity) {
  this.stock += quantity;
  return this.save();
};

// Transform output
productSchema.methods.toJSON = function() {
  const productObject = this.toObject({ virtuals: true });
  return productObject;
};

const Product = mongoose.model('Product', productSchema);

export default Product;


// import mongoose from 'mongoose';

// const reviewSchema = new mongoose.Schema({
//   user: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   rating: {
//     type: Number,
//     required: true,
//     min: 1,
//     max: 5
//   },
//   comment: {
//     type: String,
//     required: true,
//     trim: true,
//     maxlength: 500
//   },
//   helpful: [{
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   }],
//   isVerifiedPurchase: {
//     type: Boolean,
//     default: false
//   }
// }, {
//   timestamps: true
// });

// const variantSchema = new mongoose.Schema({
//   name: {
//     type: String,
//     required: true,
//     trim: true
//   },
//   value: {
//     type: String,
//     required: true,
//     trim: true
//   },
//   price: {
//     type: Number,
//     required: true,
//     min: 0
//   },
//   stock: {
//     type: Number,
//     required: true,
//     min: 0,
//     default: 0
//   },
//   sku: {
//     type: String,
//     required: true,
//     unique: true
//   },
//   images: [{
//     url: String,
//     public_id: String,
//     alt: String
//   }]
// });

// const productSchema = new mongoose.Schema({
//   name: {
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
//   shortDescription: {
//     type: String,
//     trim: true,
//     maxlength: 500
//   },
//   price: {
//     type: Number,
//     required: true,
//     min: 0
//   },
//   salePrice: {
//     type: Number,
//     min: 0
//   },
//   category: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Category',
//     required: true
//   },
//   subcategory: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Category'
//   },
//   brand: {
//     type: String,
//     required: true,
//     trim: true
//   },
//   sku: {
//     type: String,
//     required: true,
//     unique: true
//   },
//   images: [{
//     url: String,
//     public_id: String,
//     alt: String,
//     isMain: { type: Boolean, default: false }
//   }],
//   variants: [variantSchema],
//   stock: {
//     type: Number,
//     required: true,
//     min: 0,
//     default: 0
//   },
//   lowStockThreshold: {
//     type: Number,
//     default: 10
//   },
//   weight: {
//     type: Number,
//     min: 0
//   },
//   dimensions: {
//     length: Number,
//     width: Number,
//     height: Number,
//     unit: { type: String, default: 'cm' }
//   },
//   tags: [{
//     type: String,
//     trim: true
//   }],
//   features: [{
//     type: String,
//     trim: true
//   }],
//   specifications: [{
//     name: String,
//     value: String
//   }],
//   reviews: [reviewSchema],
//   rating: {
//     average: { type: Number, default: 0, min: 0, max: 5 },
//     count: { type: Number, default: 0, min: 0 }
//   },
//   isActive: {
//     type: Boolean,
//     default: true
//   },
//   isFeatured: {
//     type: Boolean,
//     default: false
//   },
//   isDigital: {
//     type: Boolean,
//     default: false
//   },
//   shippingRequired: {
//     type: Boolean,
//     default: true
//   },
//   taxable: {
//     type: Boolean,
//     default: true
//   },
//   metaTitle: String,
//   metaDescription: String,
//   slug: {
//     type: String,
//     unique: true,
//     lowercase: true
//   },
//   views: {
//     type: Number,
//     default: 0
//   },
//   salesCount: {
//     type: Number,
//     default: 0
//   },
//   supplier: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   }
// }, {
//   timestamps: true
// });

// // Indexes for efficient queries
// productSchema.index({ name: 'text', description: 'text', tags: 'text' });
// productSchema.index({ category: 1, isActive: 1 });
// productSchema.index({ price: 1 });
// productSchema.index({ 'rating.average': -1 });
// productSchema.index({ createdAt: -1 });
// productSchema.index({ slug: 1 });
// productSchema.index({ sku: 1 });

// // Virtual for discount percentage
// productSchema.virtual('discountPercentage').get(function() {
//   if (this.salePrice && this.salePrice < this.price) {
//     return Math.round(((this.price - this.salePrice) / this.price) * 100);
//   }
//   return 0;
// });

// // Virtual for effective price
// productSchema.virtual('effectivePrice').get(function() {
//   return this.salePrice && this.salePrice < this.price ? this.salePrice : this.price;
// });

// // Virtual for stock status
// productSchema.virtual('stockStatus').get(function() {
//   if (this.stock === 0) return 'out_of_stock';
//   if (this.stock <= this.lowStockThreshold) return 'low_stock';
//   return 'in_stock';
// });

// // Pre-save middleware to generate slug
// productSchema.pre('save', function(next) {
//   if (this.isModified('name')) {
//     this.slug = this.name
//       .toLowerCase()
//       .replace(/[^a-z0-9]+/g, '-')
//       .replace(/^-+|-+$/g, '');
//   }
//   next();
// });

// // Method to calculate average rating
// productSchema.methods.calculateAverageRating = function() {
//   if (this.reviews.length === 0) {
//     this.rating.average = 0;
//     this.rating.count = 0;
//     return;
//   }
  
//   const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
//   this.rating.average = Math.round((totalRating / this.reviews.length) * 10) / 10;
//   this.rating.count = this.reviews.length;
// };

// // Method to check if product is available
// productSchema.methods.isAvailable = function(quantity = 1) {
//   return this.isActive && this.stock >= quantity;
// };

// // Method to reserve stock
// productSchema.methods.reserveStock = async function(quantity) {
//   if (this.stock < quantity) {
//     throw new Error('Insufficient stock');
//   }
//   this.stock -= quantity;
//   return this.save();
// };

// // Method to release stock
// productSchema.methods.releaseStock = async function(quantity) {
//   this.stock += quantity;
//   return this.save();
// };

// // Transform output
// productSchema.methods.toJSON = function() {
//   const productObject = this.toObject({ virtuals: true });
//   return productObject;
// };

// const Product = mongoose.model('Product', productSchema);

// export default Product;