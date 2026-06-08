const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const Payment = require('../models/Payment');
const requireTeacher = require('../middleware/requireTeacher');

router.get('/', requireTeacher, async (req, res, next) => {
  try {
    const { month, grade, groupId, status, search } = req.query;
    const filter = {};
    if (month) filter.month = month;
    if (status === 'paid') filter.isPaid = true;
    if (status === 'unpaid') filter.isPaid = false;

    let payments = await Payment.find(filter)
      .populate('studentId', 'fullName grade groupId phone')
      .sort({ createdAt: -1 });

    // Apply grade/group/search filters in memory since we need populated data
    if (grade || groupId || search) {
      payments = payments.filter(p => {
        const s = p.studentId;
        if (!s) return false;
        if (grade && s.grade !== grade) return false;
        if (groupId && String(s.groupId) !== groupId) return false;
        if (search && !s.fullName?.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      });
    }

    res.json({ success: true, data: payments });
  } catch (err) {
    next(err);
  }
});

router.post('/generate/:month', requireTeacher, async (req, res, next) => {
  try {
    const { month } = req.params;
    const { amount = 0 } = req.body;
    const students = await Student.find({ isActive: true });
    let created = 0;
    let skipped = 0;
    for (const student of students) {
      const existing = await Payment.findOne({ studentId: student._id, month });
      if (!existing) {
        await Payment.create({ studentId: student._id, month, amount, isPaid: false });
        created++;
      } else {
        skipped++;
      }
    }
    res.json({ success: true, data: { created, skipped, total: students.length } });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/pay', requireTeacher, async (req, res, next) => {
  try {
    const { amount } = req.body;
    const update = { isPaid: true, paidAt: new Date() };
    if (amount !== undefined) update.amount = amount;
    const payment = await Payment.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!payment) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: payment });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/unpay', requireTeacher, async (req, res, next) => {
  try {
    const payment = await Payment.findByIdAndUpdate(req.params.id, { isPaid: false, paidAt: null }, { new: true });
    if (!payment) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: payment });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/amount', requireTeacher, async (req, res, next) => {
  try {
    const { amount } = req.body;
    const payment = await Payment.findByIdAndUpdate(req.params.id, { amount: Number(amount) || 0 }, { new: true });
    if (!payment) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: payment });
  } catch (err) {
    next(err);
  }
});

router.get('/summary/:month', requireTeacher, async (req, res, next) => {
  try {
    const { month } = req.params;
    const payments = await Payment.find({ month });
    const total = payments.length;
    const paid = payments.filter(p => p.isPaid).length;
    const unpaid = total - paid;
    const collectionRate = total > 0 ? Math.round((paid / total) * 100) : 0;
    const totalIncome = payments.filter(p => p.isPaid).reduce((sum, p) => sum + (p.amount || 0), 0);
    const expectedIncome = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    res.json({
      success: true,
      data: { total, paid, unpaid, collectionRate, totalIncome, expectedIncome }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/income/all', requireTeacher, async (req, res, next) => {
  try {
    const payments = await Payment.find({ isPaid: true }).sort({ month: 1 });
    const monthMap = {};
    payments.forEach(p => {
      if (!monthMap[p.month]) monthMap[p.month] = 0;
      monthMap[p.month] += p.amount || 0;
    });
    const data = Object.keys(monthMap).map(month => ({ month, income: monthMap[month] })).sort((a, b) => a.month.localeCompare(b.month));
    const totalAllTime = data.reduce((sum, d) => sum + d.income, 0);
    res.json({ success: true, data: { monthly: data, totalAllTime } });
  } catch (err) {
    next(err);
  }
});

router.get('/months/list', requireTeacher, async (req, res, next) => {
  try {
    const months = await Payment.distinct('month');
    res.json({ success: true, data: months.sort().reverse() });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
