const mongoose = require('mongoose');

const examResultSchema = new mongoose.Schema({
  examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  studentName: String,
  startedAt: Date,
  submittedAt: Date,
  answers: [
    {
      questionIndex: Number,
      selectedIndex: Number,
      answeredAt: Date
    }
  ],
  score: Number,
  totalQuestions: Number,
  percentageScore: Number,
  flagged: { type: Boolean, default: false },
  flagReasons: [String],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ExamResult', examResultSchema);
