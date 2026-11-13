import { BadRequestException } from '@nestjs/common';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
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
  }, 60_000);
});
