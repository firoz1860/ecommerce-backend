import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { sendEmail } from '../services/email.service.js';
import { getRedisClient } from '../config/redis.js';
import logger from '../utils/logger.js';

// Generate JWT tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRE || '15m' }
  );
  
  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );
  
  return { accessToken, refreshToken };
};

// Register user
const register = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password , role} = req.body;
  
  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(409, 'Email already registered');
  }
  
  // Create user
  const user = new User({
    firstName,
    lastName,
    email,
    password,
     role,
  });
  console.log(role)
  // Generate email verification token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  user.emailVerificationToken = verificationToken;
  user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  console.log("verificationToken",verificationToken)
  await user.save();
  
  // Send verification email
  try {
    await sendEmail({
      to: email,
      subject: 'Verify Your Email',
      template: 'email-verification',
      data: {
        name: firstName,
        verificationLink: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`
      }
    });
    console.log("verificationToken",verificationToken)
  } catch (emailError) {
    logger.error('Failed to send verification email:', emailError);
    // Don't throw error, user can still login
  }
  
  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user._id);
  
  // Save refresh token to user
  user.refreshTokens.push({
    token: refreshToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });
  await user.save();
  
  // Set secure cookie
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
  
  logger.info(`User registered: ${email}`);
  
  res.status(201).json(new ApiResponse(201, {
    user: user.toJSON(),
    accessToken
  }, 'User registered successfully'));
});

// Login user
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  
  // Find user and check password
  const user = await User.findOne({ email });
  if (!user || !(await user.comparePassword(password))) {
    if (user) {
      await user.incLoginAttempts();
    }
    throw new ApiError(401, 'Invalid credentials');
  }
  
  // Check if account is locked
  if (user.isLocked) {
    throw new ApiError(423, 'Account temporarily locked due to too many failed login attempts');
  }
  
  // Check if user is active
  if (!user.isActive) {
    throw new ApiError(401, 'Account has been deactivated');
  }
  
  // Reset login attempts on successful login
  if (user.loginAttempts > 0) {
    await user.updateOne({
      $unset: { loginAttempts: 1, lockUntil: 1 }
    });
  }
  
  // Clean expired refresh tokens
  await user.cleanExpiredTokens();
  
  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user._id);
  
  // Save refresh token to user
  user.refreshTokens.push({
    token: refreshToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });
  user.lastLogin = new Date();
  await user.save();
  
  // Set secure cookie
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
  
  logger.info(`User logged in: ${email}`);
  
  res.json(new ApiResponse(200, {
    user: user.toJSON(),
    accessToken
  }, 'Login successful'));
});

// Refresh token
const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken: token } = req.body || {};
  const cookieToken = req.cookies?.refreshToken;
  
  const refreshTokenToUse = token || cookieToken;
  
  if (!refreshTokenToUse) {
    throw new ApiError(401, 'Refresh token required');
  }
  
  // Verify refresh token
  const decoded = jwt.verify(refreshTokenToUse, process.env.JWT_REFRESH_SECRET);
  
  // Find user and validate refresh token
  const user = await User.findById(decoded.userId);
  if (!user || !user.refreshTokens.some(rt => rt.token === refreshTokenToUse)) {
    throw new ApiError(401, 'Invalid refresh token');
  }
  
  // Generate new tokens
  const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id);
  
  // Replace old refresh token with new one
  user.refreshTokens = user.refreshTokens.filter(rt => rt.token !== refreshTokenToUse);
  user.refreshTokens.push({
    token: newRefreshToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });
  await user.save();
  
  // Set new secure cookie
  res.cookie('refreshToken', newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
  
  res.json(new ApiResponse(200, {
    accessToken,
    refreshToken: newRefreshToken
  }, 'Token refreshed successfully'));
});

// Logout user
const logout = asyncHandler(async (req, res) => {
  const { refreshToken: token } = req.body || {};
  const cookieToken = req.cookies?.refreshToken;
  
  const refreshTokenToUse = token || cookieToken;
  
  if (refreshTokenToUse) {
    // Remove refresh token from user
    const user = await User.findById(req.user.userId);
    if (user) {
      user.refreshTokens = user.refreshTokens.filter(rt => rt.token !== refreshTokenToUse);
      await user.save();
    }
    
    // Add token to Redis blacklist
    const redis = getRedisClient();
    if (redis) {
      try {
        await redis.setEx(`blacklist:${refreshTokenToUse}`, 7 * 24 * 60 * 60, 'true');
      } catch (redisError) {
        logger.warn('Failed to blacklist token in Redis:', redisError.message);
      }
    }
  }
  
  // Clear cookie
  res.clearCookie('refreshToken');
  
  logger.info(`User logged out: ${req.user.userId}`);
  
  res.json(new ApiResponse(200, null, 'Logged out successfully'));
});

// Forgot password
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  
  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  user.passwordResetToken = resetToken;
  user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
  
  await user.save();
  
  // Send reset email
  try {
    await sendEmail({
      to: email,
      subject: 'Password Reset Request',
      template: 'password-reset',
      data: {
        name: user.firstName,
        resetLink: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
      }
    });
    console.log(resetToken);
  } catch (emailError) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    throw new ApiError(500, 'Email could not be sent');
  }
  
  logger.info(`Password reset requested for: ${email}`);
  
  res.json(new ApiResponse(200, null, 'Password reset email sent'));
});

// Reset password
const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  
  const user = await User.findOne({
    passwordResetToken: token,
    passwordResetExpires: { $gt: Date.now() }
  });
  
  if (!user) {
    throw new ApiError(400, 'Invalid or expired reset token');
  }
  
  // Update password
  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  
  // Clear all refresh tokens
  user.refreshTokens = [];
  
  await user.save();
  
  logger.info(`Password reset successful for: ${user.email}`);
  
  res.json(new ApiResponse(200, null, 'Password reset successful'));
});

// Verify email
const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.query;
  
  const user = await User.findOne({
    emailVerificationToken: token,
    emailVerificationExpires: { $gt: Date.now() }
  });
  
  if (!user) {
    throw new ApiError(400, 'Invalid or expired verification token');
  }
  
  // Verify email
  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  
  await user.save();
  
  logger.info(`Email verified for: ${user.email}`);
  
  res.json(new ApiResponse(200, null, 'Email verified successfully'));
});

// Google OAuth (placeholder)
const googleAuth = asyncHandler(async (req, res) => {
  const { token, code } = req.body;
  
  let googleUserData;
  
  try {
    if (token) {
      // Direct token verification (for frontend Google Sign-In)
      googleUserData = await verifyGoogleToken(token);
    } else if (code) {
      // Authorization code flow
      const tokens = await getGoogleTokens(code);
      googleUserData = await verifyGoogleToken(tokens.id_token);
    } else {
      throw new ApiError(400, 'Either token or code is required');
    }
  } catch (error) {
    logger.error('Google OAuth verification failed:', error);
    throw new ApiError(401, 'Invalid Google credentials');
  }
  
  const { googleId, email, firstName, lastName, avatar, emailVerified } = googleUserData;
  
  // Check if user already exists with this Google ID
  let user = await User.findOne({ googleId });
  
  if (user) {
    // User exists with Google ID, log them in
    if (!user.isActive) {
      throw new ApiError(401, 'Account has been deactivated');
    }
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
  } else {
    // Check if user exists with same email but different auth provider
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      if (existingUser.authProvider === 'local') {
        // Link Google account to existing local account
        existingUser.googleId = googleId;
        existingUser.authProvider = 'google';
        existingUser.isEmailVerified = emailVerified;
        if (avatar) {
          existingUser.avatar = { url: avatar };
        }
        existingUser.lastLogin = new Date();
        await existingUser.save();
        user = existingUser;
      } else {
        throw new ApiError(409, 'Account already exists with different authentication method');
      }
    } else {
      // Create new user with Google OAuth
      user = new User({
        firstName,
        lastName,
        email,
        googleId,
        authProvider: 'google',
        isEmailVerified: emailVerified,
        avatar: avatar ? { url: avatar } : undefined,
        lastLogin: new Date()
      });
      
      await user.save();
      
      // Send welcome email
      try {
        await sendEmail({
          to: email,
          subject: 'Welcome to Our E-commerce Platform!',
          template: 'welcome',
          data: {
            name: firstName,
            email: email,
            loginMethod: 'Google'
          }
        });
      } catch (emailError) {
        logger.error('Failed to send welcome email:', emailError);
      }
    }
  }
  
  // Clean expired refresh tokens
  await user.cleanExpiredTokens();
  
  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user._id);
  
  // Save refresh token to user
  user.refreshTokens.push({
    token: refreshToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });
  await user.save();
  
  // Set secure cookie
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
  
  logger.info(`Google OAuth login successful: ${email}`);
  
  res.json(new ApiResponse(200, {
    user: user.toJSON(),
    accessToken,
    isNewUser: !existingUser
  }, 'Google authentication successful'));
});

// Get Google OAuth URL
const getGoogleOAuthUrl = asyncHandler(async (req, res) => {
  const authUrl = getGoogleAuthUrl();
  
  res.json(new ApiResponse(200, {
    authUrl
  }, 'Google OAuth URL generated successfully'));
});

// Handle Google OAuth callback
const googleCallback = asyncHandler(async (req, res) => {
  const { code, state } = req.query;
  
  if (!code) {
    throw new ApiError(400, 'Authorization code is required');
  }
  
  try {
    // Exchange code for tokens and authenticate user
    await googleAuth({ body: { code } }, res);
  } catch (error) {
    logger.error('Google OAuth callback error:', error);
    
    // Redirect to frontend with error
    const errorUrl = `${process.env.FRONTEND_URL}/auth/error?message=${encodeURIComponent(error.message)}`;
    res.redirect(errorUrl);
  }
});


export {
  register,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  googleAuth,
  getGoogleOAuthUrl,
  googleCallback
};


// import jwt from 'jsonwebtoken';
// import crypto from 'crypto';
// import User from '../models/User.js';
// import { asyncHandler } from '../utils/asyncHandler.js';
// import { ApiError } from '../utils/ApiError.js';
// import { ApiResponse } from '../utils/ApiResponse.js';
// import { sendEmail } from '../services/email.service.js';
// import { getRedisClient } from '../config/redis.js';
// import logger from '../utils/logger.js';

// // Generate JWT tokens
// const generateTokens = (userId) => {
//   const accessToken = jwt.sign(
//     { userId },
//     process.env.JWT_SECRET,
//     { expiresIn: process.env.JWT_ACCESS_EXPIRE || '15m' }
//   );
  
//   const refreshToken = jwt.sign(
//     { userId },
//     process.env.JWT_REFRESH_SECRET,
//     { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
//   );
  
//   return { accessToken, refreshToken };
// };

// // Register user
// const register = asyncHandler(async (req, res) => {
//   const { firstName, lastName, email, password } = req.body;
  
//   // Check if user already exists
//   const existingUser = await User.findOne({ email });
//   if (existingUser) {
//     throw new ApiError(409, 'Email already registered');
//   }
  
//   // Create user
//   const user = new User({
//     firstName,
//     lastName,
//     email,
//     password
//   });
  
//   // Generate email verification token
//   const verificationToken = crypto.randomBytes(32).toString('hex');
//   user.emailVerificationToken = verificationToken;
//   user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  
//   await user.save();
  
//   // Send verification email
//   try {
//     await sendEmail({
//       to: email,
//       subject: 'Verify Your Email',
//       template: 'email-verification',
//       data: {
//         name: firstName,
//         verificationLink: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`
//       }
//     });
//   } catch (emailError) {
//     logger.error('Failed to send verification email:', emailError);
//     // Don't throw error, user can still login
//   }
  
//   // Generate tokens
//   const { accessToken, refreshToken } = generateTokens(user._id);
  
//   // Save refresh token to user
//   user.refreshTokens.push({
//     token: refreshToken,
//     expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
//   });
//   await user.save();
  
//   // Set secure cookie
//   res.cookie('refreshToken', refreshToken, {
//     httpOnly: true,
//     secure: process.env.NODE_ENV === 'production',
//     sameSite: 'strict',
//     maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
//   });
  
//   logger.info(`User registered: ${email}`);
  
//   res.status(201).json(new ApiResponse(201, {
//     user: user.toJSON(),
//     accessToken
//   }, 'User registered successfully'));
// });

// // Login user
// const login = asyncHandler(async (req, res) => {
//   const { email, password } = req.body;
  
//   // Find user and check password
//   const user = await User.findOne({ email });
//   if (!user || !(await user.comparePassword(password))) {
//     if (user) {
//       await user.incLoginAttempts();
//     }
//     throw new ApiError(401, 'Invalid credentials');
//   }
  
//   // Check if account is locked
//   if (user.isLocked) {
//     throw new ApiError(423, 'Account temporarily locked due to too many failed login attempts');
//   }
  
//   // Check if user is active
//   if (!user.isActive) {
//     throw new ApiError(401, 'Account has been deactivated');
//   }
  
//   // Reset login attempts on successful login
//   if (user.loginAttempts > 0) {
//     await user.updateOne({
//       $unset: { loginAttempts: 1, lockUntil: 1 }
//     });
//   }
  
//   // Clean expired refresh tokens
//   await user.cleanExpiredTokens();
  
//   // Generate tokens
//   const { accessToken, refreshToken } = generateTokens(user._id);
  
//   // Save refresh token to user
//   user.refreshTokens.push({
//     token: refreshToken,
//     expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
//   });
//   user.lastLogin = new Date();
//   await user.save();
  
//   // Set secure cookie
//   res.cookie('refreshToken', refreshToken, {
//     httpOnly: true,
//     secure: process.env.NODE_ENV === 'production',
//     sameSite: 'strict',
//     maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
//   });
  
//   logger.info(`User logged in: ${email}`);
  
//   res.json(new ApiResponse(200, {
//     user: user.toJSON(),
//     accessToken
//   }, 'Login successful'));
// });

// // Refresh token
// const refreshToken = asyncHandler(async (req, res) => {
//   const { refreshToken: token } = req.body || {};
//   const cookieToken = req.cookies?.refreshToken;
  
//   const refreshTokenToUse = token || cookieToken;
  
//   if (!refreshTokenToUse) {
//     throw new ApiError(401, 'Refresh token required');
//   }
  
//   // Verify refresh token
//   const decoded = jwt.verify(refreshTokenToUse, process.env.JWT_REFRESH_SECRET);
  
//   // Find user and validate refresh token
//   const user = await User.findById(decoded.userId);
//   if (!user || !user.refreshTokens.some(rt => rt.token === refreshTokenToUse)) {
//     throw new ApiError(401, 'Invalid refresh token');
//   }
  
//   // Generate new tokens
//   const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id);
  
//   // Replace old refresh token with new one
//   user.refreshTokens = user.refreshTokens.filter(rt => rt.token !== refreshTokenToUse);
//   user.refreshTokens.push({
//     token: newRefreshToken,
//     expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
//   });
//   await user.save();
  
//   // Set new secure cookie
//   res.cookie('refreshToken', newRefreshToken, {
//     httpOnly: true,
//     secure: process.env.NODE_ENV === 'production',
//     sameSite: 'strict',
//     maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
//   });
  
//   res.json(new ApiResponse(200, {
//     accessToken,
//     refreshToken: newRefreshToken
//   }, 'Token refreshed successfully'));
// });

// // Logout user
// const logout = asyncHandler(async (req, res) => {
//   const { refreshToken: token } = req.body || {};
//   const cookieToken = req.cookies?.refreshToken;
  
//   const refreshTokenToUse = token || cookieToken;
  
//   if (refreshTokenToUse) {
//     // Remove refresh token from user
//     const user = await User.findById(req.user.userId);
//     if (user) {
//       user.refreshTokens = user.refreshTokens.filter(rt => rt.token !== refreshTokenToUse);
//       await user.save();
//     }
    
//     // Add token to Redis blacklist
//     const redis = getRedisClient();
//     await redis.setEx(`blacklist:${refreshTokenToUse}`, 7 * 24 * 60 * 60, 'true');
//   }
  
//   // Clear cookie
//   res.clearCookie('refreshToken');
  
//   logger.info(`User logged out: ${req.user.userId}`);
  
//   res.json(new ApiResponse(200, null, 'Logged out successfully'));
// });

// // Forgot password
// const forgotPassword = asyncHandler(async (req, res) => {
//   const { email } = req.body;
  
//   const user = await User.findOne({ email });
//   if (!user) {
//     throw new ApiError(404, 'User not found');
//   }
  
//   // Generate reset token
//   const resetToken = crypto.randomBytes(32).toString('hex');
//   user.passwordResetToken = resetToken;
//   user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
  
//   await user.save();
  
//   // Send reset email
//   try {
//     await sendEmail({
//       to: email,
//       subject: 'Password Reset Request',
//       template: 'password-reset',
//       data: {
//         name: user.firstName,
//         resetLink: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
//       }
//     });
//   } catch (emailError) {
//     user.passwordResetToken = undefined;
//     user.passwordResetExpires = undefined;
//     await user.save();
//     throw new ApiError(500, 'Email could not be sent');
//   }
  
//   logger.info(`Password reset requested for: ${email}`);
  
//   res.json(new ApiResponse(200, null, 'Password reset email sent'));
// });

// // Reset password
// const resetPassword = asyncHandler(async (req, res) => {
//   const { token, password } = req.body;
  
//   const user = await User.findOne({
//     passwordResetToken: token,
//     passwordResetExpires: { $gt: Date.now() }
//   });
  
//   if (!user) {
//     throw new ApiError(400, 'Invalid or expired reset token');
//   }
  
//   // Update password
//   user.password = password;
//   user.passwordResetToken = undefined;
//   user.passwordResetExpires = undefined;
  
//   // Clear all refresh tokens
//   user.refreshTokens = [];
  
//   await user.save();
  
//   logger.info(`Password reset successful for: ${user.email}`);
  
//   res.json(new ApiResponse(200, null, 'Password reset successful'));
// });

// // Verify email
// const verifyEmail = asyncHandler(async (req, res) => {
//   const { token } = req.query;
  
//   const user = await User.findOne({
//     emailVerificationToken: token,
//     emailVerificationExpires: { $gt: Date.now() }
//   });
  
//   if (!user) {
//     throw new ApiError(400, 'Invalid or expired verification token');
//   }
  
//   // Verify email
//   user.isEmailVerified = true;
//   user.emailVerificationToken = undefined;
//   user.emailVerificationExpires = undefined;
  
//   await user.save();
  
//   logger.info(`Email verified for: ${user.email}`);
  
//   res.json(new ApiResponse(200, null, 'Email verified successfully'));
// });

// // Google OAuth (placeholder)
// const googleAuth = asyncHandler(async (req, res) => {
//   // This would integrate with Google OAuth
//   // For now, return a placeholder response
//   throw new ApiError(501, 'Google OAuth not implemented yet');
// });

// export {
//   register,
//   login,
//   refreshToken,
//   logout,
//   forgotPassword,
//   resetPassword,
//   verifyEmail,
//   googleAuth
// };