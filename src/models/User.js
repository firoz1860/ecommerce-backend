import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const addressSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['home', 'work', 'other'],
    default: 'home'
  },
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true },
  country: { type: String, required: true, default: 'USA' },
  isDefault: { type: Boolean, default: false }
});

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    unique: true,
    index: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: function() {
      return !this.googleId; // Password not required for Google OAuth users
    },
    minlength: 8
  },
  phone: {
    type: String,
    trim: true,
    sparse: true
  },
  avatar: {
    url: String,
    public_id: String
  },
role: {
  type: String,
  enum: ['customer', 'admin', 'seller'],
  default: 'customer',
  required: true // optional but recommended
},
  // Google OAuth fields
  googleId: {
    type: String,
    sparse: true,
    index: true
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
  },
  addresses: [addressSchema],
  wishlist: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  refreshTokens: [{
    token: String,
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date,
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date
}, {
  timestamps: true
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  // Skip password comparison for OAuth users
  if (this.authProvider !== 'local' || !this.password) {
    return false;
  }
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to handle login attempts
userSchema.methods.incLoginAttempts = async function() {
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000; // 2 hours
  
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1, loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + lockTime };
  }
  
  return this.updateOne(updates);
};

// Method to clean expired refresh tokens
userSchema.methods.cleanExpiredTokens = async function() {
  this.refreshTokens = this.refreshTokens.filter(
    tokenObj => tokenObj.expiresAt > new Date()
  );
  return this.save();
};

// Transform output
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.refreshTokens;
  delete userObject.emailVerificationToken;
  delete userObject.passwordResetToken;
  delete userObject.loginAttempts;
  delete userObject.lockUntil;
  return userObject;
};

const User = mongoose.model('User', userSchema);

export default User;

// import mongoose from 'mongoose';
// import bcrypt from 'bcrypt';

// const addressSchema = new mongoose.Schema({
//   type: {
//     type: String,
//     enum: ['home', 'work', 'other'],
//     default: 'home'
//   },
//   street: { type: String, required: true },
//   city: { type: String, required: true },
//   state: { type: String, required: true },
//   zipCode: { type: String, required: true },
//   country: { type: String, required: true, default: 'USA' },
//   isDefault: { type: Boolean, default: false }
// });

// const userSchema = new mongoose.Schema({
//   firstName: {
//     type: String,
//     required: true,
//     trim: true,
//     maxlength: 50
//   },
//   lastName: {
//     type: String,
//     required: true,
//     trim: true,
//     maxlength: 50
//   },
//   email: {
//     type: String,
//     required: true,
//     unique: true,
//     index: true,
//     lowercase: true,
//     trim: true
//   },
//   password: {
//     type: String,
//     required: true,
//     minlength: 8
//   },
//   phone: {
//     type: String,
//     trim: true,
//     sparse: true
//   },
//   avatar: {
//     url: String,
//     public_id: String
//   },
//   role: {
//     type: String,
//     enum: ['customer', 'admin', 'seller'],
//     default: 'customer'
//   },
//   addresses: [addressSchema],
//   wishlist: [{
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Product'
//   }],
//   isEmailVerified: {
//     type: Boolean,
//     default: false
//   },
//   emailVerificationToken: String,
//   emailVerificationExpires: Date,
//   passwordResetToken: String,
//   passwordResetExpires: Date,
//   refreshTokens: [{
//     token: String,
//     createdAt: { type: Date, default: Date.now },
//     expiresAt: Date
//   }],
//   isActive: {
//     type: Boolean,
//     default: true
//   },
//   lastLogin: Date,
//   loginAttempts: {
//     type: Number,
//     default: 0
//   },
//   lockUntil: Date
// }, {
//   timestamps: true
// });

// // Virtual for full name
// userSchema.virtual('fullName').get(function() {
//   return `${this.firstName} ${this.lastName}`;
// });

// // Virtual for account lock status
// userSchema.virtual('isLocked').get(function() {
//   return !!(this.lockUntil && this.lockUntil > Date.now());
// });

// // Pre-save middleware to hash password
// userSchema.pre('save', async function(next) {
//   if (!this.isModified('password')) return next();
  
//   try {
//     const salt = await bcrypt.genSalt(12);
//     this.password = await bcrypt.hash(this.password, salt);
//     next();
//   } catch (error) {
//     next(error);
//   }
// });

// // Method to check password
// userSchema.methods.comparePassword = async function(candidatePassword) {
//   return bcrypt.compare(candidatePassword, this.password);
// };

// // Method to handle login attempts
// userSchema.methods.incLoginAttempts = async function() {
//   const maxAttempts = 5;
//   const lockTime = 2 * 60 * 60 * 1000; // 2 hours
  
//   if (this.lockUntil && this.lockUntil < Date.now()) {
//     return this.updateOne({
//       $unset: { lockUntil: 1, loginAttempts: 1 }
//     });
//   }
  
//   const updates = { $inc: { loginAttempts: 1 } };
  
//   if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
//     updates.$set = { lockUntil: Date.now() + lockTime };
//   }
  
//   return this.updateOne(updates);
// };

// // Method to clean expired refresh tokens
// userSchema.methods.cleanExpiredTokens = async function() {
//   this.refreshTokens = this.refreshTokens.filter(
//     tokenObj => tokenObj.expiresAt > new Date()
//   );
//   return this.save();
// };

// // Transform output
// userSchema.methods.toJSON = function() {
//   const userObject = this.toObject();
//   delete userObject.password;
//   delete userObject.refreshTokens;
//   delete userObject.emailVerificationToken;
//   delete userObject.passwordResetToken;
//   delete userObject.loginAttempts;
//   delete userObject.lockUntil;
//   return userObject;
// };

// const User = mongoose.model('User', userSchema);

// export default User;

