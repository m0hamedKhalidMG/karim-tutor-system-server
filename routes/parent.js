const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Payment = require('../models/Payment');
const ExamResult = require('../models/ExamResult');

router.get('/:token', async (req, res, next) => {
  try {
    const student = await Student.findOne({ parentAccessToken: req.params.token, isActive: true }).populate('groupId', 'name');
    if (!student) {
      return res.status(404).json({ message: 'Access not found' });
    }

    const attendance = await Attendance.find({ studentId: student._id }).sort({ date: -1 });
    const payments = await Payment.find({ studentId: student._id }).sort({ month: -1 });
    const examResults = await ExamResult.find({ studentId: student._id }).sort({ createdAt: -1 }).populate('examId', 'title');

    res.json({ student, attendance, payments, examResults });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
