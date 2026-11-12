import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { htmlToPlainText, type ExtractedImage } from '../policies/document-import.parser.js';

export type ExtractedDocument = { text: string; images: ExtractedImage[] };

export async function extractDocx(buffer: Buffer): Promise<ExtractedDocument> {
  const mammoth = await import('mammoth');
  const result = await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const b64 = await image.read('base64');
        return { src: `data:${image.contentType};base64,${b64}` };
      }),
    },
  );
  return htmlToPlainText(result.value);
}

export async function extractPdf(buffer: Buffer): Promise<ExtractedDocument> {
  const pdfjs = await import('pdfjs-dist');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const lines: string[] = [];
  for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
    const page = await doc.getPage(pageNo);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    let line = '';
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const y = 'transform' in item ? Number(item.transform[5]) : 0;
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        if (line.trim()) lines.push(line.trim());
        line = '';
      }
      line += (line ? ' ' : '') + item.str;
      lastY = y;
    }
    if (line.trim()) lines.push(line.trim());
  }
  return { text: lines.join('\n'), images: [] };
}

/** shortcut: local disk uploads/, replace with object storage when deploying */
export async function persistMediaBytes(bytes: Buffer, mime: string): Promise<string> {
  const id = randomUUID();
  const ext = mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : 'bin';
  const rel = `uploads/media/${id}.${ext}`;
  const abs = join(process.cwd(), rel);
  await mkdir(join(process.cwd(), 'uploads', 'media'), { recursive: true });
  await writeFile(abs, bytes);
  return rel;
}
