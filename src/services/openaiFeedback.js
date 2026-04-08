/**
 * GPT-4o 기반 비계(Scaffolding) 피드백
 * Vite: import.meta.env.VITE_OPENAI_API_KEY
 */

const CHAT_URL = 'https://api.openai.com/v1/chat/completions';

const SYSTEM_PROMPT = `당신은 중학교 2학년 "도형의 성질 정당화" 수업을 돕는 AI 튜터입니다.

[역할]
- 학생의 풀이(말하기/필기/사진)를 바탕으로 논리적 비계(Scaffolding)를 제공합니다.
- 정답이나 완성된 증명을 그대로 알려주지 마세요. 짧은 질문·단서·다음 단계 확인으로 스스로 생각하게 하세요.
- 설명과 질문은 반드시 중2 학생 눈높이로, 중1까지의 기하 지식(기본 도형, 각, 삼각형, 평행선의 성질, 합동의 기초) 범위 안에서 제시하세요.
- 낯선 고급 용어(예: 대학 수준 용어)나 과도한 추상화는 피하고, 쉬운 표현으로 한 단계씩 안내하세요.

[오개념 대응]
- 예: "사각형에서 대각선 길이가 항상 같다" 같은 주장이 보이면, 반례(예: 일반 사각형 vs 특수 사각형)를 LaTeX로 간단히 제시하고 왜 성립하지 않는지 질문으로 유도하세요.

[표현]
- 한국어로 답하되, 수학 기호는 LaTeX를 사용하세요. 인라인은 \\( ... \\), 필요 시 블록은 \\[ ... \\] 형식을 쓰세요.
- 1회 응답은 과도하게 길지 않게(대략 120~350자 내외) 유지하세요.`;

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
 * @param {string} [options.userText] - 학생 텍스트
 * @param {string[]} [options.imagesBase64] - data URL 또는 raw base64
 * @returns {Promise<string>} 어시스턴트 텍스트
 */
export async function fetchAIFeedback({
  problemContext,
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

  const body = {
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
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

const SOCRATIC_SYSTEM_PROMPT = `너는 소크라테스식 문답법을 사용하는 중학교 수학 튜터야.
절대 정답을 한 번에 알려주지 마.
학생이 입력한 [최종 풀이 상황]과 [채팅 질문]을 바탕으로, 학생이 다음 단계를 스스로 생각할 수 있도록 오직 한 번에 하나의 질문만 던져.
학생이 채팅으로 정답을 맞히면 칭찬하면서 '이제 그 내용을 왼쪽 풀이 공간에 적어볼까요?'라고 유도해.

추가 규칙:
- 반드시 한국어로 답변한다.
- 난이도는 중2 학생 기준으로 맞추고, 중1까지 학습한 기하 개념 범위에서만 설명/질문한다.
- 쉬운 단어와 짧은 문장을 사용하고, 한 번에 여러 개념을 동시에 요구하지 않는다.
- 수학 기호는 LaTeX(\\( ... \\), \\[ ... \\])로 표현한다.
- 답변 길이는 1~3문장 중심으로 간결하게 유지한다.
- 교사의 설명투보다 학생의 사고를 여는 질문투를 우선한다.`;

/**
 * 양방향 Socratic 채팅 전용
 * @param {object} options
 * @param {string} options.problemContext
 * @param {string} options.solutionText
 * @param {{role:'user'|'assistant', text:string}[]} options.chatMessages
 * @param {string} options.userMessage
 */
export async function fetchSocraticChatReply({
  problemContext,
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

  const body = {
    model: 'gpt-4o',
    temperature: 0.45,
    max_tokens: 500,
    messages: [
      { role: 'system', content: SOCRATIC_SYSTEM_PROMPT },
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
