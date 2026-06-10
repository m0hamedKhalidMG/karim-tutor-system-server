const gradeMap = {
  '1': 'الأول الإعدادي',
  '2': 'الثاني الإعدادي',
  '3': 'الثالث الإعدادي',
  '4': 'الأول الثانوي',
  '5': 'الثاني الثانوي',
  '6': 'الثالث الثانوي',
  '7': 'الأول الإعدادي',
  '8': 'الثاني الإعدادي',
  '9': 'الثالث الإعدادي',
  '10': 'الأول الثانوي',
  '11': 'الثاني الثانوي',
  '12': 'الثالث الثانوي',
  'Grade 1': 'الأول الإعدادي',
  'Grade 2': 'الثاني الإعدادي',
  'Grade 3': 'الثالث الإعدادي',
  'Grade 4': 'الأول الثانوي',
  'Grade 5': 'الثاني الثانوي',
  'Grade 6': 'الثالث الثانوي',
  'Grade 7': 'الأول الإعدادي',
  'Grade 8': 'الثاني الإعدادي',
  'Grade 9': 'الثالث الإعدادي',
  'Grade 10': 'الأول الثانوي',
  'Grade 11': 'الثاني الثانوي',
  'Grade 12': 'الثالث الثانوي'
};

function resolveTemplate(template, vars) {
  return template
    .replace(/{{studentName}}/g, vars.studentName || '')
    .replace(/{{grade}}/g, gradeMap[vars.grade] || vars.grade || '')
    .replace(/{{date}}/g, vars.date || '')
    .replace(/{{absenceCount}}/g, vars.absenceCount || '0')
    .replace(/{{totalSessions}}/g, vars.totalSessions || '0')
    .replace(/{{teacherName}}/g, vars.teacherName || 'كريم مصطفى')
    .replace(/{{examTitle}}/g, vars.examTitle || '')
    .replace(/{{score}}/g, vars.score || '0')
    .replace(/{{total}}/g, vars.total || '0')
    .replace(/{{percentage}}/g, vars.percentage || '0')
    .replace(/{{month}}/g, vars.month || '')
    .replace(/{{amount}}/g, vars.amount || '0');
}

module.exports = { resolveTemplate, gradeMap };
