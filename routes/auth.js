const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const TEACHER_PASSWORD_HASH = process.env.TEACHER_PASSWORD_HASH;

router.post('/login', async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || !TEACHER_PASSWORD_HASH) {
      return res.status(400).json({ message: 'Missing credentials' });
    }
    const match = await bcrypt.compare(password, TEACHER_PASSWORD_HASH);
    if (!match) {
      return res.status(401).json({ message: 'Invalid password' });
    }
    const token = jwt.sign({ teacher: true }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.json({ message: 'Logged in successfully' });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

router.get('/me', (req, res) => {
  const token = req.cookies?.token;
  if (!token) return res.json({ loggedIn: false });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.teacher) {
      return res.json({ loggedIn: true });
    }
    return res.json({ loggedIn: false });
  } catch {
    return res.json({ loggedIn: false });
  }
});

module.exports = router;
