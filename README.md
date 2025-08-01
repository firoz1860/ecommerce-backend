# E-commerce Backend Platform

A complete, production-ready e-commerce backend platform built with Node.js, Express, MongoDB, and Redis. Features real-time order tracking, comprehensive authentication, payment processing, and administrative tools.

## ✨ Features

### 🔐 Authentication & Security
- JWT-based authentication with access and refresh tokens
- bcrypt password hashing with salt rounds
- Account lockout after failed login attempts
- Email verification and password reset
- Role-based access control (Customer, Admin, Seller)
- Rate limiting and security headers

### 📦 Product Management
- Complete product CRUD operations
- Category and subcategory management
- Product variants and inventory tracking
- Advanced search and filtering
- Image upload with Cloudinary integration
- Product reviews and ratings

### 🛒 Shopping Cart & Orders
- Real-time cart management with Redis locking
- Comprehensive order lifecycle management
- Order status tracking with history
- Payment integration with Stripe
- Shipping address management
- Order cancellation and refunds

### 👨‍💼 Administrative Tools
- Admin dashboard with metrics
- Bulk product import via CSV
- Inventory management
- User management
- Order management
- Analytics and reporting

### 🔄 Real-time Features
- Socket.io for real-time order updates
- Live inventory alerts
- Customer support chat
- Order status notifications

### 🧪 Testing & Quality
- Comprehensive test suite with Jest
- 80%+ code coverage
- Unit and integration tests
- ESLint and Prettier for code quality
- Pre-commit hooks with Husky

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- MongoDB 7.0+
- Redis 7.0+
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd ecommerce-backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment setup**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start services with Docker** (Recommended)
```bash
npm run docker:up
```

Or **start manually**:
```bash
# Start MongoDB and Redis locally
# Then run:
npm run dev
```

5. **Seed the database**
```bash
npm run seed
```

6. **Run tests**
```bash
npm test
```

## 🐳 Docker Setup

### Development Environment
```bash
# Start all services
npm run docker:up

# View logs
docker-compose logs -f

# Stop services
npm run docker:down
```

### Production Build
```bash
# Build production image
npm run docker:build

# Run with production compose
docker-compose -f docker-compose.prod.yml up -d
```

## 📊 API Documentation

Once the server is running, access the interactive API documentation at:
- **Swagger UI**: `http://localhost:3000/api-docs`

### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/google` - Google OAuth login
- `GET /api/auth/google/url` - Get Google OAuth URL
- `GET /api/auth/google/callback` - Google OAuth callback
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh-token` - Refresh access token
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

### Product Endpoints
- `GET /api/products` - Get products with filtering and search
- `POST /api/products` - Create new product (Admin/Seller)
- `GET /api/products/:id` - Get product details
- `PUT /api/products/:id` - Update product (Admin/Seller)
- `DELETE /api/products/:id` - Delete product (Admin)

### Order Endpoints
- `POST /api/orders` - Create new order
- `GET /api/orders` - Get user orders
- `GET /api/orders/:id` - Get order details
- `PUT /api/orders/:id/cancel` - Cancel order
- `POST /api/orders/:id/refund` - Process refund (Admin)

### Cart Endpoints
- `GET /api/cart` - Get user cart
- `POST /api/cart/items` - Add item to cart
- `PUT /api/cart/items/:productId` - Update cart item
- `DELETE /api/cart/items/:productId` - Remove cart item

## 🛠️ Environment Variables

Key environment variables (see `.env.example` for complete list):

```env
# Server
NODE_ENV=development
PORT=3000
BASE_URL=http://localhost:3000

# Database
MONGODB_URI=mongodb://localhost:27017/ecommerce
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-jwt-refresh-secret

# Email
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-email-password
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Payment
STRIPE_SECRET_KEY=sk_test_your-stripe-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# File Upload
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

## 🧪 Testing

### Run All Tests
```bash
npm test
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Test Structure
- `tests/unit/` - Unit tests for models, utilities
- `tests/integration/` - API endpoint tests
- `tests/setup.js` - Test environment setup

## 📈 Monitoring & Logging

### Application Logs
- Development: Console output with colors
- Production: File-based logging with rotation
- Error tracking with Winston

### Health Check
```bash
curl http://localhost:3000/health
```

### Database Management
- MongoDB Express: `http://localhost:8081`
- Redis Commander: `http://localhost:8082`

## 🔧 Development Tools

### Code Quality
```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

### Pre-commit Hooks
Husky runs linting and formatting before commits:
- ESLint for code linting
- Prettier for code formatting
- Lint-staged for staged files only

## 🚀 Deployment

### CI/CD Pipeline
GitHub Actions workflow included:
1. **Lint** - Code quality checks
2. **Test** - Run test suite
3. **Build** - Create production build
4. **Deploy** - Deploy to production

### Production Checklist
- [ ] Set secure environment variables
- [ ] Configure SSL certificates
- [ ] Set up monitoring and alerting
- [ ] Configure backup strategy
- [ ] Set up logging aggregation
- [ ] Configure CDN for static assets

## 📚 Database Schema

### Users Collection
- Authentication and profile information
- Address book management
- Wishlist functionality
- Role-based permissions

### Products Collection
- Product details and variants
- Inventory management
- Reviews and ratings
- Search optimization

### Orders Collection
- Complete order lifecycle
- Payment tracking
- Shipping information
- Status history

### Categories Collection
- Hierarchical category structure
- Product organization
- SEO optimization

## 🔌 Socket.io Events

### Client Events
- `trackOrder` - Subscribe to order updates
- `joinSupport` - Join customer support chat
- `supportMessage` - Send support message

### Server Events
- `orderStatusUpdate` - Order status changed
- `inventoryAlert` - Low stock notification
- `supportMessage` - Support chat message

## 📱 Integration Examples

### Frontend Integration
```javascript
// Login example
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

// Add to cart
const response = await fetch('/api/cart/items', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({ productId, quantity })
});
```

### WebSocket Connection
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: { token: accessToken }
});

socket.on('orderStatusUpdate', (data) => {
  console.log('Order updated:', data);
});
```

### Google OAuth Integration
```javascript
// Frontend Google Sign-In integration
const handleGoogleSignIn = async (googleToken) => {
  const response = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: googleToken })
  });
  
  const data = await response.json();
  if (data.success) {
    // Store access token and redirect user
    localStorage.setItem('accessToken', data.data.accessToken);
    window.location.href = '/dashboard';
  }
};

// Server-side OAuth flow
const initiateGoogleOAuth = async () => {
  const response = await fetch('/api/auth/google/url');
  const data = await response.json();
  
  // Redirect user to Google OAuth
  window.location.href = data.data.authUrl;
};
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Follow the existing code style
4. Add tests for new features
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🐛 Issues & Support

For issues and feature requests, please use the GitHub issue tracker.

## 🎯 Performance Optimization

- Redis caching for frequently accessed data
- Database indexing for optimal query performance
- Image optimization with Cloudinary
- Compression middleware for API responses
- Rate limiting to prevent abuse

## 🔒 Security Features

- Helmet.js for security headers
- CORS configuration
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CSRF protection

---

**Happy Coding! 🎉**

For more information, visit the [API Documentation](http://localhost:3000/api-docs) when the server is running.
