require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const scheduleRoutes = require('./routes/schedule');
const attendanceRoutes = require('./routes/attendance');
const paymentRoutes = require('./routes/payments');
const examRoutes = require('./routes/exams');
const parentRoutes = require('./routes/parent');
const groupRoutes = require('./routes/groups');
const gradeRoutes = require('./routes/grades');
const notificationRoutes = require('./routes/notifications');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/teacher', studentRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/parent', parentRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/grades', gradeRoutes);
app.use('/api/notifications', notificationRoutes);

app.use(errorHandler);

// Cached MongoDB connection for serverless environments
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }
  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGO_URI).then(() => {
      console.log('MongoDB connected');
      return mongoose.connection;
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

// Connect immediately but don't block export
connectDB().catch(err => {
  console.error('MongoDB connection error:', err);
});

module.exports = app;
