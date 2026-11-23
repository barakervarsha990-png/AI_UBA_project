require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');
const { initSocket } = require('./services/socketService');
const User = require('./models/User');
const { seedDatabase } = require('./seed/seed');

const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const userRoutes = require('./routes/userRoutes');
const loginEventRoutes = require('./routes/loginEventRoutes');
const fileEventRoutes = require('./routes/fileEventRoutes');
const alertRoutes = require('./routes/alertRoutes');
const simulateRoutes = require('./routes/simulateRoutes');
const fileAccessRoutes = require('./routes/fileAccessRoutes');
const policyRoutes = require('./routes/policyRoutes');
const employeePortalRoutes = require('./routes/employeePortalRoutes');

const app = express();
const server = http.createServer(app);

// ----- Dynamic CORS Origin Validator -----
const isOriginAllowed = (origin) => {
  if (!origin) return true; // Allow non-browser requests (curl, postman, mobile)

  // Local development
  if (
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:') ||
    origin.startsWith('https://localhost:')
  ) {
    return true;
  }

  // Deployed Vercel domains (e.g. https://your-project.vercel.app or preview deploys)
  if (/^https:\/\/[a-zA-Z0-9_\-.]+\.vercel\.app$/.test(origin)) {
    return true;
  }

  // Configured CLIENT_URL (single URL or comma-separated list)
  if (process.env.CLIENT_URL) {
    const origins = process.env.CLIENT_URL.split(',').map((o) => o.trim());
    if (origins.includes(origin) || origins.includes('*')) return true;
  }

  // Default allow in dev or fallback gracefully
  return true;
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'x-simulated-device',
    'x-simulated-time',
    'x-simulated-city',
    'x-simulated-state',
    'x-simulated-country',
    'x-simulated-ip',
  ],
};

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Socket blocked by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// ----- Security & core middleware -----
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use('/api', apiLimiter);

// ----- Health check -----
app.get('/api/health', (req, res) =>
  res.json({
    success: true,
    status: 'ok',
    service: 'insider-threat-backend',
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  })
);

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/login-events', loginEventRoutes);
app.use('/api/file-events', fileEventRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/simulate', simulateRoutes);
app.use('/api/files', fileAccessRoutes);
app.use('/api/settings/policy', policyRoutes);
app.use('/api/employee', employeePortalRoutes);

app.use(notFound);
app.use(errorHandler);

// ----- Socket.IO -----
initSocket(io);

const PORT = process.env.PORT || 5050;

const start = async () => {
  await connectDB();

  // Auto-seed initial demo accounts and policy if database is completely empty
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('[DB] No users found. Auto-seeding initial company policy and demo accounts...');
      await seedDatabase({ clearExisting: false });
    }
  } catch (err) {
    console.warn('[DB] Auto-seed check warning:', err.message);
  }

  server.listen(PORT, () => {
    console.log(`[SERVER] Insider Threat Detection API running on port ${PORT}`);
  });
};

start();

module.exports = { app, server, io };
