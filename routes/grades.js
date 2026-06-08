const express = require('express');
const router = express.Router();
const Grade = require('../models/Grade');
const requireTeacher = require('../middleware/requireTeacher');

router.get('/', requireTeacher, async (req, res, next) => {
  try {
    const grades = await Grade.find({ isActive: true }).sort({ order: 1, name: 1 });
    res.json({ success: true, data: grades });
  } catch (err) {
    next(err);
  }
});

router.get('/all', requireTeacher, async (req, res, next) => {
  try {
    const grades = await Grade.find().sort({ order: 1, name: 1 });
    res.json({ success: true, data: grades });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireTeacher, async (req, res, next) => {
  try {
    const grade = await Grade.create(req.body);
    res.status(201).json({ success: true, data: grade });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireTeacher, async (req, res, next) => {
  try {
    const grade = await Grade.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!grade) return res.status(404).json({ success: false, message: 'Grade not found' });
    res.json({ success: true, data: grade });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireTeacher, async (req, res, next) => {
  try {
    const grade = await Grade.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!grade) return res.status(404).json({ success: false, message: 'Grade not found' });
    res.json({ success: true, data: grade });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
