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

const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const userRoutes = require('./routes/userRoutes');
const loginEventRoutes = require('./routes/loginEventRoutes');
const fileEventRoutes = require('./routes/fileEventRoutes');
const alertRoutes = require('./routes/alertRoutes');
const simulateRoutes = require('./routes/simulateRoutes');

const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

const io = new Server(server, {
  cors: { origin: CLIENT_URL, methods: ['GET', 'POST'] },
});

// ----- Security & core middleware -----
app.use(helmet());
app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use('/api', apiLimiter);

// ----- Routes -----
app.get('/api/health', (req, res) => res.json({ success: true, status: 'ok', service: 'insider-threat-backend' }));
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/login-events', loginEventRoutes);
app.use('/api/file-events', fileEventRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/simulate', simulateRoutes);

app.use(notFound);
app.use(errorHandler);

// ----- Socket.IO -----
initSocket(io);

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`[SERVER] Insider Threat Detection API running on port ${PORT}`);
  });
};

start();

module.exports = { app, server, io };
