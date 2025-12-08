# Ascendia - Testing & Deployment Framework

## Overview

This repository contains a comprehensive testing framework and deployment configuration for Ascendia, a Personalized Voice Agent (PVA) that learns and adapts to users' natural writing styles.

## 📋 Testing Framework

### Unit Testing (Vitest)
- **Framework**: Vitest with React Testing Library
- **Coverage**: 80% threshold for branches, functions, lines, and statements
- **Features**:
  - Component testing with mocks
  - AI service testing utilities
  - Server Action testing patterns
  - Streaming functionality tests
  - Performance monitoring

### End-to-End Testing (Playwright)
- **Browsers**: Chromium, Firefox, WebKit
- **Mobile**: iPhone 12, Pixel 5 testing
- **Features**:
  - Authentication flows
  - AI generation workflows
  - Visual regression testing
  - Accessibility testing
  - Performance testing

### Security Testing
- **Input Validation**: SQL injection, XSS, prompt injection protection
- **Rate Limiting**: IP-based and user-based limits
- **CSRF Protection**: Token-based validation
- **Content Sanitization**: HTML, JSON, and plain text sanitization

## 🚀 Deployment Configuration

### Vercel Deployment
- **Framework**: Next.js 14.x with App Router
- **Environment**: Production optimizations enabled
- **Features**:
  - Edge function support
  - Automatic HTTPS
  - Global CDN
  - Serverless functions

### CI/CD Pipeline (GitHub Actions)
- **Test Suite**: Unit, integration, E2E, security, accessibility
- **Performance**: Lighthouse CI, bundle analysis
- **Security**: Dependency scanning, CodeQL analysis
- **Deployment**: Automated staging and production deployments

## 📊 Monitoring & Analytics

### Error Tracking (Sentry)
- **Client**: Browser error tracking with session replay
- **Server**: API error monitoring with context
- **Edge**: Edge function error tracking

### Performance Monitoring
- **Core Web Vitals**: LCP, FID, CLS tracking
- **Bundle Analysis**: Real-time chunk monitoring
- **Health Checks**: Database, AI service, memory monitoring

### Analytics (PostHog + Google Analytics)
- **User Behavior**: Page views, feature usage, conversion tracking
- **AI Metrics**: Draft generation, acceptance rates, CPL scores
- **Performance**: Load times, error rates, user engagement

## 🔧 Getting Started

### Prerequisites
- Node.js 18+ or 20+
- npm or yarn
- Git

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd ascendia

# Install dependencies
npm ci

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your values

# Initialize the database
npx supabase start
npx supabase db reset

# Run development server
npm run dev
```

### Environment Variables

Required environment variables:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI Services
ANTHROPIC_API_KEY=your_anthropic_api_key

# Authentication
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000

# Monitoring (Optional)
SENTRY_DSN=your_sentry_dsn
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key
```

## 🧪 Running Tests

### Unit Tests
```bash
# Run unit tests
npm run test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch

# UI mode
npm run test:ui
```

### End-to-End Tests
```bash
# Run E2E tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug
```

### Security Tests
```bash
# Run security-specific tests
npm run test -- tests/security

# Run all tests including security
npm run test
```

## 📦 Build & Deployment

### Local Build
```bash
# Build for production
npm run build

# Analyze bundle
npm run analyze

# Start production server
npm run start
```

### Deployment
Deployment is automated through GitHub Actions:

1. **Push to `develop`**: Deploys to staging
2. **Push to `main`**: Deploys to production
3. **Manual deployment**: Use GitHub Actions workflow dispatch

## 🔍 Monitoring & Debugging

### Health Checks
- `/api/health` - Basic health check
- `/healthz` - Detailed system health

### Performance Monitoring
- Bundle analysis reports in `.next/analyze/`
- Lighthouse reports in CI/CD
- Real-time performance metrics in browser console (development)

### Error Tracking
- Sentry dashboard for error monitoring
- Console logs in development mode
- Performance metrics in PostHog

## 🛡️ Security Features

### Input Validation
- Zod schemas for type-safe validation
- Dangerous pattern detection
- Content sanitization

### Rate Limiting
- User-based rate limits
- IP-based rate limits
- Automatic suspicious activity detection

### Security Headers
- Content Security Policy
- HSTS, X-Frame-Options, X-Content-Type-Options
- CSRF protection

## 📈 Performance Optimization

### Bundle Optimization
- Code splitting by route and feature
- Dynamic imports for heavy components
- Tree shaking for unused code
- Compression and minification

### Runtime Optimization
- Service worker for caching
- Image optimization with Next.js
- Font optimization and preloading
- Critical resource preloading

## 🔄 Development Workflow

### Code Quality
```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Formatting
npm run format

# Format check
npm run format:check
```

### Git Hooks
Pre-commit hooks ensure:
- Code formatting with Prettier
- Linting with ESLint
- Type checking with TypeScript
- Basic test validation

## 📚 Testing Guidelines

### Unit Testing
- Test business logic and utilities
- Mock external dependencies
- Focus on edge cases and error handling
- Maintain 80%+ code coverage

### Integration Testing
- Test Server Actions end-to-end
- Test database operations
- Test AI service integrations
- Test authentication flows

### End-to-End Testing
- Test critical user journeys
- Test across different browsers and devices
- Test accessibility requirements
- Test performance benchmarks

## 🚨 Troubleshooting

### Common Issues

1. **Tests failing in CI**:
   - Check environment variables
   - Verify test database is accessible
   - Check for timing issues in E2E tests

2. **Build failures**:
   - Check TypeScript errors
   - Verify all dependencies are installed
   - Check environment variable configuration

3. **Performance issues**:
   - Run bundle analysis: `npm run analyze`
   - Check Core Web Vitals in Lighthouse
   - Review performance metrics in monitoring

### Getting Help
- Check GitHub Issues for known problems
- Review CI/CD logs for detailed error information
- Check monitoring dashboards for performance insights

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

The automated CI/CD pipeline will:
- Run the full test suite
- Check code quality
- Perform security scans
- Deploy to staging for review