/**
 * 의미 기반 루브릭 채점 — OpenAI Chat Completions (AI 튜터와 동일한 호출 방식)
 * Vite: import.meta.env.VITE_OPENAI_API_KEY
 */

const CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';

function getOpenAIKey() {
  const key = import.meta.env.VITE_OPENAI_API_KEY;
  if (!key || String(key).trim() === '') {
    throw new Error(
      'VITE_OPENAI_API_KEY가 설정되지 않았습니다. 프로젝트 루트 .env에 키를 넣어 주세요.'
    );
  }
  return String(key).trim();
}

/**
 * @param {object} body - OpenAI chat/completions body (model, messages, …)
 * @returns {Promise<Response>}
 */
async function chatCompletionsFetch(body) {
  const apiKey = getOpenAIKey();
  try {
    return await fetch(CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/failed to fetch|load failed|networkerror/i.test(msg)) {
      throw new Error(
        `OpenAI API에 연결할 수 없습니다(네트워크). VPN·방화벽·오프라인 여부를 확인하세요. (${msg})`
      );
    }
    throw new Error(`요청 전송 실패: ${msg}`);
  }
}

/**
 * @param {object} body
 * @returns {Promise<object>} parsed JSON from assistant message
 */
async function chatCompletionsJson(body) {
  const res = await chatCompletionsFetch(body);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API 오류 (${res.status}): ${errText.slice(0, 240)}`);
  }
  const data = await res.json();
  const choice = data?.choices?.[0]?.message?.content;
  if (!choice || typeof choice !== 'string') {
    throw new Error('응답에 메시지 본문이 없습니다.');
  }
  try {
    return JSON.parse(choice.trim());
  } catch {
    throw new Error('모델이 JSON 형식이 아닌 응답을 반환했습니다.');
  }
}

const RUBRIC_GRADING_SYSTEM = `너는 중학교 수학 교사다. 학생의 증명(정당화) 과정을 관리자가 설정한 루브릭(배점 기준)에 따라 공정하게 채점한다.

[핵심 지시]
- 단순히 특정 키워드가 들어갔는지로 판정하지 않는다.
- 학생의 논리 전개(가정·주어진 조건 → 사용한 성질·중간 결론 → 최종 결론)를 **의미적으로** 읽고, 수학적으로 **모순·비약**이 없는지 본 뒤 배점한다.
- 루브릭의 각 항목은 "배점 상한"이 있으며, 그 항목이 얼마나 충족되었는지에 따라 0점부터 상한까지 부여할 수 있다.
- "AI 가이드 · 캔버스/사진 해석" 같은 블록은 학생이 그림·필기로 제시한 내용을 텍스트로 옮긴 것이므로, 그 안의 논리를 학생 풀이의 근거로 사용할 수 있다(단, 읽기 오류로 보이는 부분은 만점 사유로 쓰지 않는다).
- 제출 텍스트에 없는 추측은 하지 않는다.`;

/**
 * @param {object} options
 * @param {string} [options.problemTitle]
 * @param {string} [options.proposition]
 * @param {string} [options.teachingGuide]
 * @param {{ id?: string, logicKeyword?: string, points?: number }[]} options.steps
 * @param {{ label: string, text: string }[]} options.labeledStudentSections
 * @returns {Promise<{
 *   totalScore: number,
 *   maxTotalScore: number,
 *   overallComment: string,
 *   rubricResults: { stepIndex: number, criteria: string, score: number, maxScore: number, feedback: string }[]
 * }>}
 */
export async function fetchSemanticRubricGrading({
  problemTitle = '',
  proposition = '',
  teachingGuide = '',
  steps = [],
  labeledStudentSections = [],
}) {
  const rubricLines = (steps || []).map((s, i) => {
    const max = Math.max(0, Number(s.points) || 0);
    const c = String(s.logicKeyword || '').trim() || '(기준 미입력)';
    return `${i + 1}. (이 항목 배점 상한: ${max}점) ${c}`;
  });

  const studentWork = (labeledStudentSections || [])
    .filter((s) => String(s.text || '').trim())
    .map((s) => `### ${s.label}\n${String(s.text).trim()}`)
    .join('\n\n');

  const userContent = `【문제】
제목: ${problemTitle || '(없음)'}
명제·지문: ${proposition || '(없음)'}

【교사 지도(참고)】
${(teachingGuide || '').trim() || '(없음)'}

【루브릭 — 관리자가 정한 배점 기준(순서대로 1..N)】
${rubricLines.join('\n')}

【학생 풀이(제출된 전체 텍스트·해석)】
${studentWork || '(없음)'}

【응답 형식】
아래 JSON 스키마로만 응답한다. totalScore는 rubricResults의 score 합과 일치시킨다.
- 각 rubricResults 항목의 stepIndex는 1부터 루브릭 항목 개수와 같게 맞춘다.
- score는 해당 항목의 maxScore를 넘지 못한다.
- feedback은 한국어로, 이 항목에 대해 짧고 구체적으로(잘한 점/부족한 점).`;

  const body = {
    model: 'gpt-4o',
    temperature: 0.12,
    max_tokens: 3500,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: RUBRIC_GRADING_SYSTEM },
      {
        role: 'user',
        content: `${userContent}

【JSON 스키마】
{
  "totalScore": 0,
  "maxTotalScore": 0,
  "overallComment": "전체 총평 한두 문장",
  "rubricResults": [
    {
      "stepIndex": 1,
      "criteria": "해당 루브릭 항목을 짧게 요약한 제목",
      "score": 0,
      "maxScore": 0,
      "feedback": "이 항목에 대한 피드백"
    }
  ]
}`,
      },
    ],
  };

  const raw = await chatCompletionsJson(body);
  return normalizeRubricResponse(raw, steps);
}

/**
 * @param {object} raw
 * @param {object[]} steps
 */
function normalizeRubricResponse(raw, steps) {
  const maxTotal = (steps || []).reduce(
    (a, s) => a + Math.max(0, Number(s.points) || 0),
    0
  );

  let rubricResults = Array.isArray(raw?.rubricResults)
    ? raw.rubricResults.map((r, i) => {
        const stepIndex = Number(r.stepIndex) || i + 1;
        const step = steps[stepIndex - 1];
        const cap = Math.max(0, Number(step?.points) || 0);
        let score = Number(r.score);
        if (!Number.isFinite(score)) score = 0;
        score = Math.min(Math.max(0, score), cap);
        return {
          stepIndex,
          criteria: String(r.criteria || step?.logicKeyword || '').trim(),
          score,
          maxScore: cap,
          feedback: String(r.feedback || '').trim(),
        };
      })
    : [];

  const byIdx = new Map(rubricResults.map((r) => [r.stepIndex, r]));
  rubricResults = steps.map((step, i) => {
    const idx = i + 1;
    const safeMax = Math.max(0, Number(step.points) || 0);
    const existing = byIdx.get(idx);
    if (existing) {
      const score = Math.min(
        Math.max(0, Number(existing.score) || 0),
        safeMax
      );
      return {
        stepIndex: idx,
        criteria: String(
          existing.criteria || step.logicKeyword || ''
        ).trim(),
        score,
        maxScore: safeMax,
        feedback: String(existing.feedback || '').trim(),
      };
    }
    return {
      stepIndex: idx,
      criteria: String(step.logicKeyword || '').trim(),
      score: 0,
      maxScore: safeMax,
      feedback: '',
    };
  });

  let totalScore = Number(raw?.totalScore);
  const sumRows = rubricResults.reduce((a, r) => a + r.score, 0);
  if (!Number.isFinite(totalScore) || Math.abs(totalScore - sumRows) > 0.01) {
    totalScore = sumRows;
  }
  totalScore = Math.min(Math.max(0, totalScore), maxTotal);

  const overallComment = String(raw?.overallComment ?? '').trim();

  return {
    totalScore,
    maxTotalScore: maxTotal,
    overallComment,
    rubricResults,
  };
}
