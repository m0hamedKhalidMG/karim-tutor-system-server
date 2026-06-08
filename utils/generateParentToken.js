const { v4: uuidv4 } = require('uuid');

function generateParentToken() {
  return uuidv4();
}

module.exports = generateParentToken;
