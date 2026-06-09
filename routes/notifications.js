const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Schedule = require('../models/Schedule');
const NotificationLog = require('../models/NotificationLog');
const NotificationRule = require('../models/NotificationRule');
const requireTeacher = require('../middleware/requireTeacher');
const { formatEgyptianPhone } = require('../utils/formatPhone');
const { resolveTemplate } = require('../utils/resolveTemplate');
const { sendWhatsApp } = require('../utils/sendWhatsApp');
const moment = require('moment-timezone');

const EGYPT_TZ = 'Africa/Cairo';

function getWeekBounds(weekStr) {
  const [year, week] = weekStr.split('-').map(Number);
  const start = moment().year(year).week(week).startOf('isoWeek').tz(EGYPT_TZ).startOf('day').toDate();
  const end = moment().year(year).week(week).endOf('isoWeek').tz(EGYPT_TZ).endOf('day').toDate();
  return { start, end };
}

function getMonthBounds(monthStr) {
  const [year, mon] = monthStr.split('-').map(Number);
  const start = new Date(year, mon - 1, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(year, mon, 0, 23, 59, 59, 999);
  return { start, end };
}

function getDayBounds(dateStr) {
  const d = new Date(dateStr);
  const start = new Date(d); start.setHours(0, 0, 0, 0);
  const end = new Date(d); end.setHours(23, 59, 59, 999);
  return { start, end };
}

function countScheduledSessionsForGrade(grade, start, end, schedules) {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow = dayNames[cur.getDay()];
    if (dow !== 'Friday') {
      const hasSession = schedules.some(s => s.grade === grade && s.dayOfWeek === dow);
      if (hasSession) count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// Default templates
const defaultTemplates = {
  per_session: `السلام عليكم ورحمة الله،\nنود إعلامكم بأن ابنكم/ابنتكم {{studentName}} من {{grade}} لم يحضر حصة اليوم {{date}}.\nيرجى التواصل مع الأستاذ {{teacherName}} لمعرفة التفاصيل.\nشكراً لتعاونكم 🙏`,
  weekly: `السلام عليكم ورحمة الله،\nتقرير الحضور الأسبوعي لابنكم/ابنتكم {{studentName}} من {{grade}}:\nعدد الغيابات هذا الأسبوع: {{absenceCount}} من أصل {{totalSessions}} حصص.\nللاستفسار تواصلوا مع الأستاذ {{teacherName}}.\nشكراً 🙏`,
  monthly: `السلام عليكم ورحمة الله،\nتقرير الحضور الشهري لابنكم/ابنتكم {{studentName}} من {{grade}}:\nإجمالي الغيابات هذا الشهر: {{absenceCount}} من أصل {{totalSessions}} حصص.\nيرجى الاهتمام بانتظام الحضور للحفاظ على مستوى الطالب.\nمع تحيات الأستاذ {{teacherName}} 🎓`,
  exam_result: `السلام عليكم ورحمة الله،\nنود إعلامكم بنتيجة امتحان {{examTitle}} لابنكم/ابنتكم {{studentName}} من {{grade}}.\nالدرجة: {{score}} من {{total}} ({{percentage}}%).\nمع تحيات الأستاذ {{teacherName}} 🎓`,
  payment_late: `السلام عليكم ورحمة الله،\nنود تذكيركم بأن اشتراك ابنكم/ابنتكم {{studentName}} من {{grade}} عن شهر {{month}} لم يتم سداده بعد.\nالمبلغ المستحق: {{amount}} جنيه.\nيرجى السداد في أقرب وقت ممكن.\nمع تحيات الأستاذ {{teacherName}} 🎓`
};

router.get('/absent-report', requireTeacher, async (req, res, next) => {
  try {
    const { date, week, month, grade, groupId } = req.query;
    let start, end, mode;
    if (date) {
      const b = getDayBounds(date);
      start = b.start; end = b.end; mode = 'date';
    } else if (week) {
      const b = getWeekBounds(week);
      start = b.start; end = b.end; mode = 'week';
    } else if (month) {
      const b = getMonthBounds(month);
      start = b.start; end = b.end; mode = 'month';
    } else {
      return res.status(400).json({ success: false, message: 'Provide date, week, or month' });
    }

    const filter = { date: { $gte: start, $lte: end }, status: 'absent' };
    const absences = await Attendance.find(filter).populate({ path: 'studentId', select: 'fullName grade groupId parentPhone', populate: { path: 'groupId', select: 'name' } }).sort({ date: -1 });

    // Group by student
    const byStudent = {};
    absences.forEach(a => {
      const sid = a.studentId?._id?.toString();
      if (!sid) return;
      if (!byStudent[sid]) {
        byStudent[sid] = {
          student: a.studentId,
          absenceCount: 0,
          dates: []
        };
      }
      byStudent[sid].absenceCount++;
      byStudent[sid].dates.push(a.date);
    });

    // Get total sessions for each student's grade in this period
    const gradeFilter = { isActive: true };
    if (grade && grade !== 'all') {
      const normalized = grade.replace(/^Grade\s*/, '');
      gradeFilter.$or = [
        { grade: grade },
        { grade: normalized },
        { grade: `Grade ${normalized}` }
      ];
    }
    if (groupId) gradeFilter.groupId = groupId;
    const students = await Student.find(gradeFilter).populate('groupId', 'name');
    const studentIds = students.map(s => s._id.toString());

    const schedules = await Schedule.find({ isActive: true });
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const result = await Promise.all(
      Object.values(byStudent).map(async (item) => {
        const sid = item.student._id.toString();
        if (!studentIds.includes(sid)) return null;

        // Count scheduled sessions for this student's grade in period
        let totalSessions = 0;
        const cur = new Date(start);
        while (cur <= end) {
          const dow = dayNames[cur.getDay()];
          if (dow !== 'Friday') {
            const hasSession = schedules.some(s => s.grade === item.student.grade && s.dayOfWeek === dow);
            if (hasSession) totalSessions++;
          }
          cur.setDate(cur.getDate() + 1);
        }

        // Check if already notified
        const logFilter = { studentId: item.student._id, status: 'sent' };
        if (mode === 'date') {
          logFilter.sentAt = { $gte: start, $lte: end };
        } else if (mode === 'week') {
          logFilter.weekOf = week;
        } else if (mode === 'month') {
          logFilter.month = month;
        }
        const alreadyNotified = await NotificationLog.exists(logFilter);

        const absencePct = totalSessions > 0 ? Math.round((item.absenceCount / totalSessions) * 100) : 0;

        return {
          student: {
            _id: item.student._id,
            fullName: item.student.fullName,
            grade: item.student.grade,
            groupId: item.student.groupId,
            parentPhone: item.student.parentPhone
          },
          absenceCount: item.absenceCount,
          totalSessions,
          absencePct,
          dates: item.dates,
          lastAbsence: item.dates[0],
          alreadyNotified: !!alreadyNotified
        };
      })
    );

    const filtered = result.filter(Boolean);
    res.json({ success: true, data: filtered });
  } catch (err) {
    next(err);
  }
});

router.get('/payment-late-report', requireTeacher, async (req, res, next) => {
  try {
    const { month, grade, groupId } = req.query;
    if (!month) {
      return res.status(400).json({ success: false, message: 'month required' });
    }

    const Payment = require('../models/Payment');
    const paymentFilter = { month, isPaid: false };
    const payments = await Payment.find(paymentFilter)
      .populate({ path: 'studentId', select: 'fullName grade groupId parentPhone', populate: { path: 'groupId', select: 'name' } });

    // Apply grade/group filters
    let filtered = payments;
    if (grade && grade !== 'all') {
      const normalized = grade.replace(/^Grade\s*/, '');
      filtered = filtered.filter(p => {
        const g = p.studentId?.grade || '';
        return g === grade || g === normalized || g === `Grade ${normalized}`;
      });
    }
    if (groupId) {
      filtered = filtered.filter(p => String(p.studentId?.groupId?._id) === groupId);
    }

    // Check if already notified for this month
    const result = await Promise.all(
      filtered.map(async (p) => {
        const student = p.studentId;
        if (!student) return null;
        const logFilter = { studentId: student._id, trigger: 'payment_late', month, status: 'sent' };
        const alreadyNotified = await NotificationLog.exists(logFilter);
        return {
          student: {
            _id: student._id,
            fullName: student.fullName,
            grade: student.grade,
            groupId: student.groupId,
            parentPhone: student.parentPhone
          },
          amount: p.amount || 0,
          month: p.month,
          alreadyNotified: !!alreadyNotified
        };
      })
    );

    res.json({ success: true, data: result.filter(Boolean) });
  } catch (err) {
    next(err);
  }
});

router.post('/send', requireTeacher, async (req, res, next) => {
  try {
    const { studentIds, trigger, date, week, month, messageTemplate } = req.body;
    if (!studentIds || !studentIds.length) {
      return res.status(400).json({ success: false, message: 'studentIds required' });
    }

    let start, end, mode, monthStr;
    if (date) {
      const b = getDayBounds(date);
      start = b.start; end = b.end; mode = 'date';
      monthStr = date.slice(0, 7);
    } else if (week) {
      const b = getWeekBounds(week);
      start = b.start; end = b.end; mode = 'week';
      monthStr = moment(start).format('YYYY-MM');
    } else if (month) {
      const b = getMonthBounds(month);
      start = b.start; end = b.end; mode = 'month';
      monthStr = month;
    } else {
      return res.status(400).json({ success: false, message: 'Provide date, week, or month' });
    }

    const inferredTrigger = trigger || (mode === 'date' ? 'per_session' : mode === 'week' ? 'weekly' : 'monthly');
    const rule = await NotificationRule.findOne({ trigger: inferredTrigger, isActive: true });
    const template = messageTemplate || rule?.messageTemplate || defaultTemplates[inferredTrigger] || defaultTemplates.per_session;

    const schedules = await Schedule.find({ isActive: true });

    const results = [];
    for (const sid of studentIds) {
      const student = await Student.findById(sid);
      if (!student || !student.parentPhone) {
        results.push({ studentId: sid, studentName: student?.fullName || 'Unknown', phone: null, status: 'failed', error: 'No parent phone' });
        await NotificationLog.create({
          studentId: sid,
          parentPhone: '',
          message: '',
          status: 'failed',
          errorMessage: 'No parent phone',
          trigger: inferredTrigger,
          month: monthStr
        });
        continue;
      }

      const phone = formatEgyptianPhone(student.parentPhone);

      const absences = await Attendance.find({ studentId: sid, date: { $gte: start, $lte: end }, status: 'absent' });
      const absenceCount = absences.length;
      const totalSessions = countScheduledSessionsForGrade(student.grade, start, end, schedules);

      let msgDate;
      if (mode === 'date') {
        msgDate = new Date(date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      } else if (mode === 'week') {
        msgDate = `الأسبوع ${week}`;
      } else {
        msgDate = new Date(start).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' });
      }

      const message = resolveTemplate(template, {
        studentName: student.fullName,
        grade: student.grade,
        date: msgDate,
        absenceCount: String(absenceCount),
        totalSessions: String(totalSessions),
        teacherName: 'كريم مصطفى'
      });

      const waResult = await sendWhatsApp(phone, message);

      await NotificationLog.create({
        studentId: sid,
        parentPhone: phone,
        message,
        status: waResult.success ? 'sent' : 'failed',
        errorMessage: waResult.success ? null : waResult.error,
        trigger: inferredTrigger,
        month: monthStr
      });

      results.push({
        studentId: sid,
        studentName: student.fullName,
        phone,
        status: waResult.success ? 'sent' : 'failed',
        error: waResult.success ? null : waResult.error
      });

      await new Promise(r => setTimeout(r, 300));
    }

    res.json({ success: true, data: { results } });
  } catch (err) {
    next(err);
  }
});

router.post('/send-weekly', requireTeacher, async (req, res, next) => {
  try {
    const { week, grade: gradeFilter } = req.body;
    const { start, end } = getWeekBounds(week);

    const rule = await NotificationRule.findOne({ trigger: 'weekly', isActive: true });
    const template = rule?.messageTemplate || defaultTemplates.weekly;

    const absences = await Attendance.find({ date: { $gte: start, $lte: end }, status: 'absent' }).populate('studentId');
    const byStudent = {};
    absences.forEach(a => {
      const sid = a.studentId?._id?.toString();
      if (!sid) return;
      if (gradeFilter && gradeFilter !== 'all' && a.studentId?.grade !== gradeFilter) return;
      if (!byStudent[sid]) byStudent[sid] = { student: a.studentId, count: 0 };
      byStudent[sid].count++;
    });

    const results = [];
    for (const item of Object.values(byStudent)) {
      const student = item.student;
      if (!student.parentPhone) {
        results.push({ studentId: student._id, studentName: student.fullName, status: 'failed', error: 'No parent phone' });
        continue;
      }
      const phone = formatEgyptianPhone(student.parentPhone);

      // Count total sessions
      const schedules = await Schedule.find({ grade: student.grade, isActive: true });
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      let totalSessions = 0;
      const cur = new Date(start);
      while (cur <= end) {
        const dow = dayNames[cur.getDay()];
        if (dow !== 'Friday' && schedules.some(s => s.dayOfWeek === dow)) totalSessions++;
        cur.setDate(cur.getDate() + 1);
      }

      const message = resolveTemplate(template, {
        studentName: student.fullName,
        grade: student.grade,
        absenceCount: item.count,
        totalSessions,
        teacherName: 'كريم مصطفى'
      });

      const waResult = await sendWhatsApp(phone, message);
      await NotificationLog.create({
        studentId: student._id,
        parentPhone: phone,
        message,
        status: waResult.success ? 'sent' : 'failed',
        errorMessage: waResult.success ? null : waResult.error,
        trigger: 'weekly',
        weekOf: week
      });

      results.push({ studentId: student._id, studentName: student.fullName, phone, status: waResult.success ? 'sent' : 'failed', error: waResult.error });
      await new Promise(r => setTimeout(r, 300));
    }

    const sent = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status === 'failed').length;
    res.json({ success: true, data: { sent, failed, results } });
  } catch (err) {
    next(err);
  }
});

router.post('/send-monthly', requireTeacher, async (req, res, next) => {
  try {
    const { month, grade: gradeFilter } = req.body;
    const { start, end } = getMonthBounds(month);

    const rule = await NotificationRule.findOne({ trigger: 'monthly', isActive: true });
    const template = rule?.messageTemplate || defaultTemplates.monthly;

    const absences = await Attendance.find({ date: { $gte: start, $lte: end }, status: 'absent' }).populate('studentId');
    const byStudent = {};
    absences.forEach(a => {
      const sid = a.studentId?._id?.toString();
      if (!sid) return;
      if (gradeFilter && gradeFilter !== 'all' && a.studentId?.grade !== gradeFilter) return;
      if (!byStudent[sid]) byStudent[sid] = { student: a.studentId, count: 0 };
      byStudent[sid].count++;
    });

    const results = [];
    for (const item of Object.values(byStudent)) {
      const student = item.student;
      if (!student.parentPhone) {
        results.push({ studentId: student._id, studentName: student.fullName, status: 'failed', error: 'No parent phone' });
        continue;
      }
      const phone = formatEgyptianPhone(student.parentPhone);

      const totalDays = new Date(month.split('-')[0], month.split('-')[1], 0).getDate();
      const schedules = await Schedule.find({ grade: student.grade, isActive: true });
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      let totalSessions = 0;
      for (let d = 1; d <= totalDays; d++) {
        const date = new Date(month.split('-')[0], month.split('-')[1] - 1, d);
        const dow = dayNames[date.getDay()];
        if (dow !== 'Friday' && schedules.some(s => s.dayOfWeek === dow)) totalSessions++;
      }

      const message = resolveTemplate(template, {
        studentName: student.fullName,
        grade: student.grade,
        absenceCount: item.count,
        totalSessions,
        teacherName: 'كريم مصطفى'
      });

      const waResult = await sendWhatsApp(phone, message);
      await NotificationLog.create({
        studentId: student._id,
        parentPhone: phone,
        message,
        status: waResult.success ? 'sent' : 'failed',
        errorMessage: waResult.success ? null : waResult.error,
        trigger: 'monthly',
        month
      });

      results.push({ studentId: student._id, studentName: student.fullName, phone, status: waResult.success ? 'sent' : 'failed', error: waResult.error });
      await new Promise(r => setTimeout(r, 300));
    }

    const sent = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status === 'failed').length;
    res.json({ success: true, data: { sent, failed, results } });
  } catch (err) {
    next(err);
  }
});

router.post('/send-exam-result', requireTeacher, async (req, res, next) => {
  try {
    const { examId, resultIds } = req.body;
    if (!examId || !resultIds || !resultIds.length) {
      return res.status(400).json({ success: false, message: 'examId and resultIds required' });
    }

    const exam = await require('../models/Exam').findById(examId);
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });

    const rule = await NotificationRule.findOne({ trigger: 'exam_result', isActive: true });
    const template = rule?.messageTemplate || defaultTemplates.exam_result;

    const results = [];
    const ExamResult = require('../models/ExamResult');
    for (const rid of resultIds) {
      const result = await ExamResult.findById(rid).populate('studentId');
      if (!result || !result.studentId) {
        results.push({ resultId: rid, status: 'failed', error: 'Result or student not found' });
        continue;
      }
      const student = result.studentId;
      if (!student.parentPhone) {
        results.push({ resultId: rid, studentId: student._id, studentName: student.fullName, status: 'failed', error: 'No parent phone' });
        await NotificationLog.create({
          studentId: student._id,
          parentPhone: '',
          message: '',
          status: 'failed',
          errorMessage: 'No parent phone',
          trigger: 'exam_result',
          examId: exam._id,
          examResultId: result._id
        });
        continue;
      }

      const phone = formatEgyptianPhone(student.parentPhone);
      const message = resolveTemplate(template, {
        studentName: student.fullName,
        grade: student.grade,
        examTitle: exam.title,
        score: String(result.score),
        total: String(result.totalQuestions),
        percentage: String(result.percentageScore),
        teacherName: 'كريم مصطفى'
      });

      const waResult = await sendWhatsApp(phone, message);
      await NotificationLog.create({
        studentId: student._id,
        parentPhone: phone,
        message,
        status: waResult.success ? 'sent' : 'failed',
        errorMessage: waResult.success ? null : waResult.error,
        trigger: 'exam_result',
        examId: exam._id,
        examResultId: result._id
      });

      results.push({
        resultId: rid,
        studentId: student._id,
        studentName: student.fullName,
        phone,
        status: waResult.success ? 'sent' : 'failed',
        error: waResult.success ? null : waResult.error
      });
      await new Promise(r => setTimeout(r, 300));
    }

    res.json({ success: true, data: { results } });
  } catch (err) {
    next(err);
  }
});

router.post('/send-payment_late', requireTeacher, async (req, res, next) => {
  try {
    const { month, grade: gradeFilter, studentIds } = req.body;
    if (!month) {
      return res.status(400).json({ success: false, message: 'month required' });
    }

    const Payment = require('../models/Payment');
    const rule = await NotificationRule.findOne({ trigger: 'payment_late', isActive: true });
    const template = rule?.messageTemplate || defaultTemplates.payment_late;

    let paymentFilter = { month, isPaid: false };
    if (studentIds && studentIds.length > 0) {
      paymentFilter.studentId = { $in: studentIds };
    }
    const payments = await Payment.find(paymentFilter).populate('studentId');

    const results = [];
    for (const payment of payments) {
      const student = payment.studentId;
      if (!student) {
        results.push({ paymentId: payment._id, status: 'failed', error: 'Student not found' });
        continue;
      }
      if (gradeFilter && gradeFilter !== 'all' && student.grade !== gradeFilter) {
        continue;
      }
      if (!student.parentPhone) {
        results.push({ studentId: student._id, studentName: student.fullName, status: 'failed', error: 'No parent phone' });
        await NotificationLog.create({
          studentId: student._id,
          parentPhone: '',
          message: '',
          status: 'failed',
          errorMessage: 'No parent phone',
          trigger: 'payment_late',
          month
        });
        continue;
      }
      const phone = formatEgyptianPhone(student.parentPhone);
      const message = resolveTemplate(template, {
        studentName: student.fullName,
        grade: student.grade,
        month,
        amount: String(payment.amount || 0),
        teacherName: 'كريم مصطفى'
      });

      const waResult = await sendWhatsApp(phone, message);
      await NotificationLog.create({
        studentId: student._id,
        parentPhone: phone,
        message,
        status: waResult.success ? 'sent' : 'failed',
        errorMessage: waResult.success ? null : waResult.error,
        trigger: 'payment_late',
        month
      });

      results.push({ studentId: student._id, studentName: student.fullName, phone, status: waResult.success ? 'sent' : 'failed', error: waResult.error });
      await new Promise(r => setTimeout(r, 300));
    }

    res.json({ success: true, data: { results } });
  } catch (err) {
    next(err);
  }
});

router.get('/logs', requireTeacher, async (req, res, next) => {
  try {
    const { studentId, month, trigger, status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (studentId) filter.studentId = studentId;
    if (month) filter.month = month;
    if (trigger) filter.trigger = trigger;
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [logs, total] = await Promise.all([
      NotificationLog.find(filter).populate('studentId', 'fullName grade').sort({ sentAt: -1 }).skip(skip).limit(Number(limit)),
      NotificationLog.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)), limit: Number(limit) }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/rules', requireTeacher, async (req, res, next) => {
  try {
    const rules = await NotificationRule.find().sort({ createdAt: -1 });
    res.json({ success: true, data: rules });
  } catch (err) {
    next(err);
  }
});

router.post('/rules', requireTeacher, async (req, res, next) => {
  try {
    const { trigger, grade, messageTemplate, isActive } = req.body;
    if (isActive) {
      await NotificationRule.updateMany({ trigger }, { isActive: false });
    }
    const rule = await NotificationRule.create({ trigger, grade, messageTemplate, isActive });
    res.status(201).json({ success: true, data: rule });
  } catch (err) {
    next(err);
  }
});

router.put('/rules/:id', requireTeacher, async (req, res, next) => {
  try {
    const { isActive, trigger } = req.body;
    if (isActive && trigger) {
      await NotificationRule.updateMany({ trigger, _id: { $ne: req.params.id } }, { isActive: false });
    }
    const rule = await NotificationRule.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: new Date() }, { new: true });
    if (!rule) return res.status(404).json({ success: false, message: 'Rule not found' });
    res.json({ success: true, data: rule });
  } catch (err) {
    next(err);
  }
});

router.delete('/rules/:id', requireTeacher, async (req, res, next) => {
  try {
    const rule = await NotificationRule.findByIdAndDelete(req.params.id);
    if (!rule) return res.status(404).json({ success: false, message: 'Rule not found' });
    res.json({ success: true, data: rule });
  } catch (err) {
    next(err);
  }
});

router.get('/stats', requireTeacher, async (req, res, next) => {
  try {
    const { month } = req.query;
    const filter = month ? { month } : {};
    const sentThisMonth = await NotificationLog.countDocuments({ ...filter, status: 'sent' });
    const failedThisMonth = await NotificationLog.countDocuments({ ...filter, status: 'failed' });
    const distinctStudents = await NotificationLog.distinct('studentId', filter);
    const byTrigger = {};
    for (const t of ['manual', 'per_session', 'weekly', 'monthly', 'exam_result', 'payment_late']) {
      byTrigger[t] = await NotificationLog.countDocuments({ ...filter, trigger: t });
    }
    res.json({
      success: true,
      data: {
        sentThisMonth,
        failedThisMonth,
        studentsNotified: distinctStudents.length,
        byTrigger
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
