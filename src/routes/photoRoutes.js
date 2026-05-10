const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
  uploadBookingPhotos,
  getBookingPhotos,
  uploadProfilePhoto
} = require('../controllers/photoController');
const { protect } = require('../middleware/authMiddleware');

// Configure multer for temp storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'src/uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG and WebP images are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

router.post('/booking', protect, upload.array('photos', 5), uploadBookingPhotos);
router.get('/booking/:booking_id', protect, getBookingPhotos);
router.post('/profile', protect, upload.single('photo'), uploadProfilePhoto);

module.exports = router;