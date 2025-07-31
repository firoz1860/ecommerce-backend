import User from '../../../src/models/User.js';
import bcrypt from 'bcrypt';

describe('User Model', () => {
  it('should create a valid user', async () => {
    const userData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      password: 'password123'
    };

    const user = new User(userData);
    const savedUser = await user.save();

    expect(savedUser.firstName).toBe(userData.firstName);
    expect(savedUser.email).toBe(userData.email);
    expect(savedUser.password).not.toBe(userData.password); // Should be hashed
    expect(savedUser.role).toBe('customer'); // Default role
  });

  it('should hash password before saving', async () => {
    const userData = {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      password: 'password123'
    };

    const user = new User(userData);
    await user.save();

    // Password should be hashed
    expect(user.password).not.toBe(userData.password);
    expect(user.password).toMatch(/^\$2[aby]\$\d{2}\$/); // bcrypt hash pattern
  });

  it('should compare passwords correctly', async () => {
    const userData = {
      firstName: 'Bob',
      lastName: 'Johnson',
      email: 'bob@example.com',
      password: 'password123'
    };

    const user = new User(userData);
    await user.save();

    const isMatch = await user.comparePassword('password123');
    const isNotMatch = await user.comparePassword('wrongpassword');

    expect(isMatch).toBe(true);
    expect(isNotMatch).toBe(false);
  });

  it('should require email and password', async () => {
    const user = new User({
      firstName: 'Test',
      lastName: 'User'
    });

    await expect(user.save()).rejects.toThrow();
  });

  it('should not allow duplicate email', async () => {
    const userData = {
      firstName: 'User',
      lastName: 'One',
      email: 'duplicate@example.com',
      password: 'password123'
    };

    const user1 = new User(userData);
    await user1.save();

    const user2 = new User({
      ...userData,
      firstName: 'User',
      lastName: 'Two'
    });

    await expect(user2.save()).rejects.toThrow();
  });

  it('should return full name virtual', async () => {
    const user = new User({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      password: 'password123'
    });

    expect(user.fullName).toBe('John Doe');
  });

  it('should handle login attempts correctly', async () => {
    const user = new User({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: 'password123'
    });

    await user.save();

    // Increment login attempts
    await user.incLoginAttempts();
    const updatedUser = await User.findById(user._id);

    expect(updatedUser.loginAttempts).toBe(1);
  });

  it('should clean expired refresh tokens', async () => {
    const user = new User({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: 'password123'
    });

    // Add expired and valid tokens
    user.refreshTokens = [
      {
        token: 'expired-token',
        expiresAt: new Date(Date.now() - 1000) // Expired
      },
      {
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 86400000) // Valid
      }
    ];

    await user.save();
    await user.cleanExpiredTokens();

    expect(user.refreshTokens).toHaveLength(1);
    expect(user.refreshTokens[0].token).toBe('valid-token');
  });
});