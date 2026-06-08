const express = require('express');
const router = express.Router();
const moment = require('moment-timezone');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Schedule = require('../models/Schedule');
const requireTeacher = require('../middleware/requireTeacher');

const EGYPT_TZ = 'Africa/Cairo';

function nowEgypt() {
  return moment().tz(EGYPT_TZ);
}

function getSessionWindow(sessionTime, bufferMinutes, nowMoment) {
  const [hh, mm] = (sessionTime || '00:00').split(':');
  const sessionStart = nowMoment.clone().hours(parseInt(hh, 10)).minutes(parseInt(mm, 10)).seconds(0).milliseconds(0);
  const sessionEnd = sessionStart.clone().add(bufferMinutes || 30, 'minutes');
  return { sessionStart, sessionEnd };
}

router.post('/scan', requireTeacher, async (req, res, next) => {
  try {
    const { qrCode } = req.body;
    const student = await Student.findOne({ qrCode, isActive: true });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const now = nowEgypt();
    const todayStart = now.clone().startOf('day').toDate();
    const todayEnd = now.clone().endOf('day').toDate();

    // Find today's schedules for this student's grade/group
    const dayOfWeek = now.format('dddd');
    const scheduleFilter = { dayOfWeek, isActive: true, grade: student.grade };
    if (student.groupId) scheduleFilter.groupId = student.groupId;
    const schedules = await Schedule.find(scheduleFilter);

    // If schedules exist for today, enforce time window
    if (schedules.length > 0) {
      const matchingSchedule = schedules.find(s => {
        const { sessionStart, sessionEnd } = getSessionWindow(s.sessionTime, s.bufferMinutes, now);
        return now.isSameOrAfter(sessionStart) && now.isSameOrBefore(sessionEnd);
      });

      if (!matchingSchedule) {
        const allEnded = schedules.every(s => {
          const { sessionEnd } = getSessionWindow(s.sessionTime, s.bufferMinutes, now);
          return now.isAfter(sessionEnd);
        });
        const allNotStarted = schedules.every(s => {
          const { sessionStart } = getSessionWindow(s.sessionTime, s.bufferMinutes, now);
          return now.isBefore(sessionStart);
        });

        if (allEnded) {
          return res.status(403).json({
            success: false,
            message: 'All sessions for today have ended. Scan not allowed.',
            student: { fullName: student.fullName, grade: student.grade }
          });
        }
        if (allNotStarted) {
          return res.status(403).json({
            success: false,
            message: 'Sessions have not started yet.',
            student: { fullName: student.fullName, grade: student.grade }
          });
        }
        return res.status(403).json({
          success: false,
          message: 'You are outside the allowed scan window for your session.',
          student: { fullName: student.fullName, grade: student.grade }
        });
      }
    }

    const existing = await Attendance.findOne({
      studentId: student._id,
      date: { $gte: todayStart, $lte: todayEnd }
    });

    if (existing) {
      return res.json({
        success: true,
        alreadyMarked: true,
        student: { fullName: student.fullName, grade: student.grade }
      });
    }

    await Attendance.create({
      studentId: student._id,
      date: now.toDate(),
      status: 'present',
      markedVia: 'qr'
    });

    res.json({
      success: true,
      alreadyMarked: false,
      student: { fullName: student.fullName, grade: student.grade }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/current-sessions', requireTeacher, async (req, res, next) => {
  try {
    const now = nowEgypt();
    const dayOfWeek = now.format('dddd');

    const schedules = await Schedule.find({ dayOfWeek, isActive: true }).populate('groupId', 'name grade');

    const sessions = schedules.map(s => {
      const { sessionStart, sessionEnd } = getSessionWindow(s.sessionTime, s.bufferMinutes, now);
      let status = 'upcoming';
      if (now.isAfter(sessionEnd)) status = 'ended';
      else if (now.isSameOrAfter(sessionStart) && now.isSameOrBefore(sessionEnd)) status = 'open';

      const totalMinutes = Math.max(0, Math.round(sessionEnd.diff(now, 'minutes', true)));

      return {
        _id: s._id,
        grade: s.grade,
        group: s.groupId,
        sessionTime: s.sessionTime,
        bufferMinutes: s.bufferMinutes || 30,
        sessionStart: sessionStart.toISOString(),
        sessionEnd: sessionEnd.toISOString(),
        status,
        remainingMinutes: status === 'open' ? totalMinutes : 0
      };
    });

    res.json({ success: true, data: sessions });
  } catch (err) {
    next(err);
  }
});

router.post('/manual', requireTeacher, async (req, res, next) => {
  try {
    const { studentId, date, status } = req.body;
    const record = await Attendance.create({
      studentId,
      date: new Date(date),
      status,
      markedVia: 'manual'
    });
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

router.get('/today', requireTeacher, async (req, res, next) => {
  try {
    const now = nowEgypt();
    const todayStart = now.clone().startOf('day').toDate();
    const todayEnd = now.clone().endOf('day').toDate();

    const records = await Attendance.find({
      date: { $gte: todayStart, $lte: todayEnd }
    }).populate('studentId', 'fullName grade groupId').sort({ createdAt: -1 });

    const present = records.filter(r => r.status === 'present').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const total = records.length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;

    res.json({ success: true, data: records, stats: { present, absent, total, rate } });
  } catch (err) {
    next(err);
  }
});

router.delete('/today/:id', requireTeacher, async (req, res, next) => {
  try {
    const record = await Attendance.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });
    res.json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

router.get('/history', requireTeacher, async (req, res, next) => {
  try {
    const { studentId, month, status, groupId } = req.query;
    const filter = {};
    if (studentId) filter.studentId = studentId;
    if (status) filter.status = status;
    if (month) {
      const [year, mon] = month.split('-');
      const start = new Date(year, mon - 1, 1);
      const end = new Date(year, mon, 0, 23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    }

    let records = await Attendance.find(filter).populate('studentId', 'fullName grade groupId').sort({ date: -1 });

    // Filter by group in memory since Attendance doesn't have groupId directly
    if (groupId) {
      records = records.filter(r => {
        const sid = r.studentId;
        if (!sid) return false;
        const sidGroup = sid.groupId?._id?.toString() || sid.groupId?.toString() || sid.groupId;
        return String(sidGroup) === String(groupId);
      });
    }

    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

router.get('/roster', requireTeacher, async (req, res, next) => {
  try {
    const { date, grade, groupId, status } = req.query;
    if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

    const target = new Date(date);
    const dayStart = new Date(target);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(target);
    dayEnd.setHours(23, 59, 59, 999);

    const studentFilter = { isActive: true };
    if (grade) studentFilter.grade = grade;
    if (groupId) studentFilter.groupId = groupId;
    const students = await Student.find(studentFilter).populate('groupId', 'name').sort({ fullName: 1 });

    const records = await Attendance.find({
      date: { $gte: dayStart, $lte: dayEnd }
    }).populate('studentId', 'fullName grade groupId');

    const roster = students.map(s => {
      const record = records.find(r => r.studentId && String(r.studentId._id) === String(s._id));
      return {
        student: {
          _id: s._id,
          fullName: s.fullName,
          grade: s.grade,
          groupId: s.groupId
        },
        status: record ? record.status : null,
        markedVia: record ? record.markedVia : null,
        recordId: record ? record._id : null,
        time: record ? record.createdAt : null
      };
    });

    let filtered = roster;
    if (status) {
      if (status === 'not-marked') {
        filtered = roster.filter(r => !r.status);
      } else {
        filtered = roster.filter(r => r.status === status);
      }
    }

    const present = filtered.filter(r => r.status === 'present').length;
    const absent = filtered.filter(r => r.status === 'absent').length;
    const notMarked = filtered.filter(r => !r.status).length;
    const total = filtered.length;

    res.json({ success: true, data: filtered, stats: { present, absent, notMarked, total } });
  } catch (err) {
    next(err);
  }
});

router.get('/analytics', requireTeacher, async (req, res, next) => {
  try {
    const { month, grade, groupId } = req.query;
    if (!month) return res.status(400).json({ success: false, message: 'Month is required' });

    const [year, mon] = month.split('-');
    const monthStart = new Date(year, mon - 1, 1);
    const monthEnd = new Date(year, mon, 0, 23, 59, 59, 999);
    const totalDaysInMonth = monthEnd.getDate();

    const studentFilter = { isActive: true };
    if (grade) studentFilter.grade = grade;
    if (groupId) studentFilter.groupId = groupId;
    const students = await Student.find(studentFilter).populate('groupId', 'name').sort({ fullName: 1 });

    const schedules = await Schedule.find({ isActive: true });

    const attendanceRecords = await Attendance.find({
      date: { $gte: monthStart, $lte: monthEnd }
    });

    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

    const analytics = students.map(student => {
      const studentSchedules = schedules.filter(s => {
        if (s.grade !== student.grade) return false;
        if (s.groupId) {
          return String(s.groupId) === String(student.groupId?._id || student.groupId);
        }
        return true;
      });

      let scheduledCount = 0;
      for (let d = 1; d <= totalDaysInMonth; d++) {
        const date = new Date(year, mon - 1, d);
        const dayOfWeek = dayNames[date.getDay()];
        if (dayOfWeek === 'Friday') continue;

        const hasSession = studentSchedules.some(s => s.dayOfWeek === dayOfWeek);
        if (hasSession) scheduledCount++;
      }

      const studentRecords = attendanceRecords.filter(r => String(r.studentId) === String(student._id));
      const present = studentRecords.filter(r => r.status === 'present').length;
      const absent = studentRecords.filter(r => r.status === 'absent').length;
      const notMarked = Math.max(0, scheduledCount - present - absent);
      const attendanceRate = scheduledCount > 0 ? Math.round((present / scheduledCount) * 100) : 0;

      return {
        student: {
          _id: student._id,
          fullName: student.fullName,
          grade: student.grade,
          groupId: student.groupId
        },
        scheduledCount,
        sessionsPerWeek: studentSchedules.length,
        present,
        absent,
        notMarked,
        attendanceRate
      };
    });

    res.json({ success: true, data: analytics });
  } catch (err) {
    next(err);
  }
});

router.post('/auto-mark-absent', requireTeacher, async (req, res, next) => {
  try {
    const now = nowEgypt();
    const targetDate = req.body.date ? moment(req.body.date).tz(EGYPT_TZ) : now.clone();
    const dayOfWeek = targetDate.format('dddd');

    const todayStart = targetDate.clone().startOf('day').toDate();
    const todayEnd = targetDate.clone().endOf('day').toDate();

    const schedules = await Schedule.find({ dayOfWeek, isActive: true }).populate('groupId', 'name');

    let totalMarked = 0;

    for (const schedule of schedules) {
      const { sessionEnd } = getSessionWindow(schedule.sessionTime, schedule.bufferMinutes, targetDate);

      if (now.isBefore(sessionEnd) && !req.body.force) continue;

      const studentFilter = { isActive: true, grade: schedule.grade };
      if (schedule.groupId) {
        studentFilter.groupId = schedule.groupId._id;
      }

      const students = await Student.find(studentFilter);

      for (const student of students) {
        const existing = await Attendance.findOne({
          studentId: student._id,
          date: { $gte: todayStart, $lte: todayEnd }
        });

        if (!existing) {
          await Attendance.create({
            studentId: student._id,
            date: targetDate.toDate(),
            status: 'absent',
            markedVia: 'manual'
          });
          totalMarked++;
        }
      }
    }

    res.json({ success: true, data: { message: 'Auto-mark complete', markedAbsent: totalMarked } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
