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
    const { fullName, grade, phone, parentPhone } = req.body;
    const qrCode = String(req.body.qrCode || '').trim();
    const groupId = req.body.groupId || undefined;

    if (!fullName?.trim() || !grade?.trim() || !qrCode) {
      return res.status(400).json({ message: 'fullName, grade, and qrCode are required' });
    }

    const existing = await Student.findOne({ qrCode });
    if (existing) {
      return res.status(409).json({ message: 'This QR code is already used by another student' });
    }

    const parentAccessToken = generateParentToken();
    const student = await Student.create({
      fullName: fullName.trim(),
      grade: grade.trim(),
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
    const student = await Student.findById(req.params.id).populate('groupId', 'name grade');
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, data: student });
  } catch (err) {
    next(err);
  }
});

router.put('/students/:id', requireTeacher, async (req, res, next) => {
  try {
    const updates = { ...req.body };
    if (updates.qrCode != null) updates.qrCode = String(updates.qrCode).trim();
    if (!updates.groupId) {
      // Allow clearing group by sending empty value
      if (Object.prototype.hasOwnProperty.call(updates, 'groupId')) {
        updates.groupId = null;
      } else {
        delete updates.groupId;
      }
    }

    if (updates.qrCode) {
      const existing = await Student.findOne({ qrCode: updates.qrCode, _id: { $ne: req.params.id } });
      if (existing) {
        return res.status(409).json({ success: false, message: 'This QR code is already used by another student' });
      }
    }

    const student = await Student.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
      .populate('groupId', 'name grade');
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
