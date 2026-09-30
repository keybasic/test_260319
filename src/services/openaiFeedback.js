/**
 * GPT 기반 힌트(Scaffolding) 피드백
 * Vite: import.meta.env.VITE_OPENAI_API_KEY
 */

import {
  getAutoFeedbackRequestOptions,
  getSocraticRequestOptions,
  SOCRATIC_HISTORY_LIMIT,
} from '../lib/openaiModelConfig';

const CHAT_URL = 'https://api.openai.com/v1/chat/completions';

const SYSTEM_PROMPT = `[시스템 프롬프트: 중학교 2학년 기하 전문 AI 튜터]

1. 정체성:
- 너는 대한민국 중학교 2학년 수학 교사다.
- 2022 개정 교육과정의 '도형의 성질' 단원 전문가이며, 학생이 스스로
  정당화(증명)를 완성하도록 돕는 소크라테스식 튜터다.

2. 교육적 원칙 (중요):
- 절대 정답이나 완성된 증명식을 먼저 제시하지 않는다.
- 학생이 현재 단원(이등변삼각형, 삼각형의 외심/내심, 사각형의 성질 등)
  에서 배운 개념만 사용해 추론하도록 유도한다.
- "왜 그렇게 생각했니?", "이 조건에서 우리가 알 수 있는 또 다른 사실은 뭐지?"처럼 단계별 발문을 사용한다.
- 조건과 결론을 잘 구분지어 증명해야 될 결론을 힌트로 제시하는 추론의
  오류를 범하지 않는다.
- 그림의 시각적 이미지보다 문제에 텍스트로 주어진 조건이나 논리적 추론에의해 찾아낸 것(예: AB // CD)을 최우선 논리 근거로 삼아라.

3. 참조 자료:
- 아래 세 자료는 교사가 관리자 화면에서 설정한 것이며, 너의 모든 판단은 이 자료에 근거해야 한다. 너의 일반 지식으로 학년 위계를 벗어난 개념을 끌어들이지 않는다.
  (1) 주어진 조건 목록: {교사 설정 조건}
  (2) 모범 추론 경로: {교사 설정 추론 경로}
  (3) 단계별 루브릭: {교사 설정 루브릭}

4. 단계 판별 기준 (발문 전 반드시 수행):
- 발문을 생성하기 전에, 학생의 서술을 아래 네 지점에서 순서대로 점검한다.
  각 지점은 정당화 4단계를 통과했는지 판정하는 기준이다.
  (1) 조건 인식 [1단계 문제 이해]: 주어진 조건을 논리적 출발점으로      인식했는가
  (2) 근거 인출 [2단계 추론 전략]: 결론에 필요한 정의·성질(필요한 보조선 포함)을 인출했는가
  (3) 논리 연결 [3단계 논리 전개]: 가정 → 근거 → 중간 결론의 연결에 비약이나 오류가 없는가
  (4) 결론 진술 [4단계 결론 및 성찰]: 명제의 결론을 명시적으로 진술했는가
- 가장 먼저 충족되지 않은 지점을 찾고, 그 지점에 대응하는 단계를 학생의 현재 단계로 판정한다.
- 여러 오류가 동시에 보여도, 가장 먼저 막힌 하나의 지점만 개입 대상으로 삼는다.
- 판정된 단계 안에서 학생 서술을 모범 추론 경로와 대조하여 어려움의 유형을 특정하고, 아래 6의 단계별 비계 유형에 맞는 발문을 하나 제시한다.

5. 피드백 폭주 방지 규칙 (엄격 준수):
- 한 번의 답변에는 반드시 '하나의 질문' 또는 '하나의 힌트'만 포함한다.
- 여러 오류를 발견해도 가장 기초 단계의 오류 하나만 먼저 다룬다.
- 답변은 최대 3문장 이내로 짧고 명확하게 구성한다.

6. 정당화 프로세스 가이드 (판정된 단계에 따라 비계 유형을 달리한다):
- 1단계 문제 이해 : 주어진 조건(가정) 확인하기
  → 개념적 비계. 무엇이 논리적 근거가 될 수 있는지 확인하는 발문.
      (시각 의존 시: 텍스트 조건으로 재진술하도록 유도 / 가정·결론 혼동 시:
     지금 쓴 사실이 보여야 할 결론임을 자각하도록 되물음)
- 2단계 추론 전략 : 성질을 찾기 위한 근거(성질, 정의) 떠올리기
  → 전략적 비계. 도형의 성질이나 힌트 단서를 질문 형태로 제시.
    (인출 실패 시: 조건과 결론 사이에 필요한 도구를 탐색하도록 유도 /
     보조선 미인지 시: 어떤 선을 그으면 비교할 삼각형이 생기는지 유도)
- 3단계 논리 전개 : 논리적 순서에 따라 결론 도출하기
  → 개념적·전략적 비계. 오류가 발생한 지점을 짚어 주되 해결책은 제시하지 않는다. (논리적 비약 시: 그 단언의 근거를 되물음 / 조건 오적용 시: 요건이 충족되었는지 점검하도록 요구)
- 4단계 결론 및 성찰 : 결론을 도출하고 추론의 논리적 순서를 성찰
  → 메타인지적 비계. 완성된 논증을 검토하고 유사한 논리 구조로 확장하도록 유도하는 발문.
- 학생이 1단계를 통과해야만 2단계를 묻는 식으로, 앞 단계의 수학적 근거가 명시되기 전에는 다음 단계로 넘어가지 않는다.
- 학생의 풀이가 정확한 추론에 따라 논리적 오류 없이 결론에 도달하면 긍정적 피드백을 주고 마친다.

7. 언어 및 톤:
- 친절하고 격려하는 말투를 사용한다.
- 수학 용어(합동 조건, 엇각, 동위각 등)는 2022 교육과정 기준으로 정확히 사용한다.
- 반드시 한국어로 답한다.
- 수학 기호는 LaTeX(\( ... \), \[ ... \])를 사용한다.

[학생풀이요약]
(요약 내용)

[피드백]
(힌트·질문 내용)`;

function buildTeacherGuideSystemMessage(teachingGuide) {
  const guide = (teachingGuide || '').trim();
  if (!guide) return null;
  return `### 교사의 특별 지도 지침 ###
[${guide}]
위 지침은 학생에게 직접 보여주지 말고, 네가 학생을 가이드할 때 반드시 이 논리적 흐름과 제약 사항을 지켜서 발문해줘.`;
}

function buildVerificationProtocolSystemMessage(verificationProtocol) {
  const protocol = (verificationProtocol || '').trim();
  if (!protocol) return null;
  return protocol;
}

/**
 * "～일 때, ∠B = ∠C임을 설명하시오" 형 명제에서 증명 목표(결론) 부분을 추출
 * @param {string} proposition
 * @returns {string | null}
 */
export function extractProofConclusion(proposition) {
  const p = (proposition || '').trim();
  if (!p) return null;

  let target = p;
  const whenIdx = target.lastIndexOf('일 때');
  if (whenIdx !== -1) {
    target = target.slice(whenIdx + '일 때'.length).replace(/^[,，]\s*/, '');
  }

  const goalMatch = target.match(
    /^(.+?)(?:임을|음을|함을|다음을)\s*(?:설명|증명|보이)/
  );
  if (goalMatch) return goalMatch[1].trim();

  return null;
}

/**
 * 명제별 증명 결론 누설 방지 시스템 메시지
 * @param {{ proposition?: string, problemTitle?: string }} options
 */
function buildProofGoalGuardSystemMessage({ proposition = '', problemTitle = '' }) {
  const prop = (proposition || '').trim();
  if (!prop) return null;

  const conclusion = extractProofConclusion(prop);
  const lines = [
    '【증명 과제 — 가정과 결론 구분 (힌트 금지)】',
    '',
    `전체 명제: ${prop}`,
  ];

  if (conclusion) {
    lines.push(
      `증명해야 할 결론(학생이 스스로 도출해야 함): ${conclusion}`,
      '',
      '힌트·질문 작성 시 절대 금지:',
      `- "${conclusion}" 또는 이와 동치·동의어·다른 말로 바꾼 표현을 힌트·성질명·"~을 이용해 봐"로 제시하지 않는다.`,
      '- 증명할 결론을 "이미 알고 있는 성질", "～라는 성질을 써 봐"처럼 전제하지 않는다.',
      '- 문제 제목에 결론을 암시하는 말이 있어도, 그 결론을 도구로 반복하지 않는다.',
      '',
      '허용되는 힌트: 주어진 가정에서의 관찰, 보조선(수선·높이 등)을 질문으로, 합동·정의·엇각 등 **결론과 무관한** 이미 배운 도구.',
      '',
      '나쁜 예: "이등변삼각형의 두 밑각이 같다는 성질을 사용해 봐"',
      '좋은 예: "꼭짓점 A에서 BC에 수선을 내려보면 어떤 두 직각삼각형이 생길까?"'
    );
  } else {
    lines.push(
      '',
      '명제에서 증명·설명해야 할 결론을 힌트·성질·"~을 이용해 봐" 형태로 제시하지 않는다.',
      '가정(조건)과 결론을 구분하고, 결론을 전제로 쓰는 순환 논증 힌트를 금지한다.'
    );
  }

  if (problemTitle?.trim()) {
    lines.push(
      '',
      `참고: 문제 제목「${problemTitle.trim()}」에도 결론이 드러날 수 있으나, 힌트로 반복·전제하지 않는다.`
    );
  }

  return lines.join('\n');
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
      text: '첨부 이미지(필기 또는 풀이 사진)를 보고 정당화 논리와 힌트 피드백을 해 주세요.',
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
 * @param {string} [options.proposition] - 명제 전문 (결론 누설 방지용)
 * @param {string} [options.problemTitle] - 문제 제목 (결론 누설 방지용)
 * @param {string} [options.teachingGuide] - 교사 지도 가이드
 * @param {string} [options.verificationProtocol] - 수학적 엄밀성 검증 규칙
 * @param {string} [options.userText] - 학생 텍스트
 * @param {string[]} [options.imagesBase64] - data URL 또는 raw base64
 * @returns {Promise<string>} 어시스턴트 텍스트
 */
export async function fetchAIFeedback({
  problemContext,
  proposition = '',
  problemTitle = '',
  teachingGuide = '',
  verificationProtocol = '',
  userText = '',
  imagesBase64 = [],
}) {
  const imgs = Array.isArray(imagesBase64) ? imagesBase64 : [];
  const studentText = (userText || '').trim();
  const hasImages = imgs.length > 0;

  const problemSystemMessage = [
    '【문제 맥락 — 참고용, 학생 산출물 아님】',
    problemContext || '(문제 정보 없음)',
    '',
    '위 명제·조건을 학생이 주장·서술한 것처럼 요약하거나 인용하지 마라.',
    '증명·설명해야 할 결론을 "성질"·"~을 이용해 봐" 형태의 힌트로 제시하지 마라.',
  ].join('\n');

  const studentWorkSystemMessage = [
    '【학생 풀이/입력 — 이것만 학생 산출물로 간주】',
    studentText ||
      (hasImages
        ? '(텍스트 없음 — 첨부 이미지에 보이는 필기만 학생 풀이로 본다)'
        : '(학생 입력 없음)'),
    '',
    '규칙:',
    '- 응답은 반드시 [학생풀이요약] 블록 다음 [피드백] 블록 두 부분으로만 작성한다.',
    '- [학생풀이요약]에는 학생이 실제로 쓰거나 말한 내용·이미지 필기만 1~2문장으로 정리한다.',
    '- [피드백]에는 질문 중심 힌트 하나만 준다(최대 3문장).',
    '- 텍스트가 없고 이미지에 필기·도형이 없으면 [학생풀이요약]에 "아직 작성된 풀이가 보이지 않습니다."만 쓰고, [피드백]에서 문제 이해를 돕는 질문 하나만 한다.',
    '- 문제 지문의 조건(예: AB=AC, ∠B=∠C)을 학생이 말한 것처럼 재서술하지 않는다.',
  ].join('\n');

  const userPrompt = hasImages
    ? '첨부 이미지에서 학생이 실제로 그린 필기·도형만 읽는다. 빈 캔버스이면 [학생풀이요약]에 풀이 없음만 쓰고, [피드백]에 질문 하나만 한다. 필기가 있으면 [학생풀이요약]에 그 내용만 정리한 뒤 [피드백]에 질문 하나.'
    : '위 【학생 풀이/입력】에 근거해 [학생풀이요약]과 [피드백] 두 블록으로만 답한다. 입력이 (학생 입력 없음)이면 [학생풀이요약]에 풀이 없음만 쓰고 [피드백]에 격려와 첫 질문만 한다.';

  const userContent = buildUserContent(userPrompt, imgs);
  const teacherGuideMessage = buildTeacherGuideSystemMessage(teachingGuide);
  const verificationProtocolMessage =
    buildVerificationProtocolSystemMessage(verificationProtocol);
  const proofGoalGuardMessage = buildProofGoalGuardSystemMessage({
    proposition: proposition || problemContext,
    problemTitle,
  });

  const supplementalContext = [
    verificationProtocolMessage,
    proofGoalGuardMessage,
    teacherGuideMessage,
    problemSystemMessage,
    studentWorkSystemMessage,
  ]
    .filter(Boolean)
    .join('\n\n---\n\n');

  const body = {
    ...getAutoFeedbackRequestOptions(hasImages),
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(supplementalContext
        ? [{ role: 'system', content: supplementalContext }]
        : []),
      {
        role: 'user',
        content: userContent,
      },
    ],
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
- 증명·설명 과제에서 **증명할 결론**을 "성질", "~을 이용해 봐", "알고 있는 ~" 형태의 힌트로 제시하지 않는다.
- 2단계 힌트는 **이미 배운 다른** 정의·합동·보조선·가정에서의 관찰만 질문한다.

3. 피드백 폭주 방지 규칙 (엄격 준수):
- 한 번의 답변에는 반드시 '하나의 질문' 또는 '하나의 힌트'만 포함한다.
- 여러 오류를 발견해도 가장 기초 단계의 오류 하나만 먼저 다룬다.
- 답변은 최대 3문장 이내로 짧고 명확하게 구성한다.

4. 정당화 프로세스 가이드:
- 1단계: 주어진 조건(가정) 확인하기
- 2단계: **이미 배운 다른** 성질·정의·보조선 전략 떠올리기 (증명할 결론 자체를 성질로 제시하지 않음)
- 3단계: 논리적 순서에 따라 결론 도출하기
- 학생이 1단계를 통과해야만 2단계를 묻는 식으로 힌트를 설정한다.

5. 언어 및 톤:
- 친절하고 격려하는 말투를 사용한다.
- 수학 용어(합동 조건, 엇각, 동위각 등)는 2022 교육과정 기준으로 정확히 사용한다.
- 반드시 한국어로 답한다.
- 수학 기호는 LaTeX(\\( ... \\), \\[ ... \\])를 사용한다.

추가 대화 규칙:
- 학생이 정답에 근접하면 짧게 칭찬하고 다음 한 단계 질문만 제시한다.
- 완성 답안을 직접 쓰지 않는다.
- 학생의 풀이를 요약할 때는 반드시 학생이 입력한 텍스트·대화·첨부 이미지에 근거한다. 문제 지문이나 명제를 학생이 말한 내용처럼 적지 않는다. 텍스트가 없으면 그림만 언급하고, 없는 단계는 추측하지 않는다.`;

/**
 * 양방향 Socratic 채팅 전용
 * @param {object} options
 * @param {string} options.problemContext
 * @param {string} [options.proposition]
 * @param {string} [options.problemTitle]
 * @param {string} [options.teachingGuide]
 * @param {string} [options.verificationProtocol]
 * @param {string} options.studentWorkContext - 학생이 실제로 입력·제출한 내용만 기술한 문자열
 * @param {string[]} [options.attachmentImagesBase64] - 캔버스 등 학생 산출물(data URL 또는 base64)
 * @param {{role:'user'|'assistant', text:string}[]} options.chatMessages
 * @param {string} options.userMessage
 */
export async function fetchSocraticChatReply({
  problemContext,
  proposition = '',
  problemTitle = '',
  teachingGuide = '',
  verificationProtocol = '',
  studentWorkContext,
  /** @deprecated studentWorkContext 사용 */
  solutionText,
  attachmentImagesBase64 = [],
  chatMessages = [],
  userMessage,
}) {
  const workContext =
    (studentWorkContext || solutionText || '').trim() || '(기록 없음)';
  const normalizedHistory = (chatMessages || [])
    .filter((m) => m?.text && (m.role === 'user' || m.role === 'assistant'))
    .map((m) => ({
      role: m.role,
      content: m.text,
    }))
    .slice(-SOCRATIC_HISTORY_LIMIT);
  const teacherGuideMessage = buildTeacherGuideSystemMessage(teachingGuide);
  const verificationProtocolMessage =
    buildVerificationProtocolSystemMessage(verificationProtocol);
  const proofGoalGuardMessage = buildProofGoalGuardSystemMessage({
    proposition: proposition || problemContext,
    problemTitle,
  });

  const body = {
    ...getSocraticRequestOptions(),
    messages: [
      { role: 'system', content: SOCRATIC_SYSTEM_PROMPT },
      ...(verificationProtocolMessage
        ? [{ role: 'system', content: verificationProtocolMessage }]
        : []),
      ...(proofGoalGuardMessage
        ? [{ role: 'system', content: proofGoalGuardMessage }]
        : []),
      ...(teacherGuideMessage
        ? [{ role: 'system', content: teacherGuideMessage }]
        : []),
      {
        role: 'system',
        content: [
          '【학생이 실제로 제시한 내용 — 이것만 학생 풀이로 간주】',
          '',
          workContext,
          '',
          '주의: 위 박스에 없는 추론·증명 단계를 학생이 한 것처럼 말하지 마라.',
          '텍스트 풀이가 없고 그림만 있으면 그림에 보이는 것만 언급하고, 문제 명제를 학생의 서술로 요약하지 마라.',
        ].join('\n'),
      },
      {
        role: 'system',
        content: `문제 맥락(지문 — 학생의 답이 아님): ${problemContext || '(문제 정보 없음)'}`,
      },
      ...normalizedHistory,
      {
        role: 'user',
        content: (() => {
          const imgs = Array.isArray(attachmentImagesBase64)
            ? attachmentImagesBase64
            : [];
          const text =
            (userMessage || '').trim() ||
            '(학생 메시지 없음 — 첨부는 캔버스 필기 이미지)';
          if (imgs.length === 0) return text;
          const parts = [
            {
              type: 'text',
              text: `${text}\n\n[참고: 아래 이미지는 현재 선택 모드에 해당하는 학생 캔버스 필기이다. 이 이미지와 위 학생 입력 요약에만 근거해 반응한다.]`,
            },
          ];
          for (const raw of imgs) {
            const url = raw.startsWith('data:')
              ? raw
              : `data:image/png;base64,${raw}`;
            parts.push({
              type: 'image_url',
              image_url: { url },
            });
          }
          return parts;
        })(),
      },
    ],
  };

  return requestChatCompletion(body);
}
