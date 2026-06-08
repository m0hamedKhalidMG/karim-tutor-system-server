const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const Student = require('../models/Student');
const Schedule = require('../models/Schedule');
const requireTeacher = require('../middleware/requireTeacher');

router.get('/', requireTeacher, async (req, res, next) => {
  try {
    const { grade } = req.query;
    const filter = { isActive: true };
    if (grade) filter.grade = grade;
    const groups = await Group.find(filter).sort({ createdAt: -1 });
    res.json(groups);
  } catch (err) { next(err); }
});

router.post('/', requireTeacher, async (req, res, next) => {
  try {
    const group = await Group.create(req.body);
    res.status(201).json(group);
  } catch (err) { next(err); }
});

router.put('/:id', requireTeacher, async (req, res, next) => {
  try {
    const group = await Group.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!group) return res.status(404).json({ message: 'Not found' });
    res.json(group);
  } catch (err) { next(err); }
});

router.delete('/:id', requireTeacher, async (req, res, next) => {
  try {
    await Group.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});

router.get('/:id/students', requireTeacher, async (req, res, next) => {
  try {
    const students = await Student.find({ groupId: req.params.id, isActive: true });
    res.json(students);
  } catch (err) { next(err); }
});

router.get('/:id/schedules', requireTeacher, async (req, res, next) => {
  try {
    const schedules = await Schedule.find({ groupId: req.params.id, isActive: true }).sort({ dayOfWeek: 1, sessionTime: 1 });
    res.json(schedules);
  } catch (err) { next(err); }
});

module.exports = router;
