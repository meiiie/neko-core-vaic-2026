# Neko Teacher AI Harness v2 — Design Specification

Ngày: 2026-07-18

Trạng thái: đã được người phụ trách sản phẩm duyệt; triển khai vertical slice từ 2026-07-18

Phạm vi: Neko trong cổng giáo viên; không thay đổi UX/UI trong đặc tả này

## 1. Kết luận thiết kế

Neko không phải là mô hình người học, bộ chẩn đoán hay nguồn sự thật về lớp. Neko là lớp điều phối và diễn giải nằm phía trên adaptive core deterministic hiện có. Mọi mastery, root gap, đường bù, nhóm, priority, class-wide gap và answer key tiếp tục do domain core tính toán. LLM chỉ được chọn công cụ trong allowlist và diễn giải một `EvidenceBrief` đã được kiểm tra.

Thay đổi đầu tiên phải xây một harness provider-neutral có:

- session thật, follow-up thật và compaction theo token budget;
- tool schema kiểm tra ở runtime và allowlist theo phiên;
- output có cấu trúc, evidence ID và deterministic fallback;
- abort, timeout, retry hữu hạn, circuit breaker và provider disposal;
- ranh giới account/role/class chặt, đặc biệt khi chuyển lớp và logout;
- usage ledger và telemetry không chứa nội dung;
- rule provider hoạt động đầy đủ khi offline hoặc không có model.

Thiết kế này thực hiện phần nền tảng cần thiết để sau đó bổ sung detect–verify–escalate và teacher attention allocator mà không trao quyền quyết định sư phạm cho LLM.

## 2. Nguồn yêu cầu

### 2.1 Tài liệu người dùng cung cấp

- `D:\TaiVe\-Kết-luận-điều-hành.txt`, SHA-256 `D41EA2652A1663738D1A58D6650B9F6774053D09194F5965DAE8D75B7CB60C5D`.
- `D:\TaiVe\Vấn-đề-của-giáo-viên.docx`, SHA-256 `2828BE7763630CF06075B34A88562F118458EC038825687369FDC804A19FB0F9`.

DOCX có 14 paragraph, không có table, comment hoặc tracked change. LibreOffice không có trong runtime nên không thể render DOCX sang PNG; nội dung được kiểm tra trực tiếp từ OOXML, không chỉnh sửa tài liệu nguồn.

### 2.2 Hợp đồng repository

Các ràng buộc có thẩm quyền đã đọc và được giữ nguyên:

- `AGENTS.md`;
- `docs/PROBLEM_ANALYSIS.md`;
- `docs/PRODUCT_CONTRACT.md`;
- `docs/IMPLEMENTATION_MASTER_PLAN.md`;
- `docs/OPERATIONAL_MVP.md`.

### 2.3 Bằng chứng nghiên cứu đã xác minh

- FoundationalASSIST cho thấy frontier LLM chỉ xấp xỉ trivial baseline trong knowledge tracing và dưới random chance ở item discrimination. Vì vậy LLM không sở hữu learner state: <https://arxiv.org/abs/2602.00070>.
- The Correct Answer Trap tách correctness khỏi method validity và đề xuất detect–verify–escalate vì false alarm cao: <https://arxiv.org/abs/2606.23205>.
- Tutor CoPilot và LearnLM–Eedi cung cấp bằng chứng cho human-supervised AI, không phải AI tự trị: <https://arxiv.org/abs/2410.03017>, <https://arxiv.org/abs/2512.23633>.
- Hybrid human–AI tutoring cho thấy hỗ trợ chủ động của con người có lợi hơn cho nhóm cần giúp nhiều hơn: <https://arxiv.org/abs/2605.11155>.
- SHAPE ghi nhận pedagogical jailbreak/answer leakage và dùng explicit gating: <https://arxiv.org/abs/2604.22134>.
- Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 có hiệu lực từ 2026-01-01: <https://vanban.chinhphu.vn/?classid=1&docid=214590&pageid=27160&typegroup=>.
- Thông tư 17/2025/TT-BGDĐT sửa đổi Chương trình GDPT ban hành kèm Thông tư 32/2018: <https://vanban.chinhphu.vn/?classid=1&docid=215347&pageid=27160&typegroupid=6>.

## 3. Bài toán giáo viên được chuyển thành yêu cầu sản phẩm

| Quan sát từ giáo viên | Hệ quả thiết kế |
|---|---|
| Một bài kiểm tra không đủ đánh giá năng lực | Không kết luận từ một turn hay một tool result; trả `NEEDS_MORE_EVIDENCE` khi bằng chứng thưa hoặc mâu thuẫn |
| Nhóm thay đổi theo nội dung | Session mang `classId` và thực thể đang chọn; group facts luôn được truy vấn lại từ core |
| Không gọi học sinh là yếu/khá | Prompt, tool result và output dùng trạng thái hành động trung tính; không tạo trait label |
| Giáo viên chuẩn bị 4–5 câu từ dễ đến khó | Neko đề xuất micro-action ngắn; không sinh playlist dài hoặc kế hoạch cố định |
| Học sinh có thể hỗ trợ nhau nhưng dễ chép bài | Student AI về sau phải có hint ladder/answer-leakage gate; không đưa lời giải hoàn chỉnh trong MVP |
| Giáo viên cần tập trung vào trường hợp cần con người | Neko diễn giải priority deterministic và evidence coverage, không tự xếp hạng bằng LLM |
| Thiết bị dễ làm học sinh mất tập trung | Teacher-facing Neko là lát cắt đầu tiên; không thêm student free-chat |
| AI dễ tạo phụ thuộc | Rule mặc định là hỗ trợ quyết định, gợi ý tối thiểu, không làm thay học sinh |

## 4. Phân rã chương trình

Yêu cầu tổng thể gồm nhiều subsystem độc lập. Mỗi subsystem phải có spec, plan và acceptance riêng:

1. **Teacher AI Harness v2** — đặc tả hiện tại: session, tools, evidence, provider, lifecycle, logout và eval.
2. **Curriculum–misconception content** — graph/version/review/evidence package; human curriculum review là gate.
3. **Detect–verify–escalate kernel** — hypothesis set, diagnostic probe và uncertainty gate; core deterministic.
4. **Teacher attention allocator** — priority theo human advantage/bottleneck/evidence và group intervention; không dùng demographic.
5. **Guarded student tutor** — pedagogical policy, hint ladder, answer-leakage verifier và transfer check.
6. **School-pilot persistence/sync** — chỉ được mở khi có identity, consent, retention và cross-device contract thật.

Thực hiện “toàn bộ” nghĩa là hoàn thành tuần tự sáu subsystem này. Trộn chúng vào một pull request sẽ làm mất khả năng kiểm chứng và vi phạm scope của MVP.

## 5. Các phương án đã cân nhắc

### A. Vá vòng lặp hiện tại

Giữ API `runAgent(question, ...)`, thêm vài guard và tăng số bước.

Ưu điểm: nhanh và diff nhỏ.

Nhược điểm: vẫn không có session thật, không có lifecycle owner, grounding dựa trên regex và không giải quyết logout/provider isolation. Phương án này không đáp ứng yêu cầu đã duyệt.

### B. Harness phân lớp, deterministic-first — chọn

Tách contracts, session controller, tool runtime, evidence renderer và provider adapters. Rule provider là nền; model provider chỉ bổ sung wording. Session/capsule là canonical phía Neko, provider-native compaction là capability tùy chọn.

Ưu điểm: sửa đúng nguyên nhân, provider-neutral, offline, test được, giữ nguyên domain core.

Nhược điểm: nhiều contract hơn phương án A và cần migration có kiểm soát cho `NekoDock`.

### C. Xây adaptive pedagogical platform đầy đủ ngay

Đưa BKT/IRT/CDM, RAG, local SLM, teacher allocator và student tutor vào cùng một đợt.

Ưu điểm: gần tầm nhìn nghiên cứu dài hạn.

Nhược điểm: không thể review graph/content, calibrate learner model hay chứng minh learning gain trong một đợt; tăng rủi ro privacy/offline và làm mờ phần khác biệt hiện có. Phương án này bị loại khỏi implementation đầu tiên.

## 6. Kiến trúc mục tiêu

```text
Teacher NekoDock
  -> AgentSessionController
       -> ContextManager
       -> AgentLoop
            -> ToolRuntime -> deterministic domain/adapters -> EvidenceBrief
            -> RuleProvider (always available)
            -> Optional model provider -> DraftNarrative
            -> OutputVerifier -> AgentAnswer
       -> UsageLedger / redacted trace
       -> SessionStore (explicit save/resume only)
```

### 6.1 Boundary

- UI gửi `AgentTurnInput`, nhận trace có cấu trúc và `AgentAnswer`.
- Agent loop không import domain internals; nó chỉ gọi `AgentTool`.
- Tool runtime là nơi duy nhất được execute tool.
- Provider không execute tool, không đọc IndexedDB và không gọi domain core trực tiếp.
- Output verifier không sửa domain fact; khi model sai, nó bỏ narrative và dùng deterministic renderer.
- Session store không phải learner database. Dữ liệu lớp/học sinh luôn đến từ tool theo yêu cầu.

## 7. Contracts

### 7.1 Session scope

```ts
interface AgentSessionScope {
  sessionId: string;
  accountId: string;
  role: 'teacher';
  classId: string | null;
  providerId: string;
  modelId: string | null;
  promptVersion: string;
  toolsetVersion: string;
  generationId: number;
  createdAt: string;
  updatedAt: string;
}
```

`accountId + role + classId` là isolation boundary. Đổi account hoặc class tạo controller/session mới. `generationId` tăng khi cancel, switch hoặc logout; late event có generation cũ bị bỏ.

### 7.2 Tool contract

```ts
interface AgentTool<TInput, TData> {
  name: string;
  description: string;
  inputSchema: ZodType<TInput>;
  readOnly: boolean;
  parallelSafe: boolean;
  timeoutMs: number;
  execute(input: TInput, context: ToolContext): Promise<ToolResult<TData>>;
}

interface ToolResult<TData> {
  ok: boolean;
  evidence: EvidenceRef[];
  data?: TData;
  error?: ToolError;
}
```

Mọi input được parse trước executor. JSON Schema gửi provider phải strict: required đầy đủ, `additionalProperties: false`; trường tùy chọn dùng nullable. Tool ngoài allowlist không bao giờ được lookup qua registry toàn cục. Chỉ batch toàn `readOnly && parallelSafe` mới chạy song song; còn lại giữ thứ tự.

### 7.3 Evidence contract

```ts
interface EvidenceRef {
  evidenceId: string;
  sourceTool: string;
  entityType: 'class' | 'learner' | 'skill' | 'assignment';
  entityId: string;
  asOf: string;
  contentVersion?: string;
}

interface EvidenceBrief {
  intent: string;
  facts: Record<string, string | number | boolean | null>;
  evidence: EvidenceRef[];
  actions: AgentAction[];
  limitations: string[];
}
```

Mỗi số hiển thị phải nằm trong `facts` và có evidence liên quan. Model không được tự thêm fact. Nhiều tool result được merge theo key có namespace; không dùng “tool cuối cùng thắng”.

### 7.4 Answer contract

```ts
type AgentAnswerStatus =
  | 'ANSWERED'
  | 'NEEDS_MORE_EVIDENCE'
  | 'OUT_OF_SCOPE'
  | 'FALLBACK'
  | 'INTERRUPTED'
  | 'ERROR';

interface AgentAnswer {
  status: AgentAnswerStatus;
  summary: string;
  facts: Record<string, string | number | boolean | null>;
  evidence: EvidenceRef[];
  actions: AgentAction[];
  limitations: string[];
  provenance: {
    providerId: string;
    modelId: string | null;
    promptVersion: string;
    usedDeterministicRenderer: boolean;
  };
}
```

UI render facts/evidence/actions từ structured fields. Narrative của model chỉ có thể thay `summary`; verifier loại summary có số/claim không truy về `EvidenceBrief`.

### 7.5 Provider contract

```ts
interface AgentCompletion {
  content: string | null;
  toolCalls: AgentToolCall[];
  finishReason: string;
  usage?: AgentUsage;
  continuation?: ProviderContinuation;
}

interface AgentProvider {
  id: string;
  capabilities: ProviderCapabilities;
  complete(request: AgentRequest, signal: AbortSignal): Promise<AgentCompletion>;
  compact?(request: CompactRequest, signal: AbortSignal): Promise<ProviderContinuation>;
  dispose?(): Promise<void> | void;
}
```

Opaque continuation/compaction chỉ được replay khi `providerId + endpoint + modelId` khớp. Switch provider dựng lại context từ canonical capsule và recent tail.

## 8. Session và memory

### 8.1 Không có hard cutoff theo số lượt

Turn count không phải memory boundary. Context manager dựa trên token estimate/usage và context window của provider:

1. dưới 50%: giữ working context;
2. từ 50%: trim tool result cũ, lớn; giữ evidence refs và recent turns;
3. từ 75%: tạo structured capsule và checkpoint;
4. luôn chừa output reserve; không gửi request đã vượt hard budget;
5. giữ tool-call/tool-result thành cặp và split ở user-turn boundary.

Các ngưỡng là policy khởi điểm để eval, không phải SOTA claim. Usage thực tế quyết định điều chỉnh.

### 8.2 Capsule

Capsule chỉ có:

- goal;
- confirmed constraints/corrections;
- selected entity IDs;
- decisions;
- open questions;
- evidence refs với `asOf`;
- limitations;
- recent intent.

Không chứa raw answer của học sinh, hidden eval label, chain-of-thought, API key, suy luận trait/psychology hoặc diagnosis không có evidence.

### 8.3 Persistence và resume

- Mặc định mở một session mới.
- Session chỉ được lưu khi người dùng chọn lưu; UI về sau cung cấp “Mở lại phiên trước”.
- Resume phải khớp account + role + class.
- Raw transcript không tự động inject toàn bộ; resume dùng capsule + recent tail và refresh evidence stale.
- Demo hiện tại chỉ chứa synthetic data. Dữ liệu lớp thật không được admit trước khi có auth, consent, retention và deletion contract.
- Người dùng có thể xem danh sách, xóa và reset session đã lưu.

Không triển khai vector memory, embedding search, “Dream memory” hoặc durable learner inference trong subsystem này.

## 9. Agent loop

Mỗi turn có ngân sách độc lập:

- wall-clock deadline;
- max model steps;
- max total tool calls;
- max calls mỗi tool;
- max input/output tokens;
- max tool payload bytes.

Luồng:

1. kiểm tra session/generation còn active;
2. canonicalize user input và append turn;
3. context manager dựng request;
4. provider trả text hoặc tool calls;
5. runtime validate tool name + args;
6. execute theo safety/parallel policy;
7. normalize kết quả thành evidence brief;
8. lặp trong budget;
9. verify answer và deterministic render khi cần;
10. persist checkpoint/usage/trace đã redact.

Duplicate exact call dừng ngay. Duplicate semantic call cùng tool/entity trong một turn không chạy lại. Invalid args được trả một schema repair observation đúng một lần; lỗi tiếp theo kết thúc bằng fallback.

## 10. Provider resilience

### 10.1 Error taxonomy

```text
ABORTED
TIMEOUT
OFFLINE
AUTH
RATE_LIMIT
TRANSIENT_SERVER
INVALID_REQUEST
INVALID_SCHEMA
CONTEXT_OVERFLOW
PROVIDER_UNAVAILABLE
```

### 10.2 Retry

- Abort/auth/invalid request/schema/context overflow: không retry.
- 429: tối đa một retry, tôn trọng `Retry-After`, nằm trong turn deadline.
- 5xx/transport transient: tối đa một retry với jittered backoff.
- Idle timeout: fail-soft ngay; không để UI treo.
- Circuit breaker: closed/open/half-open theo provider profile; rule provider không bị circuit-break.

### 10.3 Capability matrix

Mỗi provider khai báo native tools, strict output, streaming, usage, prompt caching, compaction, abort và dispose. Adapter không giả vờ hỗ trợ capability. Nếu model không hỗ trợ native tools, JSON envelope là fallback có schema chặt và chỉ parse toàn bộ JSON object hợp lệ; không dùng greedy regex bắt nội dung tùy ý.

System prompt có prefix tĩnh, ngắn, versioned. Tool menu không được lặp trong prompt khi native tool schema đã được gửi. Dynamic class/session/evidence đứng sau prefix để bảo toàn prompt cache.

## 11. Lifecycle, class switch và logout

Logout là transaction theo thứ tự:

```text
mark closing
-> abort provider, retry sleep và tools
-> generationId++
-> ignore late stream/tool/storage events
-> flush hoặc discard session theo lựa chọn lưu
-> provider.dispose(), WebLLM dispose/reset
-> clear working context và class cache
-> clear demo session account
-> navigate login
```

Đóng dock chỉ abort turn đang chạy; không tự động logout. Chuyển lớp abort turn và tạo scope mới. Kết quả từ scope cũ không thể append vào transcript/UI scope mới.

## 12. Privacy và logging

Default telemetry content-free:

- session/turn ID ngẫu nhiên;
- provider/model category;
- duration/status/error category;
- input/output/cache token counts;
- tool category, success và duration;
- compaction count/tokens before/after.

Không log prompt, raw answer, full tool args/result, name, email, phone, school, API key, chain-of-thought hoặc hidden label. ID học sinh trong demo là pseudonymous; real PII vẫn bị cấm trong MVP.

## 13. Error handling và UX contract

- Offline/provider error: chuyển sang rule provider và gắn `FALLBACK`; không mất facts đã thu thập.
- Tool error: hiển thị limitation cụ thể, không biến lỗi thành empty success.
- Sparse/contradictory evidence: `NEEDS_MORE_EVIDENCE`, không viết chẩn đoán chắc chắn.
- Out-of-graph: `OUT_OF_SCOPE`.
- Abort: `INTERRUPTED`, không append answer muộn.
- Compaction failure: deterministic capsule tối thiểu + recent safe tail.
- Model output invalid: bỏ narrative, giữ deterministic answer.

Neko dùng tên nhóm trung tính và mô tả hành động. Không dùng “học sinh yếu”, “mất gốc” như trait label hoặc xếp hạng cố định.

## 14. Testing và acceptance

### 14.1 Contracts/tools

- Args thiếu, sai enum hoặc có property thừa bị reject trước executor.
- Tool ngoài allowlist không chạy.
- Chỉ read-only + parallel-safe batch chạy song song.
- Invalid args chỉ được self-repair một lần.

### 14.2 Evidence/output

- Mọi số trong output bằng đúng fact từ tool.
- Nhiều tool result được merge đầy đủ.
- Model thêm số/diagnosis không có evidence thì deterministic renderer thay thế.
- Sparse evidence trả đúng abstention.
- Group labels luôn trung tính.

### 14.3 Session/context

- Follow-up “còn Bình?” dùng selected intent/session đúng mà không mất sau sáu lượt.
- Sau 1, 2 và 5 lần compact, goal, correction, selected entity và evidence refs còn đúng.
- Tool call/result không bị orphan sau compact/abort.
- Evidence stale được refresh, không replay số cũ từ capsule.
- Resume sai account/class bị từ chối.

### 14.4 Lifecycle/logout

- Cancel dừng provider, sleep và tool.
- Logout giữa stream/tool/retry không có late UI/transcript write.
- Switch class/account không mang selected learner/evidence sang scope mới.
- Provider/WebLLM dispose đúng một lần.

### 14.5 Provider

- SSE split chunk, event cuối không newline, tool args interleaved và usage event đều parse đúng.
- 429 tôn trọng `Retry-After`; auth/schema không retry; 5xx bounded retry.
- Timeout/circuit-open fail-soft sang rule.
- Opaque continuation không replay qua provider/model khác.
- Rejected WebLLM engine promise được reset để retry sau.

### 14.6 Privacy/observability

- Log snapshot không chứa prompt, answer, student name/PII, secret hoặc tool payload.
- Usage ledger tách last request, turn total, cache read và compaction.
- Cached token được clamp trong input token.

### 14.7 Existing product regression

- An/Bình/Chi/Minh deterministic outcomes không đổi.
- Domain/eval tests vẫn qua.
- Rule provider hoạt động không mạng.
- Student single-answer quiz và teacher flows không bị thay đổi.

## 15. Success check

Subsystem này hoàn thành khi:

1. Neko hỗ trợ follow-up nhiều lượt mà không có hard turn-memory cutoff.
2. Compaction giữ factual parity trên frozen fixtures.
3. Mọi factual output có evidence và model không thể mutate deterministic state.
4. Logout/switch/cancel vượt qua race-condition tests.
5. Provider lỗi vẫn trả deterministic result trong budget.
6. Tool/runtime/output contracts được runtime validation.
7. Không có raw sensitive content trong logs/session capsule.
8. Full repository verification qua trên Node version được project pin; `ref/` không được test runner thu thập.

## 16. Provider slice được duyệt để triển khai

Vertical slice đầu tiên gồm ba đường chạy cùng chung một `AgentSessionController` và cùng tool/evidence contract:

1. **Rule provider** luôn khả dụng và là deterministic fallback.
2. **Gemma 3 1B trong trình duyệt** chạy qua WebLLM Web Worker; tải trước có chủ đích, dùng cache chính thức, abort/unload được và hoạt động ngoại tuyến sau khi tải đủ.
3. **OpenAI Responses API** đi qua Fastify cùng origin; API key chỉ tồn tại ở server, mặc định model `gpt-5.6-sol` nhưng cho phép cấu hình bằng biến môi trường.
4. **ChatGPT managed account** chỉ dành cho local/self-hosted mode, dùng public Codex App Server protocol để Codex quản lý OAuth/refresh token. Không gọi trực tiếp private `chatgpt.com/backend-api/*`, không đưa token ra browser và không bật mặc định trên public deployment.

Memory của cả bốn đường chạy là canonical memory do NekoPath sở hữu. Không có logic “đủ 10 lượt thì xóa”. Compaction được kích hoạt bởi token estimate/usage so với context window và có thể chạy lặp lại vô hạn; mỗi lần phải giữ nguyên system contract, original task, confirmed constraints/corrections, evidence refs và recent complete turns.

## 17. Không nằm trong implementation đầu tiên

- thay đổi thiết kế UX/UI tổng thể hoặc login tài khoản NekoPath;
- real auth/JWT;
- student free-chat;
- automatic answer generation;
- mastery/priority/grouping do LLM;
- RAG/vector database;
- deep knowledge tracing hoặc model training;
- multi-agent runtime;
- real student data;
- cross-device realtime sync;
- claim SOTA hoặc learning gain.

Các phần này chỉ được mở bằng spec và eval riêng. “SOTA” là kết quả benchmark/pilot có baseline, calibration và held-out data, không phải thuộc tính có thể đạt bằng cách thêm nhiều agent hoặc model lớn.
