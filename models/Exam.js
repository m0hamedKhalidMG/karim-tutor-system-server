const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
  title: { type: String, required: true },
  grade: { type: String, required: true },
  scheduledAt: Date,
  durationMinutes: { type: Number, required: true },
  isActive: { type: Boolean, default: false },
  questions: [
    {
      questionText: { type: String, required: true },
      options: [String],
      correctIndex: { type: Number, required: true },
      timeLimitSeconds: { type: Number, default: 60 }
    }
  ],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Exam', examSchema);
