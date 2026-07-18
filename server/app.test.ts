// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { CodexManagerPort } from './ai/codex-routes.ts';
import { buildApp, type AppOptions } from './app.ts';
import { openDb } from './db.ts';
import { DEMO_PASSWORD, seed } from './seed.ts';

async function makeApp(options?: AppOptions) {
  const db = openDb(':memory:');
  seed(db);
  const app = buildApp(db, options);
  await app.ready();
  return app;
}

const TEACHER_EMAIL = 'co.ha@nekopath.edu.vn';
const STUDENT_EMAIL = 'an@nekopath.edu.vn';
const OTHER_STUDENT_EMAIL = 'chi@nekopath.edu.vn';

async function loginCookie(app: Awaited<ReturnType<typeof makeApp>>, email: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password: DEMO_PASSWORD },
  });
  expect(response.statusCode).toBe(200);
  const cookie = response.cookies.find((c) => c.name === 'nekopath_sid');
  const profile = response.cookies.find((c) => c.name === 'nekopath_profile');
  expect(cookie).toBeTruthy();
  expect(profile).toBeTruthy();
  return { nekopath_sid: cookie!.value, nekopath_profile: profile!.value };
}

describe('NekoPath API', () => {
  it('reports provider availability without exposing secrets', async () => {
    const app = await makeApp({ openAiApiKey: '' });
    const teacher = await loginCookie(app, TEACHER_EMAIL);
    const response = await app.inject({
      method: 'GET',
      url: '/api/ai/providers',
      cookies: teacher,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      providers: expect.arrayContaining([
        expect.objectContaining({ id: 'openai', available: false }),
      ]),
    });
    expect(response.body).not.toContain('apiKey');
    await app.close();
  });

  it('keeps Responses teacher-only and forwards a strict server-owned request', async () => {
    const upstream = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          'data: {"type":"response.output_text.delta","delta":"Đã rõ"}\n\n' +
            'data: {"type":"response.completed","response":{"usage":{"input_tokens":4,"output_tokens":2}}}\n\n',
          { status: 200, headers: { 'content-type': 'text/event-stream' } },
        ),
    );
    const app = await makeApp({
      openAiApiKey: 'server-secret',
      openAiModel: 'gpt-test',
      fetchImpl: upstream,
    });
    const teacher = await loginCookie(app, TEACHER_EMAIL);
    const student = await loginCookie(app, STUDENT_EMAIL);
    const payload = {
      input: [{ role: 'user', content: 'Chào' }],
      tools: [
        {
          type: 'function',
          name: 'fact',
          description: 'Read facts.',
          parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
          strict: true,
        },
      ],
    };

    expect(
      (await app.inject({ method: 'POST', url: '/api/ai/responses', cookies: student, payload }))
        .statusCode,
    ).toBe(403);
    const response = await app.inject({
      method: 'POST',
      url: '/api/ai/responses',
      cookies: teacher,
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.body).toContain('response.output_text.delta');
    const [url, init] = upstream.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer server-secret');
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: 'gpt-test',
      store: false,
      stream: true,
      input: payload.input,
    });
    await app.close();
  });

  it('exposes managed ChatGPT only to teachers and disposes it on NekoPath logout', async () => {
    const logout = vi.fn(async () => undefined);
    const manager: CodexManagerPort = {
      isEnabled: () => true,
      status: async () => ({
        account: { type: 'chatgpt', email: 'teacher@example.test', planType: 'plus' },
        requiresOpenaiAuth: true,
      }),
      models: async () => [
        {
          id: 'gpt-5.5',
          model: 'gpt-5.5',
          displayName: 'GPT 5.5',
          description: 'Fast',
          isDefault: true,
        },
      ],
      startLogin: async () => ({
        loginId: 'login-1',
        authUrl: 'https://auth.openai.com/authorize?client_id=codex',
      }),
      complete: async (_accountId, _prompt, onDelta, _signal, model) => {
        onDelta?.('Chỉ dựa ');
        onDelta?.('trên bằng chứng.');
        return {
          content: 'Chỉ dựa trên bằng chứng.',
          modelId: model ?? 'gpt-5.5',
          usage: { inputTokens: 12, outputTokens: 5 },
        };
      },
      logout,
      disposeAll: vi.fn(),
    };
    const app = await makeApp({ codexManager: manager });
    const teacher = await loginCookie(app, TEACHER_EMAIL);
    const student = await loginCookie(app, STUDENT_EMAIL);

    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/api/ai/chatgpt/status',
          cookies: student,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/api/ai/chatgpt/status',
          cookies: teacher,
        })
      ).json(),
    ).toMatchObject({
      available: true,
      authenticated: true,
      planType: 'plus',
      defaultModel: 'gpt-5.5',
      models: [{ model: 'gpt-5.5', displayName: 'GPT 5.5' }],
    });
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/ai/chatgpt/login',
          cookies: teacher,
        })
      ).json(),
    ).toMatchObject({
      loginId: 'login-1',
      authUrl: 'https://auth.openai.com/authorize?client_id=codex',
    });
    const streamed = await app.inject({
      method: 'POST',
      url: '/api/ai/chatgpt/complete',
      cookies: teacher,
      payload: { prompt: 'Bằng chứng.', model: 'gpt-5.6-sol' },
    });
    expect(streamed.headers['content-type']).toContain('text/event-stream');
    expect(streamed.body).toContain('event: delta');
    expect(streamed.body).toContain('Chỉ dựa ');
    expect(streamed.body).toContain('event: usage');
    expect(streamed.body).toContain('"modelId":"gpt-5.6-sol"');

    await app.inject({ method: 'POST', url: '/api/auth/logout', cookies: teacher });
    expect(logout).toHaveBeenCalledWith('user-teacher-ha');
    await app.close();
  });

  it('delivers a ChatGPT delta before completion and aborts on disconnect', async () => {
    const disconnected = vi.fn();
    let release: (() => void) | undefined;
    const manager: CodexManagerPort = {
      isEnabled: () => true,
      status: async () => ({
        account: { type: 'chatgpt', planType: 'plus' },
        requiresOpenaiAuth: true,
      }),
      models: async () => [
        {
          id: 'gpt-5.5',
          model: 'gpt-5.5',
          displayName: 'GPT 5.5',
          description: '',
          isDefault: true,
        },
      ],
      startLogin: async () => ({ loginId: 'login-1', authUrl: 'https://auth.openai.com/' }),
      complete: (_accountId, _prompt, onDelta, signal) =>
        new Promise((resolve, reject) => {
          onDelta?.('delta-trước-khi-xong');
          release = () => resolve({ content: 'delta-trước-khi-xong', modelId: 'gpt-5.5' });
          signal?.addEventListener(
            'abort',
            () => {
              disconnected();
              reject(signal.reason);
            },
            { once: true },
          );
        }),
      logout: async () => undefined,
      disposeAll: vi.fn(),
    };
    const app = await makeApp({ codexManager: manager });
    const teacher = await loginCookie(app, TEACHER_EMAIL);
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('Missing test listener address');

    const response = await fetch(`http://127.0.0.1:${address.port}/api/ai/chatgpt/complete`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `nekopath_sid=${teacher.nekopath_sid}`,
      },
      body: JSON.stringify({ prompt: 'Bằng chứng.' }),
    });
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let received = '';
    while (!received.includes('delta-trước-khi-xong')) {
      const chunk = await reader.read();
      if (chunk.done) break;
      received += decoder.decode(chunk.value, { stream: true });
    }

    expect(received).toContain('event: delta');
    expect(release).toBeTypeOf('function');
    await reader.cancel();
    await vi.waitFor(() => expect(disconnected).toHaveBeenCalledTimes(1));
    await app.close();
  });

  it('relays native ChatGPT tool calls to the authenticated browser and resumes the turn', async () => {
    const manager: CodexManagerPort = {
      isEnabled: () => true,
      status: async () => ({
        account: { type: 'chatgpt', planType: 'plus' },
        requiresOpenaiAuth: true,
      }),
      models: async () => [
        {
          id: 'gpt-5.6-sol',
          model: 'gpt-5.6-sol',
          displayName: 'GPT-5.6-Sol',
          description: '',
          isDefault: true,
        },
      ],
      startLogin: async () => ({ loginId: 'login-1', authUrl: 'https://auth.openai.com/' }),
      complete: async (_accountId, _prompt, onDelta, _signal, model, tools, executeTool) => {
        expect(tools).toEqual([
          {
            name: 'de_xuat_bai_tap',
            description: 'Đề xuất bài tập.',
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
          },
        ]);
        const result = await executeTool!({
          id: 'call-1',
          name: 'de_xuat_bai_tap',
          args: {},
        });
        onDelta?.('Đã dùng dữ liệu thật.');
        return { content: String((result.data as { tenBai: string }).tenBai), modelId: model! };
      },
      logout: async () => undefined,
      disposeAll: vi.fn(),
    };
    const app = await makeApp({ codexManager: manager });
    const teacher = await loginCookie(app, TEACHER_EMAIL);
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('Missing test listener address');
    const origin = `http://127.0.0.1:${address.port}`;
    const cookie = `nekopath_sid=${teacher.nekopath_sid}`;

    const response = await fetch(`${origin}/api/ai/chatgpt/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        prompt: 'Giao bài cho lớp.',
        model: 'gpt-5.6-sol',
        tools: [
          {
            name: 'de_xuat_bai_tap',
            description: 'Đề xuất bài tập.',
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
          },
        ],
      }),
    });
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let streamed = '';
    while (!streamed.includes('event: tool_call')) {
      const chunk = await reader.read();
      if (chunk.done) break;
      streamed += decoder.decode(chunk.value, { stream: true });
    }
    const toolEvent = streamed.match(/event: tool_call\ndata: ([^\n]+)/)?.[1];
    expect(toolEvent).toBeTruthy();
    const requestId = (JSON.parse(toolEvent!) as { requestId: string }).requestId;

    const resultResponse = await fetch(`${origin}/api/ai/chatgpt/tool-result`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        requestId,
        result: {
          ok: true,
          data: { tenBai: 'Luyện tập Phân số bằng nhau' },
        },
      }),
    });
    expect(resultResponse.status).toBe(200);
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      streamed += decoder.decode(chunk.value, { stream: true });
    }
    expect(streamed).toContain('event: delta');
    expect(streamed).toContain('Đã dùng dữ liệu thật.');
    expect(streamed).toContain('event: done');
    expect(streamed).toContain('Luyện tập Phân số bằng nhau');
    expect(response.headers.get('origin-agent-cluster')).toBe('?1');
    expect(response.headers.get('permissions-policy')).toBe('tools=(self)');
    await app.close();
  });

  it('rejects wrong credentials and unauthenticated access', async () => {
    const app = await makeApp();
    const bad = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: TEACHER_EMAIL, password: 'wrong' },
    });
    expect(bad.statusCode).toBe(401);
    const me = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(me.statusCode).toBe(401);
    await app.close();
  });

  it('logs in, seeds 41 class members and 12 bank questions', async () => {
    const app = await makeApp();
    const cookies = await loginCookie(app, TEACHER_EMAIL);
    const roster = await app.inject({ method: 'GET', url: '/api/class/roster', cookies });
    expect(roster.statusCode).toBe(200);
    expect((roster.json() as { students: unknown[] }).students).toHaveLength(40);
    const questions = await app.inject({ method: 'GET', url: '/api/questions', cookies });
    expect((questions.json() as { questions: unknown[] }).questions).toHaveLength(12);
    await app.close();
  });

  it('returns a truthful empty teacher dashboard before students answer', async () => {
    const app = await makeApp();
    const teacher = await loginCookie(app, TEACHER_EMAIL);

    const response = await app.inject({
      method: 'GET',
      url: '/api/teacher/dashboard',
      cookies: teacher,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      dataSource: 'SERVER',
      classId: 'class-7a',
      rosterCount: 40,
      evaluatedLearnerCount: 0,
      answerEventCount: 0,
      groups: [],
    });
    await app.close();
  });

  it('builds teacher evidence only from answers stored by the backend', async () => {
    const app = await makeApp();
    const teacher = await loginCookie(app, TEACHER_EMAIL);
    const assigned = await app.inject({
      method: 'POST',
      url: '/api/assignments',
      cookies: teacher,
      payload: {
        title: 'Kiểm tra căn bản về phân số',
        questionIds: [
          'bank-K01-CHECK-1',
          'bank-K01-CHECK-2',
          'bank-K02-CHECK-1',
          'bank-K02-CHECK-2',
        ],
        dueAt: null,
        allowRetake: false,
        shuffleAnswers: false,
      },
    });
    expect(assigned.statusCode).toBe(201);
    const assignmentId = (assigned.json() as { id: string }).id;
    const student = await loginCookie(app, STUDENT_EMAIL);

    for (const [questionId, choiceId] of [
      ['bank-K01-CHECK-1', 'a'],
      ['bank-K01-CHECK-2', 'a'],
      ['bank-K02-CHECK-1', 'b'],
      ['bank-K02-CHECK-2', 'b'],
    ] as const) {
      const answer = await app.inject({
        method: 'POST',
        url: `/api/assignments/${assignmentId}/answers`,
        cookies: student,
        payload: { questionId, choiceId },
      });
      expect(answer.statusCode).toBe(200);
    }

    const response = await app.inject({
      method: 'GET',
      url: '/api/teacher/dashboard',
      cookies: teacher,
    });
    expect(response.statusCode).toBe(200);
    const dashboard = response.json() as {
      evaluatedLearnerCount: number;
      answerEventCount: number;
      groups: {
        rootKcId?: string;
        reviewLearnerRate: number;
        wrongAnswerRate: number;
        recommendedKcIds: string[];
        recommendedQuestionIds: string[];
        learners: { id: string; displayLabel: string }[];
        wrongQuestions: {
          prompt: string;
          answers: {
            learnerName: string;
            selectedChoiceLabel: string;
            correctChoiceLabel: string;
          }[];
        }[];
      }[];
    };
    expect(dashboard.evaluatedLearnerCount).toBe(1);
    expect(dashboard.answerEventCount).toBe(4);
    const group = dashboard.groups.find((candidate) => candidate.rootKcId === 'K02');
    expect(group?.learners).toContainEqual(
      expect.objectContaining({
        id: 'user-student-an',
        displayLabel: 'Trần Ngọc An',
      }),
    );
    expect(group?.wrongQuestions).toHaveLength(2);
    expect(group).toMatchObject({
      reviewLearnerRate: 1,
      wrongAnswerRate: 0.5,
      recommendedKcIds: ['K02'],
      recommendedQuestionIds: ['bank-K02-CHECK-1', 'bank-K02-CHECK-2'],
    });
    expect(group?.wrongQuestions[0]?.answers[0]).toMatchObject({
      learnerName: 'Trần Ngọc An',
      selectedChoiceLabel: expect.any(String),
      correctChoiceLabel: expect.any(String),
    });
    await app.close();
  });

  it('persists teacher adjustments on the server with an audit reason', async () => {
    const app = await makeApp();
    const teacher = await loginCookie(app, TEACHER_EMAIL);

    const saved = await app.inject({
      method: 'POST',
      url: '/api/teacher/overrides',
      cookies: teacher,
      payload: {
        learnerId: 'user-student-an',
        targetKcId: 'K10',
        decision: 'SET_ROOT',
        rootKcId: 'K07',
        reason: 'Đã xem bài làm và trao đổi trực tiếp với học sinh.',
      },
    });
    expect(saved.statusCode).toBe(201);

    const response = await app.inject({
      method: 'GET',
      url: '/api/teacher/dashboard',
      cookies: teacher,
    });
    expect(response.statusCode).toBe(200);
    expect((response.json() as { overrides: unknown[] }).overrides).toContainEqual(
      expect.objectContaining({
        learnerId: 'user-student-an',
        rootKcId: 'K07',
        reason: 'Đã xem bài làm và trao đổi trực tiếp với học sinh.',
      }),
    );
    await app.close();
  });

  it('lets a teacher author a question and assign it; student sees and answers it', async () => {
    const app = await makeApp();
    const teacher = await loginCookie(app, TEACHER_EMAIL);

    const created = await app.inject({
      method: 'POST',
      url: '/api/questions',
      cookies: teacher,
      payload: {
        kcId: 'K08',
        difficulty: 'HARD',
        prompt: 'Hoàn thành tỉ số bằng nhau: 2 : 7 = 6 : ?',
        choices: [
          { id: 'a', label: '21' },
          { id: 'b', label: '11', noteVi: 'Cộng 4 là so sánh cộng, không phải nhân.' },
        ],
        correctChoiceId: 'a',
        hints: ['2 nhân mấy được 6?'],
        explanation: '2→6 là nhân 3 nên 7×3 = 21.',
      },
    });
    expect(created.statusCode).toBe(201);
    const questionId = (created.json() as { id: string }).id;

    const edited = await app.inject({
      method: 'PATCH',
      url: `/api/questions/${questionId}`,
      cookies: teacher,
      payload: {
        kcId: 'K08',
        difficulty: 'MEDIUM',
        prompt: 'Hoàn thành tỉ số bằng nhau: 2 : 7 = 8 : ?',
        choices: [
          { id: 'a', label: '28' },
          { id: 'b', label: '13', noteVi: 'Cộng 5 là so sánh cộng, không phải nhân.' },
        ],
        correctChoiceId: 'a',
        hints: ['2 nhân mấy được 8?'],
        explanation: '2→8 là nhân 4 nên 7×4 = 28.',
      },
    });
    expect(edited.statusCode).toBe(200);

    const assigned = await app.inject({
      method: 'POST',
      url: '/api/assignments',
      cookies: teacher,
      payload: {
        title: 'Bài kiểm tra tỉ số',
        questionIds: [questionId],
        dueAt: '2099-07-20T10:00:00.000Z',
        allowRetake: true,
        shuffleAnswers: true,
      },
    });
    expect(assigned.statusCode).toBe(201);
    const assignmentId = (assigned.json() as { id: string }).id;

    const student = await loginCookie(app, STUDENT_EMAIL);
    const opened = await app.inject({
      method: 'POST',
      url: `/api/assignments/${assignmentId}/open`,
      cookies: student,
    });
    expect(opened.statusCode).toBe(200);
    const list = await app.inject({ method: 'GET', url: '/api/assignments', cookies: student });
    const titles = (list.json() as { assignments: { title: string }[] }).assignments.map(
      (a) => a.title,
    );
    expect(titles).toContain('Bài kiểm tra tỉ số');

    // Students must not receive the answer key with the assignment payload.
    const detail = await app.inject({
      method: 'GET',
      url: `/api/assignments/${assignmentId}`,
      cookies: student,
    });
    const firstQuestion = (detail.json() as { questions: Record<string, unknown>[] }).questions[0];
    expect(firstQuestion.correctChoiceId).toBeUndefined();

    const graded = await app.inject({
      method: 'POST',
      url: `/api/assignments/${assignmentId}/answers`,
      cookies: student,
      payload: { questionId, choiceId: 'b' },
    });
    expect(graded.statusCode).toBe(200);
    const verdict = graded.json() as GradeShape;
    expect(verdict.correct).toBe(false);
    expect(verdict.note).toContain('so sánh cộng');
    expect(verdict.hints[0]).toContain('nhân mấy');
    expect(verdict.event).toMatchObject({
      learnerId: 'user-student-an',
      itemId: questionId,
      kind: 'ASSIGNMENT_ANSWER',
    });
    expect(JSON.parse(verdict.event.payload)).toMatchObject({
      choiceId: 'b',
      correct: false,
      methodValidity: 'UNKNOWN',
    });
    expect(verdict.reviewEvent).toMatchObject({
      id: `review-${verdict.event.id}`,
      learnerId: 'user-student-an',
      itemId: questionId,
      sequence: verdict.event.sequence + 1,
      kind: 'REVIEW_SCHEDULED',
    });
    expect(JSON.parse(verdict.reviewEvent.payload)).toMatchObject({
      version: 'review-schedule-v1',
      kcId: 'K08',
      sourceEventId: verdict.event.id,
      intervalDays: 1,
      reason: 'REMEDIATE_SOON',
    });
    const history = await app.inject({ method: 'GET', url: '/api/events', cookies: student });
    expect((history.json() as { events: { id: string }[] }).events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: verdict.event.id }),
        expect.objectContaining({ id: verdict.reviewEvent.id }),
      ]),
    );

    // The teacher's assignment list now shows one submitted learner.
    const progress = await app.inject({ method: 'GET', url: '/api/assignments', cookies: teacher });
    const row = (
      progress.json() as {
        assignments: {
          id: string;
          submittedLearnerCount: number;
          openedLearnerCount: number;
          completedLearnerCount: number;
          inProgressLearnerCount: number;
          allowRetake: boolean;
          shuffleAnswers: boolean;
        }[];
      }
    ).assignments.find((a) => a.id === assignmentId);
    expect(row).toMatchObject({
      submittedLearnerCount: 1,
      openedLearnerCount: 1,
      completedLearnerCount: 1,
      inProgressLearnerCount: 0,
      allowRetake: true,
      shuffleAnswers: true,
    });
    await app.close();
  });

  it('imports only reviewed questions into the selected lesson package', async () => {
    const app = await makeApp();
    const teacher = await loginCookie(app, TEACHER_EMAIL);
    const payload = {
      kcId: 'K02',
      questions: [
        {
          kcId: 'K02',
          difficulty: 'EASY',
          prompt: 'Phân số nào dưới đây bằng với phân số 3/4?',
          choices: [
            { id: 'a', label: '6/8' },
            { id: 'b', label: '6/7' },
          ],
          correctChoiceId: 'a',
          hints: [],
          explanation: 'Nhân cả tử và mẫu với 2.',
        },
      ],
    };

    const imported = await app.inject({
      method: 'POST',
      url: '/api/questions/import',
      cookies: teacher,
      payload,
    });
    expect(imported.statusCode).toBe(201);
    expect(imported.json()).toMatchObject({ importedCount: 1 });

    const list = await app.inject({ method: 'GET', url: '/api/questions', cookies: teacher });
    expect(
      (list.json() as { questions: { prompt: string; reviewState: string }[] }).questions,
    ).toContainEqual(
      expect.objectContaining({
        prompt: 'Phân số nào dưới đây bằng với phân số 3/4?',
        reviewState: 'UNREVIEWED',
      }),
    );

    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/questions/import',
      cookies: teacher,
      payload,
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({ error: 'QUESTION_ALREADY_EXISTS' });
    await app.close();
  });

  it('checks the selected package and file type before previewing an import', async () => {
    const app = await makeApp();
    const teacher = await loginCookie(app, TEACHER_EMAIL);
    const boundary = 'nekopath-import-boundary';
    const body = Buffer.from(
      [
        `--${boundary}`,
        'Content-Disposition: form-data; name="kcId"',
        '',
        'K02',
        `--${boundary}`,
        'Content-Disposition: form-data; name="difficulty"',
        '',
        'MEDIUM',
        `--${boundary}`,
        'Content-Disposition: form-data; name="file"; filename="questions.txt"',
        'Content-Type: text/plain',
        '',
        '1. Phân số nào bằng 2/3?',
        `--${boundary}--`,
        '',
      ].join('\r\n'),
    );
    const response = await app.inject({
      method: 'POST',
      url: '/api/questions/import/preview',
      cookies: teacher,
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'UNSUPPORTED_FILE' });
    await app.close();
  });

  it('delivers a targeted review assignment only to its selected learners', async () => {
    const app = await makeApp();
    const teacher = await loginCookie(app, TEACHER_EMAIL);
    const assigned = await app.inject({
      method: 'POST',
      url: '/api/assignments',
      cookies: teacher,
      payload: {
        title: 'Ôn tập phân số bằng nhau',
        teacherMessage: 'Cô gửi em bài ôn này. Em xem kỹ từng câu nhé.',
        questionIds: ['bank-K02-CHECK-1'],
        learnerIds: ['user-student-an'],
        dueAt: null,
        allowRetake: false,
        shuffleAnswers: false,
      },
    });
    expect(assigned.statusCode).toBe(201);
    const assignmentId = (assigned.json() as { id: string }).id;

    const recipient = await loginCookie(app, STUDENT_EMAIL);
    const recipientList = await app.inject({
      method: 'GET',
      url: '/api/assignments',
      cookies: recipient,
    });
    expect(
      (
        recipientList.json() as {
          assignments: { id: string; teacherMessage: string }[];
        }
      ).assignments.map((assignment) => assignment.id),
    ).toContain(assignmentId);
    expect(
      (
        recipientList.json() as {
          assignments: { id: string; teacherMessage: string }[];
        }
      ).assignments.find((assignment) => assignment.id === assignmentId)?.teacherMessage,
    ).toBe('Cô gửi em bài ôn này. Em xem kỹ từng câu nhé.');

    const recipientDetail = await app.inject({
      method: 'GET',
      url: `/api/assignments/${assignmentId}`,
      cookies: recipient,
    });
    expect(recipientDetail.json()).toMatchObject({
      teacherMessage: 'Cô gửi em bài ôn này. Em xem kỹ từng câu nhé.',
    });

    const nonRecipient = await loginCookie(app, OTHER_STUDENT_EMAIL);
    const nonRecipientList = await app.inject({
      method: 'GET',
      url: '/api/assignments',
      cookies: nonRecipient,
    });
    expect(
      (nonRecipientList.json() as { assignments: { id: string }[] }).assignments.map(
        (assignment) => assignment.id,
      ),
    ).not.toContain(assignmentId);

    for (const request of [
      { method: 'GET' as const, url: `/api/assignments/${assignmentId}` },
      { method: 'POST' as const, url: `/api/assignments/${assignmentId}/open` },
      {
        method: 'POST' as const,
        url: `/api/assignments/${assignmentId}/answers`,
        payload: { questionId: 'bank-K02-CHECK-1', choiceId: 'a' },
      },
    ]) {
      const response = await app.inject({ ...request, cookies: nonRecipient });
      expect(response.statusCode).toBe(403);
    }

    const teacherList = await app.inject({
      method: 'GET',
      url: '/api/assignments',
      cookies: teacher,
    });
    const row = (
      teacherList.json() as {
        assignments: { id: string; recipientCount: number; recipientNames: string[] }[];
      }
    ).assignments.find((assignment) => assignment.id === assignmentId);
    expect(row).toMatchObject({
      recipientCount: 1,
      recipientNames: ['Trần Ngọc An'],
    });
    await app.close();
  });

  it('blocks students from teacher endpoints and syncs events idempotently', async () => {
    const app = await makeApp();
    const student = await loginCookie(app, STUDENT_EMAIL);
    const forbidden = await app.inject({ method: 'GET', url: '/api/questions', cookies: student });
    expect(forbidden.statusCode).toBe(403);

    const event = {
      id: 'evt-local-1',
      learnerId: 'user-student-an',
      itemId: 'K02-CHECK-1',
      sequence: 1,
      occurredAt: new Date().toISOString(),
      kind: 'ANSWER',
      payload: '{"choiceId":"a","correct":true}',
    };
    const first = await app.inject({
      method: 'POST',
      url: '/api/events',
      cookies: student,
      payload: { events: [event] },
    });
    expect((first.json() as { accepted: number }).accepted).toBe(1);
    const second = await app.inject({
      method: 'POST',
      url: '/api/events',
      cookies: student,
      payload: { events: [event] },
    });
    const secondBody = second.json() as { accepted: number; conflictIds: string[] };
    expect(secondBody.accepted).toBe(0);
    expect(secondBody.conflictIds).toEqual([]);
    const teacherDashboardForbidden = await app.inject({
      method: 'GET',
      url: '/api/teacher/dashboard',
      cookies: student,
    });
    expect(teacherDashboardForbidden.statusCode).toBe(403);
    const teacher = await loginCookie(app, TEACHER_EMAIL);
    const dashboard = await app.inject({
      method: 'GET',
      url: '/api/teacher/dashboard',
      cookies: teacher,
    });
    expect(dashboard.json()).toMatchObject({
      evaluatedLearnerCount: 1,
      answerEventCount: 1,
    });
    await app.close();
  });

  it('paginates only the authenticated student event history', async () => {
    const app = await makeApp();
    const an = await loginCookie(app, STUDENT_EMAIL);
    const chi = await loginCookie(app, 'chi@nekopath.edu.vn');
    const teacher = await loginCookie(app, TEACHER_EMAIL);
    const eventFor = (id: string, learnerId: string) => ({
      id,
      learnerId,
      itemId: 'K02-DIAGNOSTIC',
      sequence: 1,
      occurredAt: '2026-07-18T08:00:00.000Z',
      kind: 'ANSWER',
      payload: '{"choiceId":"a","correct":true}',
    });
    await app.inject({
      method: 'POST',
      url: '/api/events',
      cookies: an,
      payload: { events: [eventFor('evt-an-history', 'user-student-an')] },
    });
    await app.inject({
      method: 'POST',
      url: '/api/events',
      cookies: chi,
      payload: { events: [eventFor('evt-chi-history', 'user-student-chi')] },
    });

    const response = await app.inject({ method: 'GET', url: '/api/events?offset=0', cookies: an });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      events: [expect.objectContaining({ id: 'evt-an-history', learnerId: 'user-student-an' })],
      nextOffset: null,
    });
    expect(
      (response.json() as { events: { id: string }[] }).events.some(
        (event) => event.id === 'evt-chi-history',
      ),
    ).toBe(false);

    const forbidden = await app.inject({ method: 'GET', url: '/api/events', cookies: teacher });
    expect(forbidden.statusCode).toBe(403);
    const invalid = await app.inject({ method: 'GET', url: '/api/events?offset=-1', cookies: an });
    expect(invalid.statusCode).toBe(400);
    await app.close();
  });

  it('returns structured misconception evidence for an assigned authored bank item', async () => {
    const app = await makeApp();
    const student = await loginCookie(app, STUDENT_EMAIL);
    await app.inject({
      method: 'POST',
      url: '/api/events',
      cookies: student,
      payload: {
        events: [
          {
            id: 'evt-offline-before-assignment',
            learnerId: 'user-student-an',
            itemId: 'K02-DIAGNOSTIC',
            sequence: 12,
            occurredAt: '2026-07-18T08:00:00.000Z',
            kind: 'ANSWER',
            payload: '{"choiceId":"a","correct":true}',
          },
        ],
      },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/assignments/assignment-seed-k02/answers',
      cookies: student,
      payload: { questionId: 'bank-K02-CHECK-1', choiceId: 'b' },
    });

    expect(response.statusCode).toBe(200);
    const result = response.json() as GradeShape;
    expect(result.event).toMatchObject({
      learnerId: 'user-student-an',
      itemId: 'bank-K02-CHECK-1',
      kind: 'ASSIGNMENT_ANSWER',
      sequence: 13,
    });
    expect(result.reviewEvent).toMatchObject({
      id: `review-${result.event.id}`,
      learnerId: 'user-student-an',
      itemId: 'bank-K02-CHECK-1',
      kind: 'REVIEW_SCHEDULED',
      sequence: 14,
    });
    expect(JSON.parse(result.event.payload)).toMatchObject({
      choiceId: 'b',
      correct: false,
      methodValidity: 'INVALID',
      misconceptionId: 'ADDITIVE_EQUIVALENCE',
    });
    await app.close();
  });

  it('does not let a teacher submit a student assignment answer', async () => {
    const app = await makeApp();
    const teacher = await loginCookie(app, TEACHER_EMAIL);
    const response = await app.inject({
      method: 'POST',
      url: '/api/assignments/assignment-seed-k02/answers',
      cookies: teacher,
      payload: { questionId: 'bank-K02-CHECK-1', choiceId: 'a' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'FORBIDDEN' });
    await app.close();
  });

  it('serves seeded lessons to students and lets only teachers publish edits', async () => {
    const app = await makeApp();
    const student = await loginCookie(app, STUDENT_EMAIL);

    const listed = await app.inject({ method: 'GET', url: '/api/lessons', cookies: student });
    const body = listed.json() as { lessons: { kcId: string; status: string }[] };
    expect(body.lessons).toHaveLength(12);
    expect(body.lessons.every((lesson) => lesson.status === 'DRAFT')).toBe(true);

    const edit = {
      title: 'Phân số bằng nhau (bản của cô)',
      keyPoints: ['Nhân cả tử và mẫu với cùng một số khác 0.'],
      exampleProblem: 'Tìm số thích hợp: 3/5 = ?/20.',
      exampleSteps: ['Mẫu nhân 4 nên tử cũng nhân 4: 3 × 4 = 12.'],
      commonMistake: 'Cộng thêm cùng một số vào tử và mẫu.',
    };
    const forbidden = await app.inject({
      method: 'PUT',
      url: '/api/lessons/K02',
      cookies: student,
      payload: edit,
    });
    expect(forbidden.statusCode).toBe(403);

    const teacher = await loginCookie(app, TEACHER_EMAIL);
    const unknown = await app.inject({
      method: 'PUT',
      url: '/api/lessons/K99',
      cookies: teacher,
      payload: edit,
    });
    expect(unknown.statusCode).toBe(404);

    const saved = await app.inject({
      method: 'PUT',
      url: '/api/lessons/K02',
      cookies: teacher,
      payload: edit,
    });
    expect(saved.statusCode).toBe(200);

    const after = await app.inject({ method: 'GET', url: '/api/lessons', cookies: student });
    const updated = (
      after.json() as {
        lessons: { kcId: string; title: string; status: string; updatedByName: string | null }[];
      }
    ).lessons.find((lesson) => lesson.kcId === 'K02');
    expect(updated).toMatchObject({
      title: 'Phân số bằng nhau (bản của cô)',
      status: 'PUBLISHED',
      updatedByName: 'Nguyễn Thu Hà',
    });
    await app.close();
  });

  it('quarantines a resent event ID whose content differs instead of overwriting', async () => {
    const app = await makeApp();
    const student = await loginCookie(app, STUDENT_EMAIL);
    const original = {
      id: 'evt-clash-1',
      learnerId: 'user-student-an',
      itemId: 'K02-CHECK-1',
      sequence: 1,
      occurredAt: '2026-07-18T03:00:00.000Z',
      kind: 'ANSWER',
      payload: '{"choiceId":"a","correct":true}',
    };
    await app.inject({
      method: 'POST',
      url: '/api/events',
      cookies: student,
      payload: { events: [original] },
    });

    const tampered = { ...original, payload: '{"choiceId":"b","correct":false}' };
    const response = await app.inject({
      method: 'POST',
      url: '/api/events',
      cookies: student,
      payload: { events: [tampered] },
    });
    const body = response.json() as { accepted: number; conflictIds: string[] };
    expect(body.accepted).toBe(0);
    expect(body.conflictIds).toEqual(['evt-clash-1']);

    // The stored event keeps its original content; both fingerprints are on file.
    const summary = await app.inject({
      method: 'POST',
      url: '/api/events',
      cookies: student,
      payload: { events: [original] },
    });
    expect((summary.json() as { conflictIds: string[] }).conflictIds).toEqual([]);
    await app.close();
  });

  it('quarantines an event ID collision across learner accounts', async () => {
    const app = await makeApp();
    const an = await loginCookie(app, STUDENT_EMAIL);
    const han = await loginCookie(app, 'hs01@nekopath.edu.vn');
    const occurredAt = '2026-07-18T03:00:00.000Z';
    const shared = {
      id: 'evt-cross-account-clash',
      itemId: 'K02-CHECK-1',
      sequence: 1,
      occurredAt,
      kind: 'ANSWER',
      payload: '{"choiceId":"a","correct":true}',
    };

    const first = await app.inject({
      method: 'POST',
      url: '/api/events',
      cookies: an,
      payload: { events: [{ ...shared, learnerId: 'user-student-an' }] },
    });
    expect((first.json() as { accepted: number }).accepted).toBe(1);

    const collision = await app.inject({
      method: 'POST',
      url: '/api/events',
      cookies: han,
      payload: { events: [{ ...shared, learnerId: 'user-student-7a-01' }] },
    });
    expect(collision.json()).toMatchObject({
      accepted: 0,
      conflictIds: ['evt-cross-account-clash'],
    });
    await app.close();
  });

  it('rejects stale browser bindings and cross-account event batches', async () => {
    const app = await makeApp();
    const student = await loginCookie(app, STUDENT_EMAIL);
    const staleBinding = { ...student, nekopath_profile: 'user-student-chi' };

    const staleRead = await app.inject({
      method: 'GET',
      url: '/api/assignments',
      cookies: staleBinding,
    });
    expect(staleRead.statusCode).toBe(409);
    expect(staleRead.json()).toMatchObject({ error: 'SESSION_PROFILE_MISMATCH' });

    const crossProfileEvent = {
      id: 'evt-cross-profile',
      learnerId: 'user-student-chi',
      itemId: 'K02-CHECK-1',
      sequence: 1,
      occurredAt: new Date().toISOString(),
      kind: 'ANSWER',
      payload: '{"choiceId":"a","correct":true}',
    };
    const rejected = await app.inject({
      method: 'POST',
      url: '/api/events',
      cookies: student,
      payload: { events: [crossProfileEvent] },
    });
    expect(rejected.statusCode).toBe(403);
    expect(rejected.json()).toMatchObject({ error: 'EVENT_ACCOUNT_MISMATCH' });
    await app.close();
  });

  it('stores a valid offline answer and review together and rejects a fabricated schedule', async () => {
    const app = await makeApp();
    const student = await loginCookie(app, STUDENT_EMAIL);
    const occurredAt = '2026-07-18T08:00:00.000Z';
    const answer = {
      id: 'evt-offline-reviewed',
      learnerId: 'user-student-an',
      itemId: 'K02-CHECK-1',
      sequence: 20,
      occurredAt,
      kind: 'ANSWER',
      payload: '{"choiceId":"a","correct":true}',
    };
    const review = {
      id: 'review-evt-offline-reviewed',
      learnerId: 'user-student-an',
      itemId: 'K02-CHECK-1',
      sequence: 21,
      occurredAt,
      kind: 'REVIEW_SCHEDULED',
      payload:
        '{"version":"review-schedule-v1","kcId":"K02","sourceEventId":"evt-offline-reviewed","dueAt":"2026-07-21T08:00:00.000Z","intervalDays":3,"reason":"RECOVERY_CHECK"}',
    };

    const accepted = await app.inject({
      method: 'POST',
      url: '/api/events',
      cookies: student,
      payload: { events: [review, answer] },
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toMatchObject({ accepted: 2, received: 2 });

    const rejected = await app.inject({
      method: 'POST',
      url: '/api/events',
      cookies: student,
      payload: {
        events: [
          { ...answer, id: 'evt-fabricated', sequence: 30 },
          {
            ...review,
            id: 'review-evt-fabricated',
            sequence: 31,
            payload:
              '{"version":"review-schedule-v1","kcId":"K02","sourceEventId":"evt-fabricated","dueAt":"2099-07-21T08:00:00.000Z","intervalDays":3,"reason":"RECOVERY_CHECK"}',
          },
        ],
      },
    });
    expect(rejected.statusCode).toBe(400);
    expect(rejected.json()).toMatchObject({ error: 'INVALID_REVIEW_LINK' });

    const wrongKc = await app.inject({
      method: 'POST',
      url: '/api/events',
      cookies: student,
      payload: {
        events: [
          { ...answer, id: 'evt-wrong-kc', sequence: 40 },
          {
            ...review,
            id: 'review-evt-wrong-kc',
            sequence: 41,
            payload:
              '{"version":"review-schedule-v1","kcId":"K07","sourceEventId":"evt-wrong-kc","dueAt":"2026-07-21T08:00:00.000Z","intervalDays":3,"reason":"RECOVERY_CHECK"}',
          },
        ],
      },
    });
    expect(wrongKc.statusCode).toBe(400);
    expect(wrongKc.json()).toMatchObject({ error: 'INVALID_REVIEW_LINK' });

    const jumpedInterval = await app.inject({
      method: 'POST',
      url: '/api/events',
      cookies: student,
      payload: {
        events: [
          {
            ...answer,
            id: 'evt-jumped-interval',
            itemId: 'K07-CHECK-1',
            sequence: 50,
          },
          {
            ...review,
            id: 'review-evt-jumped-interval',
            itemId: 'K07-CHECK-1',
            sequence: 51,
            payload:
              '{"version":"review-schedule-v1","kcId":"K07","sourceEventId":"evt-jumped-interval","dueAt":"2026-07-25T08:00:00.000Z","intervalDays":7,"reason":"SPACED_REVIEW"}',
          },
        ],
      },
    });
    expect(jumpedInterval.statusCode).toBe(400);
    expect(jumpedInterval.json()).toMatchObject({ error: 'INVALID_REVIEW_LINK' });

    const history = await app.inject({ method: 'GET', url: '/api/events', cookies: student });
    const ids = (history.json() as { events: { id: string }[] }).events.map((event) => event.id);
    expect(ids).toContain(answer.id);
    expect(ids).toContain(review.id);
    expect(ids).not.toContain('evt-fabricated');
    expect(ids).not.toContain('evt-wrong-kc');
    expect(ids).not.toContain('evt-jumped-interval');
    await app.close();
  });
});

interface GradeShape {
  correct: boolean;
  note: string;
  hints: string[];
  event: {
    id: string;
    learnerId: string;
    itemId: string;
    sequence: number;
    occurredAt: string;
    kind: string;
    payload: string;
  };
  reviewEvent: {
    id: string;
    learnerId: string;
    itemId: string;
    sequence: number;
    occurredAt: string;
    kind: string;
    payload: string;
  };
}
