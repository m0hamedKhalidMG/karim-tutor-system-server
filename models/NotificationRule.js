const mongoose = require('mongoose');

const notificationRuleSchema = new mongoose.Schema({
  isActive: { type: Boolean, default: false },
  trigger: { type: String, enum: ['per_session', 'weekly', 'monthly'], required: true },
  grade: { type: String, default: 'all' },
  messageTemplate: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('NotificationRule', notificationRuleSchema);
