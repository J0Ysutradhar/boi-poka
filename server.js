const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());
app.use(express.json());

// Create uploads and covers directories if they don't exist
const uploadsDir = path.join(__dirname, 'uploads');
const coversDir = path.join(__dirname, 'uploads', 'covers');
const metadataFile = path.join(uploadsDir, 'books.json');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(coversDir)) {
  fs.mkdirSync(coversDir, { recursive: true });
}
if (!fs.existsSync(metadataFile)) {
  fs.writeFileSync(metadataFile, JSON.stringify({ books: [] }, null, 2));
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Store cover images in covers directory, PDFs in uploads
    if (file.fieldname === 'cover') {
      cb(null, coversDir);
    } else {
      cb(null, uploadsDir);
    }
  },
  filename: function (req, file, cb) {
    // Sanitize filename and add timestamp to prevent conflicts
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const timestamp = Date.now();
    cb(null, `${timestamp}_${sanitized}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: function (req, file, cb) {
    // Accept PDF files for book field and images for cover field
    if (file.fieldname === 'book' && file.mimetype === 'application/pdf') {
      cb(null, true);
    } else if (file.fieldname === 'cover' && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type!'), false);
    }
  }
});

// Helper functions for metadata management
function readMetadata() {
  try {
    const data = fs.readFileSync(metadataFile, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return { books: [] };
  }
}

function writeMetadata(data) {
  fs.writeFileSync(metadataFile, JSON.stringify(data, null, 2));
}

// Serve static files from public directory
app.use(express.static('public'));

// Serve uploaded PDFs
app.use('/uploads', express.static(uploadsDir));

// API endpoint to upload a book
app.post('/api/upload', upload.fields([{ name: 'book', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), (req, res) => {
  try {
    if (!req.files || !req.files.book) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const bookName = req.body.bookName;
    if (!bookName || bookName.trim() === '') {
      return res.status(400).json({ error: 'Book name is required' });
    }

    const bookFile = req.files.book[0];
    const coverFile = req.files.cover ? req.files.cover[0] : null;

    const bookInfo = {
      id: Date.now().toString(),
      filename: bookFile.filename,
      originalName: bookFile.originalname,
      bookName: bookName.trim(),
      coverImage: coverFile ? `/uploads/covers/${coverFile.filename}` : null,
      size: bookFile.size,
      uploadDate: new Date().toISOString(),
      path: `/uploads/${bookFile.filename}`
    };

    // Save to metadata
    const metadata = readMetadata();
    metadata.books.unshift(bookInfo); // Add to beginning
    writeMetadata(metadata);

    res.json({
      message: 'Book uploaded successfully!',
      book: bookInfo
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload book' });
  }
});

// API endpoint to get list of all books
app.get('/api/books', (req, res) => {
  try {
    const metadata = readMetadata();
    res.json({ books: metadata.books });
  } catch (error) {
    console.error('Error reading books:', error);
    res.status(500).json({ error: 'Failed to retrieve books' });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Book Sharing Platform running on port ${PORT}`);
  console.log(`📚 Upload directory: ${uploadsDir}`);
});
