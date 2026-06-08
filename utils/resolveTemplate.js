const gradeMap = {
  '7': 'الأول الإعدادي',
  '8': 'الثاني الإعدادي',
  '9': 'الثالث الإعدادي'
};

function resolveTemplate(template, vars) {
  return template
    .replace(/{{studentName}}/g, vars.studentName || '')
    .replace(/{{grade}}/g, gradeMap[vars.grade] || vars.grade || '')
    .replace(/{{date}}/g, vars.date || '')
    .replace(/{{absenceCount}}/g, vars.absenceCount || '0')
    .replace(/{{totalSessions}}/g, vars.totalSessions || '0')
    .replace(/{{teacherName}}/g, vars.teacherName || 'كريم مصطفى');
}

module.exports = { resolveTemplate, gradeMap };
