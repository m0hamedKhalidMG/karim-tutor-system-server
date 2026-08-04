function errorHandler(err, req, res, next) {
  console.error(err);

  // Duplicate key (e.g. qrCode already exists)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    const label = field === 'qrCode' ? 'QR code' : field;
    return res.status(409).json({
      message: `This ${label} is already used by another student`
    });
  }

  // Mongoose validation
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors || {}).map((e) => e.message).join(', ') || err.message;
    return res.status(400).json({ message });
  }

  // Invalid ObjectId / cast errors
  if (err.name === 'CastError') {
    return res.status(400).json({ message: `Invalid ${err.path || 'value'}` });
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  res.status(statusCode).json({ message });
}

module.exports = errorHandler;
