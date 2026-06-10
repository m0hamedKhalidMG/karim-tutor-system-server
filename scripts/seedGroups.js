require('dotenv').config();
const mongoose = require('mongoose');
const Group = require('../models/Group');

const groups = [
  { name: 'Group A', grade: 'Grade 1', description: 'First grade group A' },
  { name: 'Group B', grade: 'Grade 1', description: 'First grade group B' },
  { name: 'Group C', grade: 'Grade 2', description: 'Second grade group A' },
  { name: 'Group D', grade: 'Grade 2', description: 'Second grade group B' },
  { name: 'Group E', grade: 'Grade 3', description: 'Third grade group A' },
  { name: 'Group F', grade: 'Grade 3', description: 'Third grade group B' },
  { name: 'Group G', grade: 'Grade 4', description: 'Fourth grade group A' },
  { name: 'Group H', grade: 'Grade 4', description: 'Fourth grade group B' },
  { name: 'Group I', grade: 'Grade 5', description: 'Fifth grade group A' },
  { name: 'Group J', grade: 'Grade 5', description: 'Fifth grade group B' },
  { name: 'Group K', grade: 'Grade 6', description: 'Sixth grade group A' },
  { name: 'Group L', grade: 'Grade 6', description: 'Sixth grade group B' },
  { name: 'Group M', grade: 'Grade 7', description: 'Seventh grade group A' },
  { name: 'Group N', grade: 'Grade 7', description: 'Seventh grade group B' },
  { name: 'Group O', grade: 'Grade 8', description: 'Eighth grade group A' },
  { name: 'Group P', grade: 'Grade 8', description: 'Eighth grade group B' },
  { name: 'Group Q', grade: 'Grade 9', description: 'Ninth grade group A' },
  { name: 'Group R', grade: 'Grade 9', description: 'Ninth grade group B' },
  { name: 'Group S', grade: 'Grade 10', description: 'Tenth grade group A' },
  { name: 'Group T', grade: 'Grade 10', description: 'Tenth grade group B' },
  { name: 'Group U', grade: 'Grade 11', description: 'Eleventh grade group A' },
  { name: 'Group V', grade: 'Grade 11', description: 'Eleventh grade group B' },
  { name: 'Group W', grade: 'Grade 12', description: 'Twelfth grade group A' },
  { name: 'Group X', grade: 'Grade 12', description: 'Twelfth grade group B' },
];

async function seedGroups() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear existing groups (optional - remove if you want to keep existing)
    await Group.deleteMany({});
    console.log('Cleared existing groups');

    const created = await Group.insertMany(groups);
    console.log(`Created ${created.length} groups`);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding groups:', err);
    process.exit(1);
  }
}

seedGroups();
