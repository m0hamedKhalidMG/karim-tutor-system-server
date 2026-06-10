require('dotenv').config();
const mongoose = require('mongoose');
const Grade = require('../models/Grade');

const grades = [
  { name: 'Grade 1', order: 1 },
  { name: 'Grade 2', order: 2 },
  { name: 'Grade 3', order: 3 },
  { name: 'Grade 4', order: 4 },
  { name: 'Grade 5', order: 5 },
  { name: 'Grade 6', order: 6 },
  { name: 'Grade 7', order: 7 },
  { name: 'Grade 8', order: 8 },
  { name: 'Grade 9', order: 9 },
  { name: 'Grade 10', order: 10 },
  { name: 'Grade 11', order: 11 },
  { name: 'Grade 12', order: 12 },
];

async function seedGrades() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    await Grade.deleteMany({});
    console.log('Cleared existing grades');

    const created = await Grade.insertMany(grades);
    console.log(`Created ${created.length} grades`);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding grades:', err);
    process.exit(1);
  }
}

seedGrades();
