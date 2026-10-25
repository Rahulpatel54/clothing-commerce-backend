'use strict';

const ApiError = require('./ApiError');

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const MAGIC_BYTES = {
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  gif: [0x47, 0x49, 0x46, 0x38],
  webp: [0x52, 0x49, 0x46, 0x46], // Starts with RIFF
};

function matchesMagicBytes(buffer, signature) {
  if (buffer.length < signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) return false;
  }
  return true;
}

function detectImageType(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;

  if (matchesMagicBytes(buffer, MAGIC_BYTES.png)) return 'image/png';
  if (matchesMagicBytes(buffer, MAGIC_BYTES.jpeg)) return 'image/jpeg';
  if (matchesMagicBytes(buffer, MAGIC_BYTES.gif)) return 'image/gif';
  if (matchesMagicBytes(buffer, MAGIC_BYTES.webp)) {
    // Check for WEBP subheader at offset 8
    if (buffer.length >= 12 && buffer.toString('utf8', 8, 12) === 'WEBP') {
      return 'image/webp';
    }
  }

  return null;
}

/**
 * Validates file buffer for safe image upload.
 * Rejects oversized files, invalid MIME types, and spoofed extensions.
 */
function validateImageUpload(buffer, { maxSizeBytes = MAX_FILE_SIZE_BYTES } = {}) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw ApiError.badRequest('No file buffer provided or file is empty');
  }

  if (buffer.length > maxSizeBytes) {
    throw ApiError.badRequest(
      `File exceeds maximum permitted size of ${(maxSizeBytes / (1024 * 1024)).toFixed(1)}MB`
    );
  }

  const detectedMime = detectImageType(buffer);
  if (!detectedMime) {
    throw ApiError.badRequest('Invalid file format. Only JPEG, PNG, WEBP, and GIF images are permitted.');
  }

  return {
    valid: true,
    mimeType: detectedMime,
    size: buffer.length,
  };
}

module.exports = {
  validateImageUpload,
  detectImageType,
  MAX_FILE_SIZE_BYTES,
};
