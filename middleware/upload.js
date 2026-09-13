const multer = require('multer');

/**
 * Photo uploads. Memory storage — sharp resizes before anything touches disk.
 *
 * fieldSize is raised from multer's 1MB default because the old flow pushed a
 * base64 image back up as a form field and silently tripped LIMIT_FIELD_VALUE.
 * Images now travel as ids, but the headroom costs nothing.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 12 * 1024 * 1024,
    fieldSize: 256 * 1024,
    files: 1,
  },
});

module.exports = upload;
