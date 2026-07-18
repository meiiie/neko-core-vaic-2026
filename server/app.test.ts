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

async function loginCookie(app: Awaited<ReturnType<typeof makeApp>>, email: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password: DEMO_PASSWORD },
  });
  expect(response.statusCode).toBe(200);
  const cookie = response.cookies.find((c) => c.name === 'nekopath_sid');
  expect(cookie).toBeTruthy();
  return { nekopath_sid: cookie!.value };
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

  it('blocks students from teacher endpoints and syncs events idempotently', async () => {
    const app = await makeApp();
    const student = await loginCookie(app, STUDENT_EMAIL);
    const forbidden = await app.inject({ method: 'GET', url: '/api/questions', cookies: student });
    expect(forbidden.statusCode).toBe(403);

    const event = {
      id: 'evt-local-1',
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
    expect((second.json() as { accepted: number }).accepted).toBe(0);
    await app.close();
  });
});

interface GradeShape {
  correct: boolean;
  note: string;
  hints: string[];
}
