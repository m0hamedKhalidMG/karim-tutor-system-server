const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

require('dotenv').config();

const Student = require('../models/Student');
const Group = require('../models/Group');
const Schedule = require('../models/Schedule');
const Attendance = require('../models/Attendance');
const Payment = require('../models/Payment');
const Exam = require('../models/Exam');
const ExamResult = require('../models/ExamResult');
const Grade = require('../models/Grade');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('MONGO_URI not found in .env');
  process.exit(1);
}

const firstNames = ['Mohamed', 'Ahmed', 'Ali', 'Omar', 'Youssef', 'Mahmoud', 'Khaled', 'Hassan', 'Ibrahim', 'Karim', 'Mostafa', 'Tarek', 'Hussein', 'Amr', 'Said', 'Nour', 'Salma', 'Mariam', 'Fatima', 'Aya', 'Yasmin', 'Hana', 'Laila', 'Rania', 'Dina', 'Reem'];
const lastNames = ['El-Sayed', 'Ibrahim', 'Hassan', 'Ali', 'Mahmoud', 'Khaled', 'Omar', 'Youssef', 'Tarek', 'Mostafa', 'Ahmed', 'Mohamed', 'Fathy', 'Gamal', 'Saad', 'Salem', 'Rashid', 'Nasser'];

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randBool(prob = 0.5) { return Math.random() < prob; }
function addDays(date, days) { const r = new Date(date); r.setDate(r.getDate() + days); return r; }

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  console.log('Clearing existing data...');
  await Promise.all([
    Student.deleteMany({}),
    Group.deleteMany({}),
    Schedule.deleteMany({}),
    Attendance.deleteMany({}),
    Payment.deleteMany({}),
    Exam.deleteMany({}),
    ExamResult.deleteMany({}),
    Grade.deleteMany({})
  ]);
  console.log('Cleared all collections');

  // ========== GRADES ==========
  console.log('Seeding Grades...');
  const gradesData = [
    { name: 'Grade 7', order: 7 },
    { name: 'Grade 8', order: 8 },
    { name: 'Grade 9', order: 9 },
  ];
  const seededGrades = await Grade.insertMany(gradesData);
  console.log(`Created ${seededGrades.length} grades`);

  // ========== GROUPS ==========
  console.log('Seeding Groups...');
  const groupsData = [
    { name: 'Group A - Grade 7', grade: 'Grade 7', description: 'Morning session for Grade 7' },
    { name: 'Group B - Grade 7', grade: 'Grade 7', description: 'Evening session for Grade 7' },
    { name: 'Group A - Grade 8', grade: 'Grade 8', description: 'Morning session for Grade 8' },
    { name: 'Group B - Grade 8', grade: 'Grade 8', description: 'Evening session for Grade 8' },
    { name: 'Group A - Grade 9', grade: 'Grade 9', description: 'Morning session for Grade 9' },
    { name: 'Group B - Grade 9', grade: 'Grade 9', description: 'Evening session for Grade 9' },
  ];
  const groups = await Group.insertMany(groupsData);
  console.log(`Created ${groups.length} groups`);

  // ========== STUDENTS ==========
  console.log('Seeding Students...');
  const students = [];
  let qrCounter = 1000;
  const gradeNames = ['Grade 7', 'Grade 8', 'Grade 9'];
  for (let i = 0; i < 60; i++) {
    const grade = gradeNames[randInt(0, 2)];
    const gradeGroups = groups.filter(g => g.grade === grade);
    const group = rand(gradeGroups);
    students.push({
      fullName: `${rand(firstNames)} ${rand(lastNames)}`,
      grade,
      groupId: group._id,
      phone: `01${randInt(0, 9)}${randInt(10000000, 99999999)}`,
      parentPhone: `01${randInt(0, 9)}${randInt(10000000, 99999999)}`,
      qrCode: `QR${qrCounter++}`,
      parentAccessToken: uuidv4(),
      isActive: true,
      createdAt: addDays(new Date(), -randInt(30, 300))
    });
  }
  const createdStudents = await Student.insertMany(students);
  console.log(`Created ${createdStudents.length} students`);

  // ========== SCHEDULES ==========
  console.log('Seeding Schedules...');
  const days = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
  const sessionTimes = ['14:00', '16:00', '18:00'];
  const schedules = [];
  groups.forEach(group => {
    days.forEach(day => {
      if (randBool(0.7)) {
        schedules.push({
          grade: group.grade,
          groupId: group._id,
          dayOfWeek: day,
          sessionTime: rand(sessionTimes),
          bufferMinutes: randInt(20, 60),
          isActive: true
        });
      }
    });
  });
  const createdSchedules = await Schedule.insertMany(schedules);
  console.log(`Created ${createdSchedules.length} schedules`);

  // ========== ATTENDANCE ==========
  console.log('Seeding Attendance...');
  const attendanceRecords = [];
  const today = new Date();
  for (let d = -60; d <= 0; d++) {
    const date = addDays(today, d);
    date.setHours(0, 0, 0, 0);
    const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][date.getDay()];
    if (dayName === 'Friday') continue;

    createdStudents.forEach(student => {
      if (randBool(0.7)) {
        const isPresent = randBool(0.75);
        const recordDate = new Date(date);
        recordDate.setHours(randInt(14, 20), randInt(0, 59), randInt(0, 59));
        attendanceRecords.push({
          studentId: student._id,
          date: recordDate,
          status: isPresent ? 'present' : 'absent',
          markedVia: randBool(0.8) ? 'qr' : 'manual',
          createdAt: recordDate
        });
      }
    });
  }
  const createdAttendance = await Attendance.insertMany(attendanceRecords);
  console.log(`Created ${createdAttendance.length} attendance records`);

  // ========== PAYMENTS ==========
  console.log('Seeding Payments...');
  const payments = [];
  const months = [];
  for (let m = 0; m < 6; m++) {
    const d = new Date(today);
    d.setMonth(d.getMonth() - m);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  createdStudents.forEach(student => {
    months.forEach(month => {
      const amount = [150, 200, 250, 300][randInt(0, 3)];
      const isPaid = randBool(0.7);
      const paidAt = isPaid ? addDays(new Date(month + '-01'), randInt(1, 28)) : null;
      payments.push({
        studentId: student._id,
        month,
        amount,
        isPaid,
        paidAt,
        notes: isPaid ? 'Paid on time' : 'Pending',
        createdAt: new Date(month + '-01')
      });
    });
  });
  const createdPayments = await Payment.insertMany(payments);
  console.log(`Created ${createdPayments.length} payments`);

  // ========== EXAMS ==========
  console.log('Seeding Exams...');
  const exams = [];
  const examTitles = ['Math Quiz 1', 'Math Midterm', 'Math Final', 'Science Quiz 1', 'Science Midterm', 'Science Final', 'English Quiz 1', 'English Midterm', 'English Final', 'History Test', 'Geography Quiz', 'Physics Test', 'Chemistry Quiz'];
  const subjects = ['Math', 'Science', 'English', 'History', 'Geography', 'Physics', 'Chemistry'];

  for (let i = 0; i < 15; i++) {
    const grade = String(randInt(7, 9));
    const isActive = randBool(0.6);
    const scheduledAt = addDays(today, randInt(-30, 14));
    const durationMinutes = [15, 20, 30, 45, 60][randInt(0, 4)];
    const numQuestions = randInt(5, 15);
    const questions = [];
    for (let q = 0; q < numQuestions; q++) {
      questions.push({
        questionText: `Question ${q + 1}: What is the answer to this ${rand(subjects).toLowerCase()} problem?`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctIndex: randInt(0, 3),
        timeLimitSeconds: randInt(30, 120)
      });
    }
    exams.push({
      title: rand(examTitles),
      grade,
      scheduledAt,
      durationMinutes,
      isActive,
      questions,
      createdAt: addDays(scheduledAt, -randInt(1, 7))
    });
  }
  const createdExams = await Exam.insertMany(exams);
  console.log(`Created ${createdExams.length} exams`);

  // ========== EXAM RESULTS ==========
  console.log('Seeding Exam Results...');
  const results = [];
  const activeExams = createdExams.filter(e => e.isActive);
  activeExams.forEach(exam => {
    const gradeStudents = createdStudents.filter(s => s.grade === exam.grade);
    gradeStudents.forEach(student => {
      if (randBool(0.85)) {
        const score = randInt(0, exam.questions.length);
        const percentageScore = Math.round((score / exam.questions.length) * 100);
        const flagged = randBool(0.05);
        const submittedAt = addDays(exam.scheduledAt, randInt(0, 2));
        submittedAt.setHours(randInt(10, 20), randInt(0, 59));
        const startedAt = new Date(submittedAt);
        startedAt.setMinutes(startedAt.getMinutes() - randInt(5, 30));

        results.push({
          examId: exam._id,
          studentId: student._id,
          studentName: student.fullName,
          startedAt,
          submittedAt,
          answers: exam.questions.map((q, idx) => ({
            questionIndex: idx,
            selectedIndex: randInt(0, 3),
            answeredAt: submittedAt
          })),
          score,
          totalQuestions: exam.questions.length,
          percentageScore,
          flagged,
          flagReasons: flagged ? ['Tab switch detected'] : [],
          createdAt: submittedAt
        });
      }
    });
  });
  const createdResults = await ExamResult.insertMany(results);
  console.log(`Created ${createdResults.length} exam results`);

  console.log('\n✅ Seed complete!');
  console.log('\nSummary:');
  console.log(`  Groups:      ${groups.length}`);
  console.log(`  Students:    ${createdStudents.length}`);
  console.log(`  Schedules:   ${createdSchedules.length}`);
  console.log(`  Attendance:  ${createdAttendance.length}`);
  console.log(`  Payments:    ${createdPayments.length}`);
  console.log(`  Exams:       ${createdExams.length}`);
  console.log(`  Results:     ${createdResults.length}`);

  await mongoose.disconnect();
  console.log('\nDisconnected from MongoDB');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
