import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({
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
    min: 1,
    default: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
    unique: true
  },
  items: [cartItemSchema],
  totalAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalItems: {
    type: Number,
    default: 0,
    min: 0
  },
  lastModified: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Pre-save middleware to calculate totals
cartSchema.pre('save', function(next) {
  this.totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
  this.totalAmount = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  this.lastModified = new Date();
  next();
});

// Method to add item to cart
cartSchema.methods.addItem = async function(productId, quantity, price, variantId = null) {
  const existingItemIndex = this.items.findIndex(item => 
    item.product.toString() === productId.toString() && 
    (!variantId || item.variant?.toString() === variantId.toString())
  );
  
  if (existingItemIndex > -1) {
    this.items[existingItemIndex].quantity += quantity;
    this.items[existingItemIndex].price = price; // Update price in case it changed
  } else {
    this.items.push({
      product: productId,
      variant: variantId,
      quantity,
      price
    });
  }
  
  return this.save();
};

// Method to update item quantity
cartSchema.methods.updateItem = async function(productId, quantity, variantId = null) {
  const itemIndex = this.items.findIndex(item => 
    item.product.toString() === productId.toString() && 
    (!variantId || item.variant?.toString() === variantId.toString())
  );
  
  if (itemIndex === -1) {
    throw new Error('Item not found in cart');
  }
  
  if (quantity <= 0) {
    this.items.splice(itemIndex, 1);
  } else {
    this.items[itemIndex].quantity = quantity;
  }
  
  return this.save();
};

// Method to remove item from cart
cartSchema.methods.removeItem = async function(productId, variantId = null) {
  this.items = this.items.filter(item => 
    !(item.product.toString() === productId.toString() && 
      (!variantId || item.variant?.toString() === variantId.toString()))
  );
  
  return this.save();
};

// Method to clear cart
cartSchema.methods.clearCart = async function() {
  this.items = [];
  return this.save();
};

// Method to check if cart is empty
cartSchema.methods.isEmpty = function() {
  return this.items.length === 0;
};

// Method to get cart summary
cartSchema.methods.getSummary = function() {
  return {
    totalItems: this.totalItems,
    totalAmount: this.totalAmount,
    itemsCount: this.items.length,
    lastModified: this.lastModified
  };
};

// Static method to get or create cart for user
cartSchema.statics.getOrCreateCart = async function(userId) {
  let cart = await this.findOne({ user: userId }).populate('items.product');
  
  if (!cart) {
    cart = new this({ user: userId });
    await cart.save();
  }
  
  return cart;
};

// Method to validate cart items availability
cartSchema.methods.validateItems = async function() {
  const Product = mongoose.model('Product');
  const validationErrors = [];
  
  for (const item of this.items) {
    const product = await Product.findById(item.product);
    
    if (!product) {
      validationErrors.push(`Product ${item.product} not found`);
      continue;
    }
    
    if (!product.isActive) {
      validationErrors.push(`Product ${product.name} is no longer available`);
      continue;
    }
    
    if (product.stock < item.quantity) {
      validationErrors.push(
        `Only ${product.stock} units of ${product.name} are available`
      );
    }
  }
  
  return validationErrors;
};

const Cart = mongoose.model('Cart', cartSchema);

export default Cart;


// import mongoose from 'mongoose';

// const cartItemSchema = new mongoose.Schema({
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
//     min: 1,
//     default: 1
//   },
//   price: {
//     type: Number,
//     required: true,
//     min: 0
//   },
//   addedAt: {
//     type: Date,
//     default: Date.now
//   }
// });

// const cartSchema = new mongoose.Schema({
//   user: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true,
//     unique: true
//   },
//   items: [cartItemSchema],
//   totalAmount: {
//     type: Number,
//     default: 0,
//     min: 0
//   },
//   totalItems: {
//     type: Number,
//     default: 0,
//     min: 0
//   },
//   lastModified: {
//     type: Date,
//     default: Date.now
//   }
// }, {
//   timestamps: true
// });

// // Index for efficient queries
// cartSchema.index({ user: 1 });
// cartSchema.index({ 'items.product': 1 });

// // Pre-save middleware to calculate totals
// cartSchema.pre('save', function(next) {
//   this.totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
//   this.totalAmount = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
//   this.lastModified = new Date();
//   next();
// });

// // Method to add item to cart
// cartSchema.methods.addItem = async function(productId, quantity, price, variantId = null) {
//   const existingItemIndex = this.items.findIndex(item => 
//     item.product.toString() === productId.toString() && 
//     (!variantId || item.variant?.toString() === variantId.toString())
//   );
  
//   if (existingItemIndex > -1) {
//     this.items[existingItemIndex].quantity += quantity;
//     this.items[existingItemIndex].price = price; // Update price in case it changed
//   } else {
//     this.items.push({
//       product: productId,
//       variant: variantId,
//       quantity,
//       price
//     });
//   }
  
//   return this.save();
// };

// // Method to update item quantity
// cartSchema.methods.updateItem = async function(productId, quantity, variantId = null) {
//   const itemIndex = this.items.findIndex(item => 
//     item.product.toString() === productId.toString() && 
//     (!variantId || item.variant?.toString() === variantId.toString())
//   );
  
//   if (itemIndex === -1) {
//     throw new Error('Item not found in cart');
//   }
  
//   if (quantity <= 0) {
//     this.items.splice(itemIndex, 1);
//   } else {
//     this.items[itemIndex].quantity = quantity;
//   }
  
//   return this.save();
// };

// // Method to remove item from cart
// cartSchema.methods.removeItem = async function(productId, variantId = null) {
//   this.items = this.items.filter(item => 
//     !(item.product.toString() === productId.toString() && 
//       (!variantId || item.variant?.toString() === variantId.toString()))
//   );
  
//   return this.save();
// };

// // Method to clear cart
// cartSchema.methods.clearCart = async function() {
//   this.items = [];
//   return this.save();
// };

// // Method to check if cart is empty
// cartSchema.methods.isEmpty = function() {
//   return this.items.length === 0;
// };

// // Method to get cart summary
// cartSchema.methods.getSummary = function() {
//   return {
//     totalItems: this.totalItems,
//     totalAmount: this.totalAmount,
//     itemsCount: this.items.length,
//     lastModified: this.lastModified
//   };
// };

// // Static method to get or create cart for user
// cartSchema.statics.getOrCreateCart = async function(userId) {
//   let cart = await this.findOne({ user: userId }).populate('items.product');
  
//   if (!cart) {
//     cart = new this({ user: userId });
//     await cart.save();
//   }
  
//   return cart;
// };

// // Method to validate cart items availability
// cartSchema.methods.validateItems = async function() {
//   const Product = mongoose.model('Product');
//   const validationErrors = [];
  
//   for (const item of this.items) {
//     const product = await Product.findById(item.product);
    
//     if (!product) {
//       validationErrors.push(`Product ${item.product} not found`);
//       continue;
//     }
    
//     if (!product.isActive) {
//       validationErrors.push(`Product ${product.name} is no longer available`);
//       continue;
//     }
    
//     if (product.stock < item.quantity) {
//       validationErrors.push(
//         `Only ${product.stock} units of ${product.name} are available`
//       );
//     }
//   }
  
//   return validationErrors;
// };

// const Cart = mongoose.model('Cart', cartSchema);

// export default Cart;