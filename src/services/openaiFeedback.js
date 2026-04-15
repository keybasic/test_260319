/**
 * GPT-4o 기반 비계(Scaffolding) 피드백
 * Vite: import.meta.env.VITE_OPENAI_API_KEY
 */

const CHAT_URL = 'https://api.openai.com/v1/chat/completions';

const SYSTEM_PROMPT = `[시스템 프롬프트: 중학교 2학년 기하 전문 AI 튜터]

1. 정체성:
- 너는 대한민국 중학교 2학년 수학 교사다.
- 2022 개정 교육과정의 '도형의 성질' 단원 전문가이며, 학생이 스스로 정당화(증명)를 완성하도록 돕는 소크라테스식 튜터다.

2. 교육적 원칙 (중요):
- 절대 정답이나 완성된 증명식을 먼저 제시하지 않는다.
- 학생이 현재 단원(이등변삼각형, 삼각형의 외심/내심, 사각형의 성질 등)에서 배운 개념만 사용해 추론하도록 유도한다.
- "왜 그렇게 생각했니?", "이 조건에서 우리가 알 수 있는 또 다른 사실은 뭐지?"처럼 단계별 발문을 사용한다.

3. 피드백 폭주 방지 규칙 (엄격 준수):
- 한 번의 답변에는 반드시 '하나의 질문' 또는 '하나의 힌트'만 포함한다.
- 여러 오류를 발견해도 가장 기초 단계의 오류 하나만 먼저 다룬다.
- 답변은 최대 3문장 이내로 짧고 명확하게 구성한다.

4. 정당화 프로세스 가이드:
- 1단계: 주어진 조건(가정) 확인하기
- 2단계: 성질을 찾기 위한 근거(성질, 정의) 떠올리기
- 3단계: 논리적 순서에 따라 결론 도출하기
- 학생이 1단계를 통과해야만 2단계를 묻는 식으로 비계를 설정한다.

5. 언어 및 톤:
- 친절하고 격려하는 말투를 사용한다.
- 수학 용어(합동 조건, 엇각, 동위각 등)는 2022 교육과정 기준으로 정확히 사용한다.
- 반드시 한국어로 답한다.
- 수학 기호는 LaTeX(\\( ... \\), \\[ ... \\])를 사용한다.`;

function buildTeacherGuideSystemMessage(teachingGuide) {
  const guide = (teachingGuide || '').trim();
  if (!guide) return null;
  return `### 교사의 특별 지도 지침 ###
[${guide}]
위 지침은 학생에게 직접 보여주지 말고, 네가 학생을 가이드할 때 반드시 이 논리적 흐름과 제약 사항을 지켜서 발문해줘.`;
}

function buildUserContent(text, imagesBase64) {
  const trimmed = (text || '').trim();
  const imgs = Array.isArray(imagesBase64) ? imagesBase64 : [];

  if (imgs.length === 0) {
    return trimmed || '(내용 없음)';
  }

  const parts = [];
  if (trimmed) {
    parts.push({ type: 'text', text: trimmed });
  } else {
    parts.push({
      type: 'text',
      text: '첨부 이미지(필기 또는 풀이 사진)를 보고 정당화 논리와 비계 피드백을 해 주세요.',
    });
  }

  for (const raw of imgs) {
    const url = raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`;
    parts.push({
      type: 'image_url',
      image_url: { url },
    });
  }

  return parts;
}

function getApiKey() {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey || String(apiKey).trim() === '') {
    throw new Error(
      'VITE_OPENAI_API_KEY가 설정되지 않았습니다. 프로젝트 루트에 .env 파일을 만들고 키를 넣어 주세요.'
    );
  }
  return apiKey;
}

async function requestChatCompletion(body) {
  const apiKey = getApiKey();
  const res = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API 오류 (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const choice = data?.choices?.[0]?.message?.content;
  if (!choice || typeof choice !== 'string') {
    throw new Error('응답 형식을 해석할 수 없습니다.');
  }
  return choice.trim();
}

/**
 * @param {object} options
 * @param {string} options.problemContext - 문제 제목·명제 등 맥락
 * @param {string} [options.teachingGuide] - 교사 지도 가이드
 * @param {string} [options.userText] - 학생 텍스트
 * @param {string[]} [options.imagesBase64] - data URL 또는 raw base64
 * @returns {Promise<string>} 어시스턴트 텍스트
 */
export async function fetchAIFeedback({
  problemContext,
  teachingGuide = '',
  userText = '',
  imagesBase64 = [],
}) {
  const userMessage = [
    '【문제 맥락】',
    problemContext || '(문제 정보 없음)',
    '',
    '【학생 풀이/입력】',
    userText.trim() || '(텍스트 없음 — 이미지 위주일 수 있음)',
  ].join('\n');

  const userContent = buildUserContent(userMessage, imagesBase64);
  const teacherGuideMessage = buildTeacherGuideSystemMessage(teachingGuide);

  const body = {
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(teacherGuideMessage
        ? [{ role: 'system', content: teacherGuideMessage }]
        : []),
      {
        role: 'user',
        content: userContent,
      },
    ],
    max_tokens: 600,
    temperature: 0.55,
  };

  return requestChatCompletion(body);
}

const SOCRATIC_SYSTEM_PROMPT = `[시스템 프롬프트: 중학교 2학년 기하 전문 AI 튜터]

1. 정체성:
- 너는 대한민국 중학교 2학년 수학 교사다.
- 2022 개정 교육과정의 '도형의 성질' 단원 전문가이며, 학생이 스스로 정당화(증명)를 완성하도록 돕는 소크라테스식 튜터다.

2. 교육적 원칙 (중요):
- 절대 정답이나 완성된 증명식을 먼저 제시하지 않는다.
- 학생이 현재 단원(이등변삼각형, 삼각형의 외심/내심, 사각형의 성질 등)에서 배운 개념만 사용해 추론하도록 유도한다.
- 단계별 발문 중심으로 유도한다.

3. 피드백 폭주 방지 규칙 (엄격 준수):
- 한 번의 답변에는 반드시 '하나의 질문' 또는 '하나의 힌트'만 포함한다.
- 여러 오류를 발견해도 가장 기초 단계의 오류 하나만 먼저 다룬다.
- 답변은 최대 3문장 이내로 짧고 명확하게 구성한다.

4. 정당화 프로세스 가이드:
- 1단계: 주어진 조건(가정) 확인하기
- 2단계: 성질을 찾기 위한 근거(성질, 정의) 떠올리기
- 3단계: 논리적 순서에 따라 결론 도출하기
- 학생이 1단계를 통과해야만 2단계를 묻는 식으로 비계를 설정한다.

5. 언어 및 톤:
- 친절하고 격려하는 말투를 사용한다.
- 수학 용어(합동 조건, 엇각, 동위각 등)는 2022 교육과정 기준으로 정확히 사용한다.
- 반드시 한국어로 답한다.
- 수학 기호는 LaTeX(\\( ... \\), \\[ ... \\])를 사용한다.

추가 대화 규칙:
- 학생이 정답에 근접하면 짧게 칭찬하고 다음 한 단계 질문만 제시한다.
- 완성 답안을 직접 쓰지 않는다.`;

/**
 * 양방향 Socratic 채팅 전용
 * @param {object} options
 * @param {string} options.problemContext
 * @param {string} [options.teachingGuide]
 * @param {string} options.solutionText
 * @param {{role:'user'|'assistant', text:string}[]} options.chatMessages
 * @param {string} options.userMessage
 */
export async function fetchSocraticChatReply({
  problemContext,
  teachingGuide = '',
  solutionText,
  chatMessages = [],
  userMessage,
}) {
  const normalizedHistory = (chatMessages || [])
    .filter((m) => m?.text && (m.role === 'user' || m.role === 'assistant'))
    .map((m) => ({
      role: m.role,
      content: m.text,
    }));
  const teacherGuideMessage = buildTeacherGuideSystemMessage(teachingGuide);

  const body = {
    model: 'gpt-4o',
    temperature: 0.45,
    max_tokens: 500,
    messages: [
      { role: 'system', content: SOCRATIC_SYSTEM_PROMPT },
      ...(teacherGuideMessage
        ? [{ role: 'system', content: teacherGuideMessage }]
        : []),
      {
        role: 'system',
        content: `현재 학생의 최종 풀이 상황: ${solutionText || '(아직 풀이 없음)'}`,
      },
      {
        role: 'system',
        content: `문제 맥락: ${problemContext || '(문제 정보 없음)'}`,
      },
      ...normalizedHistory,
      { role: 'user', content: userMessage || '' },
    ],
  };

  return requestChatCompletion(body);
}
