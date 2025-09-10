# BeyondAQI Backend API

Commercial-grade Air Quality Index and Weather API backend built with Node.js and Express.js.

## Environment Setup

### Development Mode
- Allows all localhost connections (any port)
- Perfect for local development and testing
- CORS restrictions relaxed for localhost

### Production Mode  
- Strict CORS policy with domain whitelist
- Enterprise-grade security headers
- Optimized for AWS deployment

## Quick Start

### 1. Clone and Install
```bash
git clone <repo-url>
cd backend
npm install
```

### 2. Environment Configuration
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Run Production Server
```bash
npm run start:prod
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Environment mode (`development`/`production`) | Yes |
| `PORT` | Server port (default: 5000) | No |
| `MONGODB_URI` | MongoDB connection string | Yes |
| `GOOGLE_API_KEY` | Google AQI API key | Yes |
| `WEATHER_API_KEY` | Weather API key | Yes |

## CORS Configuration

**Development (`NODE_ENV=development`)**:
- Allows all `localhost:*` and `127.0.0.1:*` origins
- Perfect for frontend development on any port

**Production (`NODE_ENV=production`)**:
- Strict whitelist: `https://beyond-main-d.vercel.app`
- Maximum security for production deployment

## API Endpoints

- `GET /health` - Health check
- `GET /api/status` - API status
- `GET /api/dropdown/countries` - Countries dropdown
- `GET /api/leaderboard/most-polluted` - Most polluted cities
- `GET /api/historical/:country/:period` - Historical data
- `GET /api/search` - Search locations
- `GET /api/realtime/:country/states` - Real-time state data
- `GET /api/:country/:state/:city` - Location hierarchy

## Scripts

- `npm run dev` - Development with auto-reload
- `npm run start` - Production mode
- `npm run start:dev` - Development mode (no auto-reload)
- `npm run start:prod` - Explicit production mode