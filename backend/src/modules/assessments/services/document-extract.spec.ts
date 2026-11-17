import { BadRequestException } from '@nestjs/common';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { assertSafeDocxZip } from '../policies/media-upload.policy.js';
import {
  cloneAssessmentFiles,
  copyStoredFile,
  extractDocx,
  extractPdf,
  mimeFromFilename,
  persistMediaBytes,
  readStoredFile,
  unlinkStoredFile,
} from './document-extract.js';

describe('document-extract disk & parser helpers', () => {
  const dirs: string[] = [];
  const prevUploadDir = process.env.UPLOAD_DIR;

  function makeTempUploadDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'webedu-doc-'));
    dirs.push(dir);
    process.env.UPLOAD_DIR = dir;
    return dir;
  }

  afterEach(() => {
    if (prevUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = prevUploadDir;
    while (dirs.length > 0) rmSync(dirs.pop()!, { recursive: true, force: true });
  });

  it('persists, reads, copies, clones, maps mimes, and unlinks files safely', async () => {
    makeTempUploadDir();
    const key = await persistMediaBytes(Buffer.from('hello-png'), 'image/png');
    expect(key).toMatch(/^uploads\/media\/.+\.png$/);
    await expect(readStoredFile(key)).resolves.toEqual(Buffer.from('hello-png'));
    await expect(readStoredFile('../etc/passwd')).resolves.toBeNull();
    await expect(readStoredFile('uploads/media/..')).resolves.toBeNull();

    const copied = await copyStoredFile(key);
    expect(copied).toMatch(/^uploads\/media\/.+\.png$/);
    expect(copied).not.toBe(key);
    expect(await copyStoredFile('uploads/media/missing.png')).toBeNull();
    expect(await copyStoredFile('../bad.png')).toBeNull();

    const cloned = await cloneAssessmentFiles(key, [
      { id: 'm1', storageKey: copied! },
      { id: 'm2', storageKey: 'uploads/media/missing.png' },
    ]);
    expect(cloned.originalKey).toBeTruthy();
    expect(cloned.clonedAssets).toHaveLength(1);
    expect(cloned.copiedKeys).toHaveLength(2);

    await unlinkStoredFile(key);
    await expect(readStoredFile(key)).resolves.toBeNull();
    await unlinkStoredFile('../invalid');
    await unlinkStoredFile('uploads/media/does-not-exist.png');

    expect(mimeFromFilename('de.docx')).toContain('wordprocessingml');
    expect(mimeFromFilename('anh.jpeg')).toBe('image/jpeg');
    expect(mimeFromFilename('unknown.xyz')).toBe('application/octet-stream');
  });

function buildMinimalPdf(text: string): Buffer {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n',
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n',
    '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>>>>>>/Contents 4 0 R>>endobj\n',
    `4 0 obj<</Length ${Buffer.byteLength(stream)}>>stream\n${stream}\nendstream\nendobj\n`,
  ];
  const header = '%PDF-1.4\n';
  let offset = Buffer.byteLength(header);
  const xrefEntries = ['0000000000 65535 f \n'];
  for (const obj of objects) {
    xrefEntries.push(`${String(offset).padStart(10, '0')} 00000 n \n`);
    offset += Buffer.byteLength(obj);
  }
  const body = header + objects.join('');
  const xrefStart = Buffer.byteLength(body);
  const trailer = `xref\n0 ${objects.length + 1}\n${xrefEntries.join('')}trailer<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(body + trailer, 'ascii');
}

  it('extracts sample docx + minimal pdf and throws BadRequestException on corrupt docx/pdf', async () => {
    const sample = readFileSync(join(process.cwd(), '../frontend/e2e/fixtures/sample-questions.docx'));
    const extracted = await extractDocx(sample);
    expect(extracted.text.length).toBeGreaterThan(10);

    const pdfRes = await extractPdf(buildMinimalPdf('Cau 1. Hello'));
    expect(pdfRes.text).toContain('Cau 1. Hello');

    await expect(extractDocx(Buffer.from('not-a-docx'))).rejects.toThrow(BadRequestException);
    await expect(extractPdf(Buffer.from('not-a-pdf'))).rejects.toThrow(BadRequestException);

    // Worker thread execution must terminate cleanly on timeout and preserve Buffer image payloads
    await expect(extractDocx(sample, 1)).rejects.toThrowError(
      new BadRequestException('File quá phức tạp, vượt thời gian xử lý'),
    );
    await expect(extractPdf(buildMinimalPdf('Cau 1. Hello'), 1)).rejects.toThrowError(
      new BadRequestException('File quá phức tạp, vượt thời gian xử lý'),
    );
    expect(extracted.images.every((img) => Buffer.isBuffer(img.bytes))).toBe(true);
  }, 60_000);

function buildMinimalZip(entries: Array<{ name: string; data: Buffer }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const compressed = deflateRawSync(entry.data);
    const sum = crc32(entry.data);

    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(sum >>> 0, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    nameBuf.copy(local, 30);
    localParts.push(local, compressed);

    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(sum >>> 0, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    nameBuf.copy(central, 46);
    centralParts.push(central);

    offset += local.length + compressed.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...localParts, centralDir, eocd]);
}

it('limits DOCX decompression to the verified entry size before extraction', async () => {
  const zip = buildMinimalZip([{ name: 'word/document.xml', data: Buffer.alloc(128 * 1024, 97) }]);
  await expect(assertSafeDocxZip(zip)).resolves.toBeUndefined();
  const ambiguousDirectory = Buffer.concat([zip, Buffer.from([0x50, 0x4b, 0x05, 0x06])]);
  ambiguousDirectory.writeUInt16LE(4, zip.length - 2);
  await expect(assertSafeDocxZip(ambiguousDirectory)).rejects.toThrow(BadRequestException);
  const centralOffset = zip.readUInt32LE(zip.length - 6);
  zip.writeUInt32LE(1, centralOffset + 24);
  await expect(assertSafeDocxZip(zip)).rejects.toThrow(BadRequestException);
});

function buildDocxWithImage(imageBytes: Buffer): Buffer {
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
</Relationships>`;
  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    <w:p><w:r><w:t>Cau 1. Hello</w:t></w:r></w:p>
    <w:p><w:r><w:drawing><wp:inline><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:blipFill><a:blip r:embed="rId2"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>
  </w:body>
</w:document>`;

  return buildMinimalZip([
    { name: '[Content_Types].xml', data: Buffer.from(contentTypes, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(rootRels, 'utf8') },
    { name: 'word/document.xml', data: Buffer.from(docXml, 'utf8') },
    { name: 'word/_rels/document.xml.rels', data: Buffer.from(docRels, 'utf8') },
    { name: 'word/media/image1.png', data: imageBytes },
  ]);
}

  it('rejects embedded docx image > 5MB with BadRequestException instead of silently dropping it', async () => {
    const oversizedPng = Buffer.alloc(5 * 1024 * 1024 + 1, 0);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(oversizedPng, 0);
    const docxWithOversizedImg = buildDocxWithImage(oversizedPng);

    await expect(extractDocx(docxWithOversizedImg)).rejects.toThrowError(
      new BadRequestException('Ảnh nhúng vượt quá 5MB'),
    );
  }, 60_000);
});
