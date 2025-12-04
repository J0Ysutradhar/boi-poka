// Global state
let currentBooks = [];
let currentPage = 1;
let pdfDoc = null;
let pageRendering = false;
let pageNumPending = null;
let scale = 1.5;
let currentBookData = null;

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// DOM Elements
const libraryView = document.getElementById('libraryView');
const uploadView = document.getElementById('uploadView');
const readerView = document.getElementById('readerView');
const booksGrid = document.getElementById('booksGrid');
const emptyState = document.getElementById('emptyState');
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const uploadProgress = document.getElementById('uploadProgress');
const uploadResult = document.getElementById('uploadResult');
const searchInput = document.getElementById('searchInput');
const toast = document.getElementById('toast');
const uploadForm = document.getElementById('uploadForm');
const bookNameInput = document.getElementById('bookNameInput');
const coverInput = document.getElementById('coverInput');
const coverSelectBtn = document.getElementById('coverSelectBtn');
const coverFileName = document.getElementById('coverFileName');
const coverPreview = document.getElementById('coverPreview');
const coverPreviewImg = document.getElementById('coverPreviewImg');

// Navigation handling
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        switchView(view);
    });
});

function switchView(viewName) {
    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

    // Show selected view
    document.getElementById(`${viewName}View`).classList.add('active');

    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    // Load books when switching to library
    if (viewName === 'library') {
        loadBooks();
    }
}

// Load books from server
async function loadBooks() {
    try {
        const response = await fetch('/api/books');
        const data = await response.json();
        currentBooks = data.books || [];
        displayBooks(currentBooks);
    } catch (error) {
        console.error('Error loading books:', error);
        showToast('Failed to load books', 'error');
    }
}

// Display books in grid
function displayBooks(books) {
    if (books.length === 0) {
        booksGrid.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    booksGrid.innerHTML = books.map(book => {
        const displayName = book.bookName || book.originalName;
        const coverHtml = book.coverImage
            ? `<img src="${book.coverImage}" alt="${escapeHtml(displayName)}" class="book-cover">`
            : `<div class="book-icon">📖</div>`;

        return `
            <div class="book-card" onclick="openBook('${book.filename}', '${escapeHtml(displayName)}')">
                ${coverHtml}
                <div class="book-title" title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</div>
                <div class="book-info">
                    <span class="book-size">${formatFileSize(book.size)}</span>
                    <span>${formatDate(book.uploadDate)}</span>
                </div>
            </div>
        `;
    }).join('');
}

// Search functionality
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = currentBooks.filter(book => {
        const displayName = book.bookName || book.originalName;
        return displayName.toLowerCase().includes(query);
    });
    displayBooks(filtered);
});

// Cover image handling
coverSelectBtn.addEventListener('click', () => coverInput.click());

coverInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        coverFileName.textContent = file.name;

        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            coverPreviewImg.src = e.target.result;
            coverPreview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    } else {
        coverFileName.textContent = 'No file chosen';
        coverPreview.classList.add('hidden');
    }
});

// Upload handling
uploadArea.addEventListener('click', () => fileInput.click());

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileUpload(files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    const fileName = e.target.files[0]?.name || 'No file chosen';
    const uploadInfo = uploadArea.querySelector('.upload-info');
    if (e.target.files.length > 0) {
        uploadInfo.textContent = `Selected: ${fileName}`;
    } else {
        uploadInfo.textContent = 'Max file size: 50MB • PDF only';
    }
});

// Form submit handler
uploadForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleFormSubmit();
});

async function handleFormSubmit() {
    // Validate form
    const bookName = bookNameInput.value.trim();
    const pdfFile = fileInput.files[0];
    const coverFile = coverInput.files[0];

    if (!bookName) {
        showToast('Please enter a book name', 'error');
        return;
    }

    if (!pdfFile) {
        showToast('Please select a PDF file', 'error');
        return;
    }

    if (pdfFile.type !== 'application/pdf') {
        showToast('Please upload a PDF file', 'error');
        return;
    }

    if (pdfFile.size > 50 * 1024 * 1024) {
        showToast('File size must be less than 50MB', 'error');
        return;
    }

    // Show progress
    uploadResult.classList.add('hidden');
    uploadProgress.classList.remove('hidden');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    try {
        const formData = new FormData();
        formData.append('book', pdfFile);
        formData.append('bookName', bookName);
        if (coverFile) {
            formData.append('cover', coverFile);
        }

        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percent = (e.loaded / e.total) * 100;
                progressFill.style.width = percent + '%';
                progressText.textContent = `Uploading... ${Math.round(percent)}%`;
            }
        });

        xhr.addEventListener('load', () => {
            uploadProgress.classList.add('hidden');

            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                uploadResult.className = 'upload-result success';
                uploadResult.textContent = '✓ Book uploaded successfully!';
                uploadResult.classList.remove('hidden');

                showToast('Book uploaded successfully!', 'success');

                // Reset form
                uploadForm.reset();
                coverFileName.textContent = 'No file chosen';
                coverPreview.classList.add('hidden');
                const uploadInfo = uploadArea.querySelector('.upload-info');
                uploadInfo.textContent = 'Max file size: 50MB • PDF only';

                // Reload books
                setTimeout(() => {
                    uploadResult.classList.add('hidden');
                    switchView('library');
                }, 2000);
            } else {
                const response = JSON.parse(xhr.responseText);
                throw new Error(response.error || 'Upload failed');
            }
        });

        xhr.addEventListener('error', () => {
            throw new Error('Upload failed');
        });

        xhr.open('POST', '/api/upload');
        xhr.send(formData);

    } catch (error) {
        console.error('Upload error:', error);
        uploadProgress.classList.add('hidden');
        uploadResult.className = 'upload-result error';
        uploadResult.textContent = `✗ ${error.message}`;
        uploadResult.classList.remove('hidden');
        showToast(error.message, 'error');
    }
}

// PDF Reader
async function openBook(filename, title) {
    switchView('reader');

    // Update title
    document.getElementById('readerTitle').textContent = title;
    currentBookData = { filename, title };

    // Load PDF
    const url = `/uploads/${filename}`;

    try {
        pdfDoc = await pdfjsLib.getDocument(url).promise;
        document.getElementById('pageCount').textContent = pdfDoc.numPages;
        currentPage = 1;
        scale = 1.5;
        document.getElementById('zoomLevel').textContent = '100%';
        renderPage(currentPage);
    } catch (error) {
        console.error('Error loading PDF:', error);
        showToast('Failed to load PDF', 'error');
    }
}

function renderPage(num) {
    pageRendering = true;

    pdfDoc.getPage(num).then(page => {
        const canvas = document.getElementById('pdfCanvas');
        const ctx = canvas.getContext('2d');
        const viewport = page.getViewport({ scale: scale });

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };

        const renderTask = page.render(renderContext);

        renderTask.promise.then(() => {
            pageRendering = false;
            if (pageNumPending !== null) {
                renderPage(pageNumPending);
                pageNumPending = null;
            }
        });
    });

    document.getElementById('pageNum').textContent = num;
}

function queueRenderPage(num) {
    if (pageRendering) {
        pageNumPending = num;
    } else {
        renderPage(num);
    }
}

// PDF Controls
document.getElementById('prevPage').addEventListener('click', () => {
    if (currentPage <= 1) return;
    currentPage--;
    queueRenderPage(currentPage);
});

document.getElementById('nextPage').addEventListener('click', () => {
    if (currentPage >= pdfDoc.numPages) return;
    currentPage++;
    queueRenderPage(currentPage);
});

document.getElementById('zoomIn').addEventListener('click', () => {
    scale += 0.25;
    document.getElementById('zoomLevel').textContent = Math.round(scale * 66.67) + '%';
    queueRenderPage(currentPage);
});

document.getElementById('zoomOut').addEventListener('click', () => {
    if (scale <= 0.5) return;
    scale -= 0.25;
    document.getElementById('zoomLevel').textContent = Math.round(scale * 66.67) + '%';
    queueRenderPage(currentPage);
});

document.getElementById('backToLibrary').addEventListener('click', () => {
    switchView('library');
    pdfDoc = null;
});

document.getElementById('downloadBtn').addEventListener('click', () => {
    if (currentBookData) {
        const link = document.createElement('a');
        link.href = `/uploads/${currentBookData.filename}`;
        link.download = currentBookData.title;
        link.click();
        showToast('Download started', 'success');
    }
});

// Utility functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 1) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = 'toast show';

    if (type === 'error') {
        toast.style.borderLeft = '4px solid var(--error)';
    } else if (type === 'success') {
        toast.style.borderLeft = '4px solid var(--success)';
    } else {
        toast.style.borderLeft = '4px solid var(--accent-primary)';
    }

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (readerView.classList.contains('active')) {
        if (e.key === 'ArrowLeft') {
            document.getElementById('prevPage').click();
        } else if (e.key === 'ArrowRight') {
            document.getElementById('nextPage').click();
        } else if (e.key === 'Escape') {
            document.getElementById('backToLibrary').click();
        }
    }
});

// Initial load
loadBooks();
