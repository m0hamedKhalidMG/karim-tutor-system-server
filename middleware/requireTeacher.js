const jwt = require('jsonwebtoken');

function requireTeacher(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.teacher) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    req.teacher = true;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

module.exports = requireTeacher;
