const mongoose = require('mongoose');

const notificationLogSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  attendanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Attendance' },
  parentPhone: { type: String, required: true },
  message: { type: String, required: true },
  sentAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['sent', 'failed'], required: true },
  errorMessage: { type: String, default: null },
  trigger: { type: String, enum: ['manual', 'per_session', 'weekly', 'monthly'] },
  month: { type: String },
  weekOf: { type: String }
});

notificationLogSchema.index({ studentId: 1, sentAt: -1 });
notificationLogSchema.index({ month: 1, status: 1 });

module.exports = mongoose.model('NotificationLog', notificationLogSchema);
