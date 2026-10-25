'use strict';

const { validateImageUpload, detectImageType } = require('../src/utils/fileUploadValidator');

describe('Secure File Upload Validator', () => {
  it('accepts valid PNG magic bytes', () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    const res = validateImageUpload(pngBuffer);
    expect(res.valid).toBe(true);
    expect(res.mimeType).toBe('image/png');
  });

  it('accepts valid JPEG magic bytes', () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    const res = validateImageUpload(jpegBuffer);
    expect(res.valid).toBe(true);
    expect(res.mimeType).toBe('image/jpeg');
  });

  it('accepts valid GIF magic bytes', () => {
    const gifBuffer = Buffer.from('GIF89a...');
    const res = validateImageUpload(gifBuffer);
    expect(res.valid).toBe(true);
    expect(res.mimeType).toBe('image/gif');
  });

  it('accepts valid WEBP magic bytes', () => {
    // RIFF....WEBP
    const webpBuffer = Buffer.concat([
      Buffer.from([0x52, 0x49, 0x46, 0x46]), // RIFF
      Buffer.from([0x00, 0x00, 0x00, 0x00]), // size
      Buffer.from('WEBP'),
    ]);
    const res = validateImageUpload(webpBuffer);
    expect(res.valid).toBe(true);
    expect(res.mimeType).toBe('image/webp');
  });

  it('rejects binary executable or PHP scripts disguised as images', () => {
    const phpBuffer = Buffer.from('<?php echo "evil"; ?>');
    expect(() => validateImageUpload(phpBuffer)).toThrow('Invalid file format');
  });

  it('rejects files larger than 5MB', () => {
    const bigBuffer = Buffer.alloc(5 * 1024 * 1024 + 1);
    bigBuffer[0] = 0x89;
    bigBuffer[1] = 0x50;
    bigBuffer[2] = 0x4e;
    bigBuffer[3] = 0x47;
    bigBuffer[4] = 0x0d;
    bigBuffer[5] = 0x0a;
    bigBuffer[6] = 0x1a;
    bigBuffer[7] = 0x0a;

    expect(() => validateImageUpload(bigBuffer)).toThrow('File exceeds maximum permitted size of 5.0MB');
  });
});
