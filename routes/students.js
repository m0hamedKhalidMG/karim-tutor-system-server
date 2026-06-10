const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Payment = require('../models/Payment');
const ExamResult = require('../models/ExamResult');
const requireTeacher = require('../middleware/requireTeacher');
const generateParentToken = require('../utils/generateParentToken');

router.get('/students', requireTeacher, async (req, res, next) => {
  try {
    const { grade, search, groupId } = req.query;
    const filter = { isActive: true };
    if (grade) filter.grade = grade;
    if (groupId) filter.groupId = groupId;
    if (search) {
      filter.fullName = { $regex: search, $options: 'i' };
    }
    const students = await Student.find(filter).populate('groupId', 'name').sort({ createdAt: -1 });
    res.json(students);
  } catch (err) {
    next(err);
  }
});

router.post('/students', requireTeacher, async (req, res, next) => {
  try {
    const { fullName, grade, groupId, phone, parentPhone, qrCode } = req.body;
    const parentAccessToken = generateParentToken();
    const student = await Student.create({
      fullName,
      grade,
      groupId,
      phone,
      parentPhone,
      qrCode,
      parentAccessToken
    });
    res.status(201).json(student);
  } catch (err) {
    next(err);
  }
});

router.get('/students/:id', requireTeacher, async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, data: student });
  } catch (err) {
    next(err);
  }
});

router.put('/students/:id', requireTeacher, async (req, res, next) => {
  try {
    const student = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, data: student });
  } catch (err) {
    next(err);
  }
});

router.delete('/students/:id', requireTeacher, async (req, res, next) => {
  try {
    const student = await Student.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.json({ message: 'Student deactivated' });
  } catch (err) {
    next(err);
  }
});

router.get('/students/:id/attendance', requireTeacher, async (req, res, next) => {
  try {
    const attendance = await Attendance.find({ studentId: req.params.id }).sort({ date: -1 });
    res.json({ success: true, data: attendance });
  } catch (err) {
    next(err);
  }
});

router.get('/students/:id/payments', requireTeacher, async (req, res, next) => {
  try {
    const payments = await Payment.find({ studentId: req.params.id }).sort({ month: -1 });
    res.json({ success: true, data: payments });
  } catch (err) {
    next(err);
  }
});

router.get('/students/:id/results', requireTeacher, async (req, res, next) => {
  try {
    const results = await ExamResult.find({ studentId: req.params.id }).sort({ createdAt: -1 }).populate('examId', 'title');
    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
