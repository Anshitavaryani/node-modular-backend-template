// Multipart uploads (multer). Files are written under STORAGE_DIR/uploads/<field>, and only the types listed below
// are accepted. The fields a route accepts are chosen with uploadFields([...]) in that route's file.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { UPLOADS_DIR } = require('../config/paths');
const ApiError = require('./ApiError');
const httpStatus = require('./status');

const FIELDS = ['images', 'gifs', 'videos', 'docs', 'audios'];
for (const field of FIELDS) fs.mkdirSync(path.join(UPLOADS_DIR, field), { recursive: true });

const MIME_TO_EXT = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'application/pdf': 'pdf',
    'audio/mpeg': 'mp3',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

// Checked on the declared MIME type and the extension. Both come from the client, so they can be faked; anything
// stored and served publicly should also be sniffed (see docs/architecture.md, "Uploads").
const accepted = (file) => {
    const ext = path.extname(file.originalname).slice(1).toLowerCase();
    return Boolean(MIME_TO_EXT[file.mimetype]) && ['jpeg', 'jpg', 'png', 'gif', 'mp4', 'mov', 'pdf', 'mp3', 'doc', 'docx'].includes(ext);
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!FIELDS.includes(file.fieldname)) return cb(new Error('Invalid upload field'));
        return cb(null, path.join(UPLOADS_DIR, file.fieldname));
    },
    filename: (req, file, cb) => {
        const ext = MIME_TO_EXT[file.mimetype] || 'bin';
        cb(null, `${file.fieldname}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024, files: 50 },
    fileFilter: (req, file, cb) => {
        if (accepted(file)) return cb(null, true);
        return cb(ApiError.withCode(httpStatus.BAD_REQUEST, 'This file type is not allowed.', 'FILE_TYPE_NOT_ALLOWED'));
    },
});

// uploadFields([{ name: 'images', maxCount: 10 }]) -> middleware that fills req.files
const uploadFields = (fields) => upload.fields(fields);

module.exports = { uploadFields, UPLOADS_DIR, FIELDS };
