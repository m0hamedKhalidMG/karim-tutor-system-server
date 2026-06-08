const express = require('express');
const router = express.Router();
const Exam = require('../models/Exam');
const ExamResult = require('../models/ExamResult');
const Student = require('../models/Student');
const requireTeacher = require('../middleware/requireTeacher');

function stripAnswers(exam) {
  const obj = exam.toObject ? exam.toObject() : exam;
  if (obj.questions) {
    obj.questions = obj.questions.map(q => {
      const { correctIndex, ...rest } = q;
      return rest;
    });
  }
  return obj;
}

router.get('/', async (req, res, next) => {
  try {
    const exams = await Exam.find().sort({ createdAt: -1 });
    res.json(exams);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    const token = req.cookies?.token;
    let isTeacher = false;
    if (token && process.env.JWT_SECRET) {
      try {
        const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
        if (decoded.teacher) isTeacher = true;
      } catch {}
    }

    if (!isTeacher) {
      if (!exam.isActive) {
        return res.status(403).json({ message: 'Exam is not active' });
      }
      return res.json(stripAnswers(exam));
    }

    res.json(exam);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireTeacher, async (req, res, next) => {
  try {
    const exam = await Exam.create(req.body);
    res.status(201).json(exam);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireTeacher, async (req, res, next) => {
  try {
    const exam = await Exam.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!exam) return res.status(404).json({ message: 'Not found' });
    res.json(exam);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireTeacher, async (req, res, next) => {
  try {
    await Exam.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/activate', requireTeacher, async (req, res, next) => {
  try {
    const exam = await Exam.findByIdAndUpdate(req.params.id, { isActive: true }, { new: true });
    if (!exam) return res.status(404).json({ message: 'Not found' });
    res.json(exam);
  } catch (err) {
    next(err);
  }
});

router.put('/:id/deactivate', requireTeacher, async (req, res, next) => {
  try {
    const exam = await Exam.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!exam) return res.status(404).json({ message: 'Not found' });
    res.json(exam);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/results', requireTeacher, async (req, res, next) => {
  try {
    const results = await ExamResult.find({ examId: req.params.id }).sort({ createdAt: -1 });
    res.json(results);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/verify-student', async (req, res, next) => {
  try {
    const { qrCode } = req.body;
    const student = await Student.findOne({ qrCode, isActive: true });
    if (!student) return res.status(404).json({ message: 'Student not found. Please check your QR code.' });

    // Check if student already submitted this exam
    const existingResult = await ExamResult.findOne({
      examId: req.params.id,
      studentId: student._id
    });
    if (existingResult) {
      return res.status(409).json({
        message: 'You have already taken this exam.',
        result: {
          score: existingResult.score,
          total: existingResult.totalQuestions,
          percentage: existingResult.percentageScore
        }
      });
    }

    res.json({ studentId: student._id, fullName: student.fullName, grade: student.grade });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/submit', async (req, res, next) => {
  try {
    const { studentId, studentName, answers, flagReasons } = req.body;
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    // Prevent duplicate submissions for same student on same exam (ever)
    const existingResult = await ExamResult.findOne({
      examId: exam._id,
      studentId: studentId || null
    });
    if (existingResult) {
      return res.status(409).json({
        message: 'You have already submitted this exam.',
        result: {
          score: existingResult.score,
          total: existingResult.totalQuestions,
          percentage: existingResult.percentageScore
        }
      });
    }

    let score = 0;
    const processedAnswers = answers.map(a => {
      const q = exam.questions[a.questionIndex];
      const isCorrect = q && a.selectedIndex === q.correctIndex;
      if (isCorrect) score++;
      return {
        questionIndex: a.questionIndex,
        selectedIndex: a.selectedIndex,
        answeredAt: a.answeredAt ? new Date(a.answeredAt) : new Date()
      };
    });

    const total = exam.questions.length;
    const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

    const result = await ExamResult.create({
      examId: exam._id,
      studentId,
      studentName,
      startedAt: req.body.startedAt ? new Date(req.body.startedAt) : new Date(),
      submittedAt: new Date(),
      answers: processedAnswers,
      score,
      totalQuestions: total,
      percentageScore: percentage,
      flagged: !!(flagReasons && flagReasons.length),
      flagReasons: flagReasons || []
    });

    res.json({ score, total, percentage });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
