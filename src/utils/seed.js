import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import 'dotenv/config';

// Import models
import User from '../models/User.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import logger from './logger.js';

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce');
    logger.info('✅ Database connected for seeding');
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    process.exit(1);
  }
};

const seedUsers = async () => {
  try {
    // Clear existing users
    await User.deleteMany({});
    
    const users = [
      {
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@example.com',
        password: 'admin123456',
        role: 'admin',
        isEmailVerified: true,
        isActive: true
      },
      {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'customer123456',
        role: 'customer',
        isEmailVerified: true,
        isActive: true
      },
      {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        password: 'customer123456',
        role: 'customer',
        isEmailVerified: true,
        isActive: true
      },
      {
        firstName: 'Bob',
        lastName: 'Johnson',
        email: 'bob@example.com',
        password: 'customer123456',
        role: 'customer',
        isEmailVerified: true,
        isActive: true
      },
      {
        firstName: 'Alice',
        lastName: 'Brown',
        email: 'alice@example.com',
        password: 'customer123456',
        role: 'customer',
        isEmailVerified: true,
        isActive: true
      }
    ];
    
    await User.insertMany(users);
    logger.info('✅ Users seeded successfully');
  } catch (error) {
    logger.error('❌ Users seeding failed:', error);
  }
};

const seedCategories = async () => {
  try {
    // Clear existing categories
    await Category.deleteMany({});
    
    const categories = [
      {
        name: 'Electronics',
        description: 'Electronic devices and gadgets',
        slug: 'electronics',
        level: 0,
        sortOrder: 1
      },
      {
        name: 'Clothing',
        description: 'Fashion and apparel',
        slug: 'clothing',
        level: 0,
        sortOrder: 2
      },
      {
        name: 'Books',
        description: 'Books and literature',
        slug: 'books',
        level: 0,
        sortOrder: 3
      },
      {
        name: 'Sports',
        description: 'Sports and outdoor equipment',
        slug: 'sports',
        level: 0,
        sortOrder: 4
      },
      {
        name: 'Home & Garden',
        description: 'Home improvement and garden supplies',
        slug: 'home-garden',
        level: 0,
        sortOrder: 5
      },
      {
        name: 'Health & Beauty',
        description: 'Health and beauty products',
        slug: 'health-beauty',
        level: 0,
        sortOrder: 6
      },
      {
        name: 'Toys & Games',
        description: 'Toys and games for all ages',
        slug: 'toys-games',
        level: 0,
        sortOrder: 7
      },
      {
        name: 'Automotive',
        description: 'Car parts and accessories',
        slug: 'automotive',
        level: 0,
        sortOrder: 8
      },
      {
        name: 'Food & Beverages',
        description: 'Food and drink items',
        slug: 'food-beverages',
        level: 0,
        sortOrder: 9
      },
      {
        name: 'Office Supplies',
        description: 'Office and business supplies',
        slug: 'office-supplies',
        level: 0,
        sortOrder: 10
      }
    ];
    
    await Category.insertMany(categories);
    logger.info('✅ Categories seeded successfully');
  } catch (error) {
    logger.error('❌ Categories seeding failed:', error);
  }
};

const seedProducts = async () => {
  try {
    // Clear existing products
    await Product.deleteMany({});
    
    const categories = await Category.find({});
    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat.slug] = cat._id;
    });
    
    const products = [
      {
        name: 'iPhone 15 Pro',
        description: 'Latest iPhone with advanced camera system and A17 Pro chip',
        price: 999.99,
        category: categoryMap['electronics'],
        brand: 'Apple',
        sku: 'IPHONE15PRO001',
        stock: 50,
        images: [
          {
            url: 'https://images.pexels.com/photos/788946/pexels-photo-788946.jpeg',
            alt: 'iPhone 15 Pro',
            isMain: true
          }
        ],
        tags: ['smartphone', 'apple', 'ios', 'camera'],
        features: ['5G Compatible', 'Wireless Charging', 'Water Resistant'],
        rating: { average: 4.8, count: 245 },
        isFeatured: true
      },
      {
        name: 'Samsung Galaxy S24 Ultra',
        description: 'Premium Android smartphone with S Pen and advanced AI features',
        price: 1199.99,
        category: categoryMap['electronics'],
        brand: 'Samsung',
        sku: 'GALAXY24ULTRA001',
        stock: 30,
        images: [
          {
            url: 'https://images.pexels.com/photos/1092644/pexels-photo-1092644.jpeg',
            alt: 'Samsung Galaxy S24 Ultra',
            isMain: true
          }
        ],
        tags: ['smartphone', 'samsung', 'android', 'spen'],
        features: ['S Pen Included', '5G Compatible', 'Water Resistant'],
        rating: { average: 4.7, count: 189 }
      },
      {
        name: 'MacBook Pro 14-inch',
        description: 'Professional laptop with M3 chip and Liquid Retina XDR display',
        price: 1999.99,
        category: categoryMap['electronics'],
        brand: 'Apple',
        sku: 'MACBOOKPRO14001',
        stock: 25,
        images: [
          {
            url: 'https://images.pexels.com/photos/812264/pexels-photo-812264.jpeg',
            alt: 'MacBook Pro 14-inch',
            isMain: true
          }
        ],
        tags: ['laptop', 'apple', 'macbook', 'professional'],
        features: ['M3 Chip', 'Liquid Retina XDR Display', 'All-day Battery'],
        rating: { average: 4.9, count: 156 },
        isFeatured: true
      },
      {
        name: 'Nike Air Max 270',
        description: 'Comfortable running shoes with Air Max technology',
        price: 129.99,
        category: categoryMap['clothing'],
        brand: 'Nike',
        sku: 'AIRMAX270001',
        stock: 100,
        images: [
          {
            url: 'https://images.pexels.com/photos/1464625/pexels-photo-1464625.jpeg',
            alt: 'Nike Air Max 270',
            isMain: true
          }
        ],
        tags: ['shoes', 'nike', 'running', 'sports'],
        features: ['Air Max Technology', 'Lightweight', 'Breathable'],
        rating: { average: 4.6, count: 312 }
      },
      {
        name: 'Levi\'s 501 Original Jeans',
        description: 'Classic straight-leg jeans with timeless style',
        price: 79.99,
        category: categoryMap['clothing'],
        brand: 'Levi\'s',
        sku: 'LEVIS501001',
        stock: 75,
        images: [
          {
            url: 'https://images.pexels.com/photos/1598507/pexels-photo-1598507.jpeg',
            alt: 'Levi\'s 501 Original Jeans',
            isMain: true
          }
        ],
        tags: ['jeans', 'levis', 'denim', 'classic'],
        features: ['100% Cotton', 'Classic Fit', 'Durable'],
        rating: { average: 4.4, count: 528 }
      }
    ];
    
    // Add more products to reach 50 total
    const additionalProducts = [];
    const productNames = [
      'Wireless Bluetooth Headphones', 'Smart Watch', 'Gaming Keyboard',
      'USB-C Cable', 'Portable Charger', 'Wireless Mouse', 'Laptop Stand',
      'Coffee Maker', 'Yoga Mat', 'Resistance Bands', 'Dumbbells Set',
      'Protein Powder', 'Vitamins', 'Face Moisturizer', 'Shampoo',
      'Board Game', 'Puzzle 1000 Pieces', 'Action Figure', 'Remote Control Car',
      'Car Phone Mount', 'Car Charger', 'Tire Pressure Gauge', 'Air Freshener',
      'Organic Honey', 'Green Tea', 'Granola Bars', 'Pasta Sauce',
      'Notebook Set', 'Pen Set', 'Stapler', 'Paper Clips', 'Desk Organizer',
      'Indoor Plant', 'Watering Can', 'Garden Gloves', 'Fertilizer',
      'Throw Pillow', 'Blanket', 'Candles', 'Picture Frame', 'Wall Art',
      'Backpack', 'Water Bottle', 'Sunglasses', 'Baseball Cap', 'Socks Set'
    ];
    
    const brands = ['Generic', 'ProBrand', 'QualityPlus', 'BestChoice', 'Premium'];
    const categoryKeys = Object.keys(categoryMap);
    
    for (let i = 0; i < 45; i++) {
      const randomCategory = categoryKeys[Math.floor(Math.random() * categoryKeys.length)];
      const randomBrand = brands[Math.floor(Math.random() * brands.length)];
      const basePrice = Math.floor(Math.random() * 200) + 10;
      
      additionalProducts.push({
        name: productNames[i],
        description: `Quality ${productNames[i].toLowerCase()} for everyday use`,
        price: basePrice,
        category: categoryMap[randomCategory],
        brand: randomBrand,
        sku: `PROD${String(i + 6).padStart(3, '0')}`,
        stock: Math.floor(Math.random() * 100) + 10,
        images: [
          {
            url: `https://images.pexels.com/photos/${Math.floor(Math.random() * 1000000) + 100000}/pexels-photo-${Math.floor(Math.random() * 1000000) + 100000}.jpeg`,
            alt: productNames[i],
            isMain: true
          }
        ],
        tags: [productNames[i].toLowerCase().replace(/\s+/g, '-')],
        features: ['Quality Materials', 'Durable Construction', 'Great Value'],
        rating: { 
          average: Math.round((Math.random() * 2 + 3) * 10) / 10, 
          count: Math.floor(Math.random() * 100) + 5 
        }
      });
    }
    
    await Product.insertMany([...products, ...additionalProducts]);
    logger.info('✅ Products seeded successfully');
  } catch (error) {
    logger.error('❌ Products seeding failed:', error);
  }
};

const seedDatabase = async () => {
  try {
    await connectDB();
    
    logger.info('🌱 Starting database seeding...');
    
    await seedUsers();
    await seedCategories();
    await seedProducts();
    
    logger.info('✅ Database seeding completed successfully!');
    
    // Display seeded data counts
    const userCount = await User.countDocuments();
    const categoryCount = await Category.countDocuments();
    const productCount = await Product.countDocuments();
    
    logger.info(`📊 Seeded Data Summary:`);
    logger.info(`   Users: ${userCount}`);
    logger.info(`   Categories: ${categoryCount}`);
    logger.info(`   Products: ${productCount}`);
    
  } catch (error) {
    logger.error('❌ Database seeding failed:', error);
  } finally {
    await mongoose.connection.close();
    logger.info('📴 Database connection closed');
    process.exit(0);
  }
};

// Run seeding if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase();
}

export default seedDatabase;