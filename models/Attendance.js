const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  // Some existing attendance records use `student` instead of `studentId`.
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  date: { type: Date, required: true },
  status: { type: String, enum: ['present', 'absent'], required: true },
  markedVia: { type: String, enum: ['qr', 'manual'], default: 'manual' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Attendance', attendanceSchema);
