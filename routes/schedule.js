const express = require('express');
const router = express.Router();
const Schedule = require('../models/Schedule');
const requireTeacher = require('../middleware/requireTeacher');

router.get('/', requireTeacher, async (req, res, next) => {
  try {
    const { groupId } = req.query;
    const filter = { isActive: true };
    if (groupId) filter.groupId = groupId;
    const items = await Schedule.find(filter).populate('groupId', 'name grade').sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireTeacher, async (req, res, next) => {
  try {
    const item = await Schedule.create(req.body);
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireTeacher, async (req, res, next) => {
  try {
    const item = await Schedule.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).json({ message: 'Not found' });
    res.json(item);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireTeacher, async (req, res, next) => {
  try {
    const item = await Schedule.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!item) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
