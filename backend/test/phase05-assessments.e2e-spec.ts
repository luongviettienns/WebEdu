import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { CourseLevel, Role, UserStatus } from '@prisma/client';
import {
  createRealE2eAppHarness,
  extractAuthCookie,
  type RealE2eAppHarness,
} from './helpers/e2e-app-harness.js';

const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'Password123';
const here = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_DOCX = path.resolve(here, '../../frontend/e2e/fixtures/sample-questions.docx');

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(256, 1),
]);
const MP3 = Buffer.concat([Buffer.from('ID3'), Buffer.from([0x04, 0x00, 0x00]), Buffer.alloc(256, 2)]);

type Server = Parameters<typeof request>[0];

function makeClient(server: Server, cookie: string, origin: string | null = ORIGIN) {
  const auth = (req: request.Test) => {
    const withCookie = req.set('Cookie', [cookie]);
    return origin ? withCookie.set('Origin', origin) : withCookie;
  };
  return {
    get: (url: string) => auth(request(server).get(url)),
    post: (url: string) => auth(request(server).post(url)),
    patch: (url: string) => auth(request(server).patch(url)),
    put: (url: string) => auth(request(server).put(url)),
    del: (url: string) => auth(request(server).delete(url)),
  };
}
type Client = ReturnType<typeof makeClient>;

const choice = (correct = 'a') => ({
  type: 'SINGLE_CHOICE',
  prompt: '你好吗？',
  payload: {
    options: [
      { id: 'a', text: '我很好' },
      { id: 'b', text: '谢谢' },
    ],
    correctOptionIds: [correct],
  },
  points: 1,
});

function expectDenied(status: number): void {
  expect([403, 404]).toContain(status);
}

describe('Phase 5 assessments hardening (real PostgreSQL, HTTP)', () => {
  let harness: RealE2eAppHarness;
  let server: Server;
  let uploadDir: string;
  let courseId: string;
  let passwordHash: string;

  beforeAll(async () => {
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'webedu-uploads-'));
    process.env.UPLOAD_DIR = uploadDir;
    passwordHash = await bcrypt.hash(PASSWORD, 10);
    harness = await createRealE2eAppHarness();
    server = harness.app.getHttpServer() as Server;
  });

  afterAll(async () => {
    if (harness) await harness.stop();
    delete process.env.UPLOAD_DIR;
    fs.rmSync(uploadDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await harness.resetState();
    for (const f of fs.readdirSync(uploadDir)) fs.rmSync(path.join(uploadDir, f), { force: true });
    const course = await harness.prisma.course.create({
      data: { code: 'HSK1-P5', name: 'HSK 1', level: CourseLevel.HSK1 },
    });
    courseId = course.id;
  });

  async function user(email: string, roles: Role[], phone: string): Promise<Client> {
    await harness.prisma.user.create({
      data: { email, phone, fullName: email, passwordHash, roles, status: UserStatus.ACTIVE },
    });
    const res = await request(server).post('/api/v1/auth/login').send({ email, password: PASSWORD }).expect(200);
    return makeClient(server, extractAuthCookie(res).cookiePair);
  }

  async function createDraft(api: Client, title = 'Đề thử'): Promise<string> {
    const res = await api.post('/api/v1/assessments').send({ title, type: 'HOMEWORK', courseId }).expect(201);
    return (res.body as { id: string }).id;
  }

  async function addChoice(api: Client, id: string): Promise<string> {
    const res = await api.post(`/api/v1/assessments/${id}/questions`).send(choice()).expect(201);
    return (res.body as { id: string }).id;
  }

  async function upload(api: Client, id: string, kind: 'audio' | 'image'): Promise<string> {
    const attach = kind === 'audio' ? { buf: MP3, name: 'a.mp3', type: 'audio/mpeg' } : { buf: PNG, name: 'a.png', type: 'image/png' };
    const res = await api
      .post(`/api/v1/assessments/${id}/media`)
      .attach('file', attach.buf, { filename: attach.name, contentType: attach.type })
      .expect(201);
    return (res.body as { id: string }).id;
  }

  async function positions(api: Client, id: string): Promise<number[]> {
    const res = await api.get(`/api/v1/assessments/${id}`).expect(200);
    return (res.body as { questions: Array<{ position: number }> }).questions.map((q) => q.position);
  }

  it('isolates drafts per owner: other teachers and multi-role non-admins can neither read nor mutate; Admin can', async () => {
    const owner = await user('owner@webedu.vn', [Role.TEACHER], '0901000001');
    const other = await user('other@webedu.vn', [Role.TEACHER], '0901000002');
    const superTeacher = await user('st@webedu.vn', [Role.SUPERADMIN, Role.TEACHER], '0901000003');
    const admin = await user('admin@webedu.vn', [Role.ADMIN], '0901000004');

    const id = await createDraft(owner, 'Đề của chủ sở hữu');
    const qid = await addChoice(owner, id);
    const mediaId = await upload(owner, id, 'audio');
    const base = `/api/v1/assessments/${id}`;

    for (const intruder of [other, superTeacher]) {
      expectDenied((await intruder.get(base)).status);
      expectDenied((await intruder.get(`${base}/review`)).status);
      expectDenied((await intruder.get(`${base}/media`)).status);
      expectDenied((await intruder.get(`${base}/media/${mediaId}`)).status);
      expectDenied((await intruder.patch(base).send({ title: 'hack' })).status);
      expectDenied((await intruder.post(`${base}/publish`)).status);
      expectDenied((await intruder.post(`${base}/questions`).send(choice())).status);
      expectDenied((await intruder.put(`${base}/questions/reorder`).send({ questionIds: [qid] })).status);
      expectDenied((await intruder.patch(`${base}/questions/${qid}`).send({ prompt: 'hack' })).status);
      expectDenied((await intruder.del(`${base}/questions/${qid}`)).status);
      expectDenied(
        (
          await intruder
            .post(`${base}/media`)
            .attach('file', PNG, { filename: 'x.png', contentType: 'image/png' })
        ).status,
      );
      expectDenied((await intruder.del(base)).status);
      const list = await intruder.get('/api/v1/assessments').expect(200);
      expect((list.body as { total: number }).total).toBe(0);
    }

    const row = await harness.prisma.assessment.findUniqueOrThrow({ where: { id }, include: { questions: true } });
    expect(row.title).toBe('Đề của chủ sở hữu');
    expect(row.questions).toHaveLength(1);
    expect(row.questions[0]!.prompt).toBe('你好吗？');
    expect(await harness.prisma.mediaAsset.count({ where: { assessmentId: id } })).toBe(1);

    await admin.patch(base).send({ title: 'Admin sửa' }).expect(200);

    await owner.post(`${base}/publish`).expect(201);
    expect((await other.get(base)).status).toBe(200);
    expect((await other.patch(base).send({ title: 'hack' })).status).toBe(403);
    expect((await other.del(base)).status).toBe(403);
    const copy = await other.post(`${base}/duplicate`).expect(201);
    expect((copy.body as { createdById: string }).createdById).not.toBe(row.createdById);
  });

  it('duplicate gives the copy its own media and original file; deleting the source leaves the copy intact', async () => {
    const owner = await user('owner@webedu.vn', [Role.TEACHER], '0901000001');
    const imported = await owner
      .post('/api/v1/assessments/import')
      .field('courseId', courseId)
      .field('type', 'HOMEWORK')
      .attach('file', fs.readFileSync(SAMPLE_DOCX), {
        filename: 'sample-questions.docx',
        contentType: 'application/octet-stream',
      })
      .expect(201);
    const sourceId = (imported.body as { assessmentId: string }).assessmentId;
    const audioId = await upload(owner, sourceId, 'audio');
    await owner
      .post(`/api/v1/assessments/${sourceId}/questions`)
      .send({ type: 'LISTENING', prompt: 'Nghe', payload: { mediaId: audioId }, points: 1 })
      .expect(201);
    expect(fs.readdirSync(uploadDir)).toHaveLength(2);

    const dup = await owner.post(`/api/v1/assessments/${sourceId}/duplicate`).expect(201);
    const copyId = (dup.body as { id: string }).id;
    expect(fs.readdirSync(uploadDir)).toHaveLength(4);

    const copyMedia = (await owner.get(`/api/v1/assessments/${copyId}/media`).expect(200)).body as Array<{ id: string }>;
    expect(copyMedia).toHaveLength(1);
    expect(copyMedia[0]!.id).not.toBe(audioId);

    const detail = (await owner.get(`/api/v1/assessments/${copyId}`).expect(200)).body as {
      questions: Array<{ id: string; type: string; payload: { mediaId?: string } }>;
    };
    const listening = detail.questions.find((q) => q.type === 'LISTENING')!;
    expect(listening.payload.mediaId).toBe(copyMedia[0]!.id);
    await owner.patch(`/api/v1/assessments/${copyId}/questions/${listening.id}`).send({ prompt: 'Nghe lại' }).expect(200);

    await owner.del(`/api/v1/assessments/${sourceId}`).expect(200);
    expect(fs.readdirSync(uploadDir)).toHaveLength(2);
    const media = await owner.get(`/api/v1/assessments/${copyId}/media/${copyMedia[0]!.id}`).expect(200);
    expect(media.headers['content-type']).toContain('audio/mpeg');
    const original = await owner.get(`/api/v1/assessments/${copyId}/original`).expect(200);
    expect(String(original.headers['content-disposition'])).toContain('sample-questions.docx');
  });

  it('deleting a draft removes its rows and every file it owns', async () => {
    const owner = await user('owner@webedu.vn', [Role.TEACHER], '0901000001');
    const id = await createDraft(owner);
    await upload(owner, id, 'image');
    await upload(owner, id, 'audio');
    expect(fs.readdirSync(uploadDir)).toHaveLength(2);
    await owner.del(`/api/v1/assessments/${id}`).expect(200);
    expect(fs.readdirSync(uploadDir)).toHaveLength(0);
    expect(await harness.prisma.mediaAsset.count()).toBe(0);
    expect(await harness.prisma.assessment.count()).toBe(0);
  });

  it('reorder rejects duplicate ids without touching positions, and stays contiguous under concurrent adds', async () => {
    const owner = await user('owner@webedu.vn', [Role.TEACHER], '0901000001');
    const id = await createDraft(owner);
    const [q1, q2, q3] = [await addChoice(owner, id), await addChoice(owner, id), await addChoice(owner, id)] as [
      string,
      string,
      string,
    ];
    const url = `/api/v1/assessments/${id}/questions/reorder`;

    expect((await owner.put(url).send({ questionIds: [q1, q1, q2] })).status).toBe(400);
    expect((await owner.put(url).send({ questionIds: [q1, q1, q1] })).status).toBe(400);
    expect(await positions(owner, id)).toEqual([1, 2, 3]);

    const reordered = await owner.put(url).send({ questionIds: [q3, q1, q2] }).expect(200);
    expect((reordered.body as Array<{ id: string }>).map((q) => q.id)).toEqual([q3, q1, q2]);

    const results = await Promise.all([
      owner.put(url).send({ questionIds: [q2, q3, q1] }),
      owner.post(`/api/v1/assessments/${id}/questions`).send(choice()),
      owner.post(`/api/v1/assessments/${id}/questions`).send(choice()),
      owner.put(url).send({ questionIds: [q1, q2, q3] }),
    ]);
    for (const res of results) expect(res.status).toBeLessThan(500);
    const finalPositions = await positions(owner, id);
    expect(finalPositions).toEqual(finalPositions.map((_, i) => i + 1));
  });

  it('only accepts media of the right kind that belongs to the same assessment', async () => {
    const owner = await user('owner@webedu.vn', [Role.TEACHER], '0901000001');
    const id = await createDraft(owner);
    const otherId = await createDraft(owner, 'Đề khác');
    const audio = await upload(owner, id, 'audio');
    const image = await upload(owner, id, 'image');
    const foreignAudio = await upload(owner, otherId, 'audio');
    const post = (body: object) => owner.post(`/api/v1/assessments/${id}/questions`).send(body);

    const listening = (mediaId: string) => ({ type: 'LISTENING', prompt: 'Nghe', payload: { mediaId }, points: 1 });
    const imageBased = (mediaId: string) => ({
      type: 'IMAGE_BASED',
      prompt: 'Nhìn',
      payload: { mediaId, options: [], correctOptionIds: [] },
      points: 1,
    });

    expect((await post(listening(image))).status).toBe(400);
    expect((await post(listening(foreignAudio))).status).toBe(400);
    expect((await post(imageBased(audio))).status).toBe(400);
    expect((await post(listening(audio))).status).toBe(201);
    expect((await post(imageBased(image))).status).toBe(201);
  });

  it('keeps CSRF protection on multipart upload and import endpoints', async () => {
    const owner = await user('owner@webedu.vn', [Role.TEACHER], '0901000001');
    const id = await createDraft(owner);
    const cookie = (await request(server).post('/api/v1/auth/login').send({ email: 'owner@webedu.vn', password: PASSWORD }))
      .headers['set-cookie'];
    const pair = String((cookie as unknown as string[])[0]).split(';')[0]!;

    const evil = makeClient(server, pair, 'https://evil.example.com');
    const noOrigin = makeClient(server, pair, null);
    for (const client of [evil, noOrigin]) {
      const media = await client
        .post(`/api/v1/assessments/${id}/media`)
        .attach('file', PNG, { filename: 'x.png', contentType: 'image/png' });
      expect(media.status).toBe(403);
      const imp = await client
        .post('/api/v1/assessments/import')
        .field('courseId', courseId)
        .field('type', 'HOMEWORK')
        .attach('file', fs.readFileSync(SAMPLE_DOCX), { filename: 'x.docx' });
      expect(imp.status).toBe(403);
    }
    expect(await harness.prisma.mediaAsset.count()).toBe(0);
  });

  it('rejects blank, oversized and malformed input instead of storing it or failing with 500', async () => {
    const owner = await user('owner@webedu.vn', [Role.TEACHER], '0901000001');
    const create = (body: object) => owner.post('/api/v1/assessments').send({ type: 'HOMEWORK', courseId, ...body });
    expect((await create({ title: '   ' })).status).toBe(400);
    expect((await create({ title: 'ok', durationMinutes: 2147483648 })).status).toBe(400);
    expect((await create({ title: 'ok', durationMinutes: 0 })).status).toBe(400);

    const id = await createDraft(owner);
    const audio = await upload(owner, id, 'audio');
    const add = (body: object) => owner.post(`/api/v1/assessments/${id}/questions`).send(body);
    expect((await add({ ...choice(), prompt: '   ' })).status).toBe(400);
    expect((await add({ ...choice(), points: 1_000_000_000 })).status).toBe(400);
    expect(
      (await add({ type: 'ORDERING', prompt: 'Sắp xếp', payload: { tokens: ['我', '好'] }, points: 1 })).status,
    ).toBe(400);
    expect((await add({ type: 'ESSAY', prompt: 'Viết', payload: { maxLength: -5 }, points: 1 })).status).toBe(400);
    expect(
      (await add({ type: 'LISTENING', prompt: 'Nghe', payload: { mediaId: audio, maxListens: 'abc' }, points: 1 })).status,
    ).toBe(400);

    const qid = await addChoice(owner, id);
    expect((await owner.patch(`/api/v1/assessments/${id}/questions/${qid}`).send({ prompt: '' })).status).toBe(400);
    expect(await positions(owner, id)).toEqual([1]);
  });

  it('publishes only a non-empty, fully valid draft, and freezes it afterwards', async () => {
    const owner = await user('owner@webedu.vn', [Role.TEACHER], '0901000001');
    const id = await createDraft(owner);
    const base = `/api/v1/assessments/${id}`;
    expect((await owner.post(`${base}/publish`)).status).toBe(400);

    await owner.post(`${base}/questions`).send({ type: 'ESSAY', prompt: 'Viết', payload: {}, points: 2 }).expect(201);
    expect((await owner.post(`${base}/publish`)).status).toBe(400);

    const essay = ((await owner.get(base).expect(200)).body as { questions: Array<{ id: string }> }).questions[0]!;
    await owner.patch(`${base}/questions/${essay.id}`).send({ payload: { rubric: 'Đủ ý' } }).expect(200);
    await owner.post(`${base}/publish`).expect(201);
    expect((await owner.post(`${base}/publish`)).status).toBeLessThan(500);

    expect((await owner.patch(base).send({ title: 'sửa sau phát hành' })).status).toBe(409);
    expect((await owner.post(`${base}/questions`).send(choice())).status).toBe(409);
    expect((await owner.del(base)).status).toBe(409);
  });

  it('survives delete/publish racing with question writes without 5xx or half-deleted rows', async () => {
    const owner = await user('owner@webedu.vn', [Role.TEACHER], '0901000001');
    for (let round = 0; round < 6; round += 1) {
      const doomed = await createDraft(owner, `Xóa ${round}`);
      await addChoice(owner, doomed);
      const deleted = await Promise.all([
        owner.del(`/api/v1/assessments/${doomed}`),
        owner.post(`/api/v1/assessments/${doomed}/questions`).send(choice()),
        owner.post(`/api/v1/assessments/${doomed}/questions`).send(choice()),
      ]);
      for (const res of deleted) expect(res.status).toBeLessThan(500);
      const orphans = await harness.prisma.question.count({ where: { assessmentId: doomed } });
      const stillThere = await harness.prisma.assessment.count({ where: { id: doomed } });
      if (stillThere === 0) expect(orphans).toBe(0);

      const racing = await createDraft(owner, `Phát hành ${round}`);
      await addChoice(owner, racing);
      const published = await Promise.all([
        owner.post(`/api/v1/assessments/${racing}/publish`),
        owner.post(`/api/v1/assessments/${racing}/questions`).send(choice()),
      ]);
      for (const res of published) expect(res.status).toBeLessThan(500);
      const row = await harness.prisma.assessment.findUniqueOrThrow({ where: { id: racing }, include: { questions: true } });
      expect(row.questions.map((q) => q.position)).toEqual(row.questions.map((_, i) => i + 1));
    }
  });

  it('treats % and _ in the title search as literal characters', async () => {
    const owner = await user('owner@webedu.vn', [Role.TEACHER], '0901000001');
    await createDraft(owner, 'Đề HSK1 100%');
    await createDraft(owner, 'Đề HSK1 mini');
    await createDraft(owner, 'Đề a_b');
    await createDraft(owner, 'Đề axb');
    const search = async (term: string) =>
      ((await owner.get(`/api/v1/assessments?search=${encodeURIComponent(term)}`).expect(200)).body as { total: number }).total;
    expect(await search('%')).toBe(1);
    expect(await search('_')).toBe(1);
    expect(await search('hsk1')).toBe(2);
  });

  it('imports a real text-layer .pdf with Vietnamese/Russian filename and streams RFC 5987 Content-Disposition', async () => {
    const owner = await user('owner@webedu.vn', [Role.TEACHER], '0901000001');
    const stream = [
      'BT /F1 12 Tf 72 720 Td (1. Ni hao?) Tj',
      '0 -20 Td (A. Xin chao) Tj',
      '0 -20 Td (B. Tam biet) Tj',
      '0 -20 Td (Answer: A) Tj ET',
    ].join('\n');
    const objs = [
      '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n',
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n',
      '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>>>>>>/Contents 4 0 R>>endobj\n',
      `4 0 obj<</Length ${Buffer.byteLength(stream)}>>stream\n${stream}\nendstream\nendobj\n`,
    ];
    let offset = Buffer.byteLength('%PDF-1.4\n');
    const xref = ['0000000000 65535 f \n'];
    for (const o of objs) {
      xref.push(`${String(offset).padStart(10, '0')} 00000 n \n`);
      offset += Buffer.byteLength(o);
    }
    const body = `%PDF-1.4\n${objs.join('')}`;
    const pdfBuf = Buffer.from(
      `${body}xref\n0 ${objs.length + 1}\n${xref.join('')}trailer<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${Buffer.byteLength(body)}\n%%EOF`,
      'ascii',
    );
    const filename = 'Đề thi Русский.pdf';
    const imported = await owner
      .post('/api/v1/assessments/import')
      .field('courseId', courseId)
      .field('type', 'HOMEWORK')
      .attach('file', pdfBuf, { filename, contentType: 'application/pdf' })
      .expect(201);
    const id = (imported.body as { assessmentId: string }).assessmentId;
    const detail = (await owner.get(`/api/v1/assessments/${id}`).expect(200)).body as {
      originalFileName: string | null;
      questions: Array<{ type: string; prompt: string }>;
    };
    expect(detail.originalFileName).toBe(filename);
    expect(detail.questions).toHaveLength(1);
    expect(detail.questions[0]!.type).toBe('SINGLE_CHOICE');
    expect(detail.questions[0]!.prompt).toContain('Ni hao?');

    const orig = await owner.get(`/api/v1/assessments/${id}/original`).expect(200);
    expect(orig.headers['content-type']).toContain('application/pdf');
    expect(String(orig.headers['content-disposition'])).toContain(
      `filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    expect(fs.readdirSync(uploadDir)).toHaveLength(1);
    await owner.del(`/api/v1/assessments/${id}`).expect(200);
    expect(fs.readdirSync(uploadDir)).toHaveLength(0);
  });
});
