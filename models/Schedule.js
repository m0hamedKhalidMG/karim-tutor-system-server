const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  grade: { type: String, required: true },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  dayOfWeek: { type: String, enum: ['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday'] },
  sessionTime: String, // e.g. "16:00"
  bufferMinutes: { type: Number, default: 20 }, // auto-mark absent after this buffer
  isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model('Schedule', scheduleSchema);
