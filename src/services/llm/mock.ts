import type { TutorLlmPort, TutorLlmRequest, TutorLlmResult } from './port';
import { runGuards } from './guards';

/**
 * Deterministic adapter: assembles Vietnamese wording from the supplied facts
 * using fixed templates — no network, no randomness, same input → same output.
 * It exercises the exact same guard pipeline as a real provider, so switching
 * to `fpt`/`local` later changes behaviour only in wording quality, never in
 * safety properties. Used for tests and as the offline default profile.
 */

function templateFor(request: TutorLlmRequest): { text: string; citedIds: string[] } {
  const facts = request.facts;
  switch (request.useCase) {
    case 'EXPLAIN_DIAGNOSIS': {
      const rootKcName = typeof facts.rootKcName === 'string' ? facts.rootKcName : '';
      const status = typeof facts.status === 'string' ? facts.status : '';
      if (status === 'NEEDS_MORE_EVIDENCE') {
        return {
          text: 'Hệ thống chưa đủ bằng chứng để kết luận em đang vướng ở đâu, nên sẽ hỏi thêm một câu phân biệt thay vì đoán. Em cứ làm tiếp — mỗi câu trả lời giúp việc xác định chính xác hơn.',
          citedIds: [],
        };
      }
      return {
        text: `Các câu trả lời gần đây cho thấy em cần củng cố "${rootKcName}" trước. Đây không phải điểm yếu cố định — chỉ là mắt xích cần luyện thêm để các bài phía sau trở nên dễ hơn.`,
        citedIds: [...request.allowedCitationIds],
      };
    }
    case 'REWORD_HINT': {
      const hintText = typeof facts.hintText === 'string' ? facts.hintText : '';
      return { text: hintText, citedIds: [...request.allowedCitationIds] };
    }
    case 'TEACHER_SUMMARY': {
      const groupLabel = typeof facts.groupLabel === 'string' ? facts.groupLabel : '';
      const learnerCount = typeof facts.learnerCount === 'number' ? facts.learnerCount : 0;
      return {
        text: `Nhóm "${groupLabel}" (${learnerCount} học sinh) có đủ bằng chứng để can thiệp trước. Gợi ý: một hoạt động 10 phút cho nhóm nhỏ, sau đó kiểm tra nhanh để xác nhận tiến bộ.`,
        citedIds: [...request.allowedCitationIds],
      };
    }
  }
}

export class MockTutorLlm implements TutorLlmPort {
  async complete(request: TutorLlmRequest): Promise<TutorLlmResult> {
    const started = performance.now();
    const candidate = templateFor(request);
    const verdict = runGuards(candidate, request);
    const latencyMs = Math.round(performance.now() - started);
    if (!verdict.ok) {
      return {
        status: 'FALLBACK',
        text: request.fallbackText,
        citedIds: [],
        meta: { profileId: 'mock', latencyMs, fallbackReason: verdict.reason },
      };
    }
    return {
      status: 'OK',
      text: verdict.reply.text,
      citedIds: verdict.reply.citedIds,
      meta: { profileId: 'mock', latencyMs },
    };
  }
}
