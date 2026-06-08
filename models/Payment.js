const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  month: { type: String, required: true },
  amount: { type: Number, default: 0 },
  isPaid: { type: Boolean, default: false },
  paidAt: Date,
  notes: String,
  createdAt: { type: Date, default: Date.now }
});

// Compound unique index to prevent duplicate payments per student per month
paymentSchema.index({ studentId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Payment', paymentSchema);
