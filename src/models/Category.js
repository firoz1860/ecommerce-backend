import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  slug: {
    type: String,
    unique: true,
    index: true,
    lowercase: true
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    index: true,
    default: null
  },
  level: {
    type: Number,
    default: 0
  },
  image: {
    url: String,
    public_id: String,
    alt: String
  },
  icon: String,
  isActive: {
    type: Boolean,
    index: true,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  metaTitle: String,
  metaDescription: String,
  featuredProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }]
}, {
  timestamps: true
});

// Virtual for children categories
categorySchema.virtual('children', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parent'
});

// Virtual for products count
categorySchema.virtual('productsCount', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'category',
  count: true
});

// Pre-save middleware to generate slug and set level
categorySchema.pre('save', async function(next) {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  
  // Set level based on parent
  if (this.parent) {
    const parent = await this.constructor.findById(this.parent);
    this.level = parent ? parent.level + 1 : 0;
  } else {
    this.level = 0;
  }
  
  next();
});

// Method to get category path
categorySchema.methods.getPath = async function() {
  const path = [this];
  let current = this;
  
  while (current.parent) {
    current = await this.constructor.findById(current.parent);
    if (current) path.unshift(current);
  }
  
  return path;
};

// Method to get all descendants
categorySchema.methods.getDescendants = async function() {
  const descendants = [];
  const queue = [this._id];
  
  while (queue.length > 0) {
    const currentId = queue.shift();
    const children = await this.constructor.find({ parent: currentId });
    
    for (const child of children) {
      descendants.push(child);
      queue.push(child._id);
    }
  }
  
  return descendants;
};

// Static method to get category tree
categorySchema.statics.getTree = async function() {
  const categories = await this.find({ isActive: true })
    .sort({ sortOrder: 1, name: 1 })
    .populate('children');
  
  const tree = categories.filter(cat => !cat.parent);
  
  const buildTree = (parent) => {
    const children = categories.filter(cat => 
      cat.parent && cat.parent.toString() === parent._id.toString()
    );
    
    if (children.length > 0) {
      parent.children = children.map(child => buildTree(child));
    }
    
    return parent;
  };
  
  return tree.map(root => buildTree(root));
};

// Transform output
categorySchema.methods.toJSON = function() {
  const categoryObject = this.toObject({ virtuals: true });
  return categoryObject;
};

const Category = mongoose.model('Category', categorySchema);

export default Category;


// import mongoose from 'mongoose';

// const categorySchema = new mongoose.Schema({
//   name: {
//     type: String,
//     required: true,
//     trim: true,
//     maxlength: 100
//   },
//   description: {
//     type: String,
//     trim: true,
//     maxlength: 500
//   },
//   slug: {
//     type: String,
//     unique: true,
//     lowercase: true
//   },
//   parent: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Category',
//     default: null
//   },
//   level: {
//     type: Number,
//     default: 0
//   },
//   image: {
//     url: String,
//     public_id: String,
//     alt: String
//   },
//   icon: String,
//   isActive: {
//     type: Boolean,
//     default: true
//   },
//   sortOrder: {
//     type: Number,
//     default: 0
//   },
//   metaTitle: String,
//   metaDescription: String,
//   featuredProducts: [{
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Product'
//   }]
// }, {
//   timestamps: true
// });

// // Index for efficient queries
// categorySchema.index({ parent: 1, isActive: 1 });
// categorySchema.index({ slug: 1 });
// categorySchema.index({ name: 'text', description: 'text' });

// // Virtual for children categories
// categorySchema.virtual('children', {
//   ref: 'Category',
//   localField: '_id',
//   foreignField: 'parent'
// });

// // Virtual for products count
// categorySchema.virtual('productsCount', {
//   ref: 'Product',
//   localField: '_id',
//   foreignField: 'category',
//   count: true
// });

// // Pre-save middleware to generate slug and set level
// categorySchema.pre('save', async function(next) {
//   if (this.isModified('name')) {
//     this.slug = this.name
//       .toLowerCase()
//       .replace(/[^a-z0-9]+/g, '-')
//       .replace(/^-+|-+$/g, '');
//   }
  
//   // Set level based on parent
//   if (this.parent) {
//     const parent = await this.constructor.findById(this.parent);
//     this.level = parent ? parent.level + 1 : 0;
//   } else {
//     this.level = 0;
//   }
  
//   next();
// });

// // Method to get category path
// categorySchema.methods.getPath = async function() {
//   const path = [this];
//   let current = this;
  
//   while (current.parent) {
//     current = await this.constructor.findById(current.parent);
//     if (current) path.unshift(current);
//   }
  
//   return path;
// };

// // Method to get all descendants
// categorySchema.methods.getDescendants = async function() {
//   const descendants = [];
//   const queue = [this._id];
  
//   while (queue.length > 0) {
//     const currentId = queue.shift();
//     const children = await this.constructor.find({ parent: currentId });
    
//     for (const child of children) {
//       descendants.push(child);
//       queue.push(child._id);
//     }
//   }
  
//   return descendants;
// };

// // Static method to get category tree
// categorySchema.statics.getTree = async function() {
//   const categories = await this.find({ isActive: true })
//     .sort({ sortOrder: 1, name: 1 })
//     .populate('children');
  
//   const tree = categories.filter(cat => !cat.parent);
  
//   const buildTree = (parent) => {
//     const children = categories.filter(cat => 
//       cat.parent && cat.parent.toString() === parent._id.toString()
//     );
    
//     if (children.length > 0) {
//       parent.children = children.map(child => buildTree(child));
//     }
    
//     return parent;
//   };
  
//   return tree.map(root => buildTree(root));
// };

// // Transform output
// categorySchema.methods.toJSON = function() {
//   const categoryObject = this.toObject({ virtuals: true });
//   return categoryObject;
// };

// const Category = mongoose.model('Category', categorySchema);

// export default Category;