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
    .replace(/{{teacherName}}/g, vars.teacherName || 'كريم مصطفى')
    .replace(/{{examTitle}}/g, vars.examTitle || '')
    .replace(/{{score}}/g, vars.score || '0')
    .replace(/{{total}}/g, vars.total || '0')
    .replace(/{{percentage}}/g, vars.percentage || '0')
    .replace(/{{month}}/g, vars.month || '')
    .replace(/{{amount}}/g, vars.amount || '0');
}

module.exports = { resolveTemplate, gradeMap };
