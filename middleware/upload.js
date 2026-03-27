const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const valid = allowed.test(file.mimetype);
    if (valid) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

module.exports = upload;