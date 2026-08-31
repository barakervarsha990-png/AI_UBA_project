const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI is not defined in environment variables');

    await mongoose.connect(uri);
    console.log(`[DB] MongoDB connected: ${mongoose.connection.host}`);
  } catch (err) {
    console.error('[DB] Connection error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
