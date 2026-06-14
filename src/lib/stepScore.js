import { fetchSemanticRubricGrading } from '../services/semanticRubricGrading';

/** @typedef {{ id: string, logicKeyword: string, points: number }} GradingStep */

const SNAPSHOT_PREFIX = 'studentScoreSnapshot:';

/** 자동 생성 피드백(gpt): 캔버스·사진·말하기 분석 — 점수 채점 시 근거로 사용 */
function isAutoFeedbackMessage(m) {
  if (m?.kind === 'gpt') return true;
  const id = String(m?.id || '');
  return /^(gpt-d|gpt-p|gpt-v)-/.test(id);
}

function labelForAutoFeedback(m, ordinal) {
  const id = String(m?.id || '');
  if (id.startsWith('gpt-d')) return `AI 가이드 · 캔버스 필기 해석 ${ordinal}`;
  if (id.startsWith('gpt-p')) return `AI 가이드 · 풀이 사진 해석 ${ordinal}`;
  if (id.startsWith('gpt-v')) return `AI 가이드 · 말하기/수식 분석 ${ordinal}`;
  return `AI 가이드 · 풀이 해석 ${ordinal}`;
}

export function getScoreSnapshotStorageKey(problemId) {
  return `${SNAPSHOT_PREFIX}${String(problemId)}`;
}

/**
 * 관리자 섹션 C에서 실제로 채점 가능한 Step이 설정됐는지 확인한다.
 * (키워드 비어있지 않고, 배점이 0보다 커야 유효)
 * @param {GradingStep[] | undefined | null} steps
 */
export function hasConfiguredGradingSteps(steps) {
  return (steps || []).some((step) => {
    const logicKeyword = String(step?.logicKeyword ?? '').trim();
    const points = Number(step?.points);
    return Boolean(logicKeyword) && Number.isFinite(points) && points > 0;
  });
}

function appendChatAndAutoFeedbackSources(sources, chatMessages) {
  const users = (chatMessages || []).filter((m) => m.role === 'user');
  users.forEach((m, i) => {
    const t = (m.text || '').trim();
    if (!t) return;
    sources.push({
      id: `chat-${m.id ?? i}`,
      label: `AI 대화 · 학생 ${i + 1}`,
      text: t,
    });
  });

  let autoFbOrdinal = 0;
  for (const m of chatMessages || []) {
    if (m.role !== 'assistant' || !isAutoFeedbackMessage(m)) continue;
    const t = (m.text || '').trim();
    if (!t) continue;
    autoFbOrdinal += 1;
    sources.push({
      id: `ai-guide-${m.id ?? autoFbOrdinal}`,
      label: labelForAutoFeedback(m, autoFbOrdinal),
      text: t,
      isAIGuideDerived: true,
    });
  }
}

/**
 * PDF·통합 채점용 — 학생이 사용한 모든 풀이 방식의 내용을 한꺼번에 수집
 */
export function buildCombinedStudentTextSources({
  draft = '',
  mathLatex = '',
  chatMessages = [],
  canvasHasInk = false,
  canvasPageCount = 0,
  photoDataUrl = '',
}) {
  const sources = [];

  if (draft?.trim()) {
    sources.push({
      id: 'draft',
      label: '말하기·정당화 설명',
      text: draft.trim(),
    });
  }
  if (mathLatex?.trim()) {
    sources.push({
      id: 'latex',
      label: '수식',
      text: mathLatex.trim(),
    });
  }
  if (canvasHasInk) {
    sources.push({
      id: 'draw-ink',
      label: '디지털 판서',
      text: `캔버스 필기 있음 (풀이 공간 ${canvasPageCount}개)`,
    });
  }
  if (photoDataUrl) {
    sources.push({
      id: 'photo',
      label: '풀이 사진',
      text: '풀이 사진 업로드됨',
    });
  }

  appendChatAndAutoFeedbackSources(sources, chatMessages);

  const hasSearchableText = sources.some((s) => s.text?.trim());
  if (canvasHasInk && !hasSearchableText) {
    sources.push({
      id: 'mode-note-draw',
      label: '풀이 공간(필기)',
      text: '',
      emptyHint:
        '필기만 있고 AI 가이드 해석이 아직 없습니다. 말하기·텍스트 또는 AI 대화를 추가해 보세요.',
    });
  }
  if (photoDataUrl && !hasSearchableText) {
    sources.push({
      id: 'mode-note-photo',
      label: '풀이 사진',
      text: '',
      emptyHint:
        '사진만 있고 해석 텍스트가 없습니다. 말하기·텍스트를 추가하거나 사진 분석 후 다시 시도해 보세요.',
    });
  }

  return sources;
}

/**
 * 학생이 작성한 텍스트를 출처별로 모은다. (키워드 매칭 위치 표시용)
 * 디지털 판서 등은 AI 가이드 자동 해석(kind:gpt) 텍스트를 포함한다.
 */
export function buildStudentTextSources({
  inputMode,
  draft,
  mathLatex,
  chatMessages,
}) {
  const sources = [];

  if (inputMode === 'verbal' && draft?.trim()) {
    sources.push({
      id: 'draft',
      label: '말하기·텍스트',
      text: draft.trim(),
    });
  } else if (draft?.trim()) {
    sources.push({
      id: 'draft-extra',
      label: '추가 텍스트',
      text: draft.trim(),
    });
  }
  if (mathLatex?.trim()) {
    sources.push({
      id: 'latex',
      label: '수식 (LaTeX)',
      text: mathLatex.trim(),
    });
  }

  appendChatAndAutoFeedbackSources(sources, chatMessages);

  const hasSearchableText = sources.some((s) => s.text?.trim());

  if (
    (inputMode === 'draw' || inputMode === 'photo') &&
    !hasSearchableText
  ) {
    sources.push({
      id: 'mode-note',
      label:
        inputMode === 'draw'
          ? '풀이 공간(필기)'
          : '풀이 사진',
      text: '',
      emptyHint:
        inputMode === 'draw'
          ? '필기만 있고 AI 가이드 해석이 아직 없습니다. 잠시 후 다시 점수 확인을 누르거나, 말하기·텍스트·수식·AI 대화를 추가해 보세요.'
          : '사진만 있고 해석 텍스트가 없습니다. 말하기·텍스트·수식·AI 대화를 추가하거나 사진 분석 후 다시 시도해 보세요.',
    });
  }

  return sources;
}

function normalizeForMatch(s) {
  return String(s)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function keywordFoundInText(keyword, text) {
  if (!keyword?.trim() || !text?.trim()) return false;
  return normalizeForMatch(text).includes(normalizeForMatch(keyword));
}

/**
 * 출처별로 키워드가 처음 걸리는 위치를 찾는다.
 * @returns {{ sourceId: string, sourceLabel: string, excerpt: string } | null}
 */
function findKeywordSources(keyword, sources) {
  if (!keyword?.trim()) return null;
  const matches = [];
  for (const s of sources) {
    if (!s.text?.trim()) continue;
    if (keywordFoundInText(keyword, s.text)) {
      const t = s.text.replace(/\s+/g, ' ');
      const excerpt =
        t.length > 120 ? `${t.slice(0, 117)}…` : t;
      matches.push({
        sourceId: s.id,
        sourceLabel: s.label,
        excerpt,
      });
    }
  }
  return matches.length ? matches : null;
}

/**
 * 관리자 단계 배점과 학생 텍스트를 맞춘 결과.
 * @param {GradingStep[]} steps
 * @param {ReturnType<typeof buildStudentTextSources>} sources
 */
export function computeStepScoreBreakdown(steps, sources) {
  const haystackSources = sources.filter((s) => s.text?.trim());
  const combinedHaystack = haystackSources.map((s) => s.text).join('\n');

  const stepRows = (steps || []).map((step, index) => {
    const kw = String(step.logicKeyword ?? '').trim();
    const maxPts = Number(step.points);
    const safeMax = Number.isFinite(maxPts) && maxPts >= 0 ? maxPts : 0;

    if (!kw) {
      return {
        stepIndex: index + 1,
        id: step.id ?? `step-${index}`,
        logicKeyword: '',
        maxPoints: safeMax,
        earned: 0,
        matched: false,
        matchLocations: null,
        note: '관리자가 단계 키워드를 비워 두었습니다.',
        rationale: null,
      };
    }

    const matched = keywordFoundInText(kw, combinedHaystack);
    const earned = matched ? safeMax : 0;
    const matchLocations = matched ? findKeywordSources(kw, haystackSources) : null;

    return {
      stepIndex: index + 1,
      id: step.id ?? `step-${index}`,
      logicKeyword: kw,
      maxPoints: safeMax,
      earned,
      matched,
      matchLocations,
      note: null,
      rationale: null,
    };
  });

  return finalizeBreakdown(stepRows, sources, 'keyword');
}

/**
 * 공통 합계·힌트 (키워드 / 의미 채점 공용)
 * @param {'keyword' | 'semantic'} scoringMethod
 */
export function finalizeBreakdown(
  stepRows,
  sources,
  scoringMethod = 'keyword'
) {
  const haystackSources = sources.filter((s) => s.text?.trim());
  const combinedHaystack = haystackSources.map((s) => s.text).join('\n');
  const maxTotal = stepRows.reduce((a, r) => a + r.maxPoints, 0);
  const earnedTotal = stepRows.reduce((a, r) => a + r.earned, 0);
  const modeHints = sources
    .filter((s) => s.emptyHint)
    .map((s) => ({ label: s.label, message: s.emptyHint }));

  return {
    stepRows,
    maxTotal,
    earnedTotal,
    percent: maxTotal > 0 ? Math.round((earnedTotal / maxTotal) * 1000) / 10 : null,
    combinedHaystack,
    hasSearchableText: Boolean(combinedHaystack.trim()),
    modeHints,
    scoringMethod,
  };
}

/**
 * GPT 루브릭 JSON(normalizeRubricResponse 결과)을 점수 확인 UI용 breakdown으로 변환한다.
 * @param {GradingStep[]} steps
 * @param {ReturnType<typeof buildStudentTextSources>} sources
 * @param {{
 *   totalScore?: number,
 *   maxTotalScore?: number,
 *   overallComment?: string,
 *   rubricResults: { stepIndex?: number, criteria?: string, score: number, maxScore?: number, feedback?: string }[]
 * }} payload
 */
export function mergeRubricApiToBreakdown(steps, sources, payload) {
  const list = Array.isArray(payload?.rubricResults) ? payload.rubricResults : [];

  const stepRows = (steps || []).map((step, index) => {
    const kw = String(step.logicKeyword ?? '').trim();
    const safeMax = Math.max(0, Number(step.points) || 0);
    const r = list[index] || {};
    const earned = Math.min(
      safeMax,
      Math.max(0, Number(r.score) || 0)
    );
    const feedback = String(r.feedback ?? '').trim();
    const criteriaLabel = String(r.criteria ?? kw).trim();

    if (!kw) {
      return {
        stepIndex: index + 1,
        id: step.id ?? `step-${index}`,
        logicKeyword: '',
        maxPoints: safeMax,
        earned: 0,
        matched: false,
        matchLocations: null,
        note: '관리자가 단계 키워드를 비워 두었습니다.',
        rationale: null,
        rubricCriteria: criteriaLabel || null,
      };
    }

    return {
      stepIndex: index + 1,
      id: step.id ?? `step-${index}`,
      logicKeyword: kw,
      rubricCriteria: criteriaLabel !== kw ? criteriaLabel : null,
      maxPoints: safeMax,
      earned,
      matched: earned > 0,
      matchLocations: null,
      note: null,
      rationale: feedback || null,
    };
  });

  const base = finalizeBreakdown(stepRows, sources, 'semantic');
  const apiTotal = Number(payload?.totalScore);
  const earnedSum = stepRows.reduce((a, row) => a + row.earned, 0);
  const earnedTotal =
    Number.isFinite(apiTotal) && Math.abs(apiTotal - earnedSum) < 0.5
      ? apiTotal
      : earnedSum;

  return {
    ...base,
    earnedTotal,
    percent:
      base.maxTotal > 0
        ? Math.round((earnedTotal / base.maxTotal) * 1000) / 10
        : null,
    overallProofSummary: String(payload?.overallComment ?? '').trim() || null,
    apiTotalScore: Number.isFinite(apiTotal) ? apiTotal : null,
    maxTotalScoreApi:
      Number(payload?.maxTotalScore) >= 0
        ? Number(payload.maxTotalScore)
        : null,
  };
}

/**
 * 점수 확인 창·PDF 제출에서 공통으로 쓰는 채점 결과 계산
 * @param {{ title: string, proposition?: string, teachingGuide?: string, steps?: GradingStep[] }} problem
 * @param {{ inputMode: string, draft?: string, mathLatex?: string, chatMessages?: object[], includeAllModes?: boolean, canvasHasInk?: boolean, canvasPageCount?: number, photoDataUrl?: string }} workSnapshot
 */
export async function resolveScoreBreakdown(problem, workSnapshot) {
  const {
    inputMode,
    draft = '',
    mathLatex = '',
    chatMessages = [],
    includeAllModes = false,
    canvasHasInk = false,
    canvasPageCount = 0,
    photoDataUrl = '',
  } = workSnapshot;

  const sources = includeAllModes
    ? buildCombinedStudentTextSources({
        draft,
        mathLatex,
        chatMessages,
        canvasHasInk,
        canvasPageCount,
        photoDataUrl,
      })
    : buildStudentTextSources({
        inputMode,
        draft,
        mathLatex,
        chatMessages,
      });
  const steps = problem.steps || [];
  const stepsConfigured = hasConfiguredGradingSteps(steps);

  if (!stepsConfigured) {
    return { stepsConfigured: false, breakdown: null, scoreNote: null };
  }

  const labeled = sources
    .filter((s) => s.text?.trim())
    .map((s) => ({ label: s.label, text: s.text }));

  if (!labeled.length || !steps.length) {
    return {
      stepsConfigured: true,
      breakdown: computeStepScoreBreakdown(steps, sources),
      scoreNote: null,
    };
  }

  try {
    const rubricPayload = await fetchSemanticRubricGrading({
      problemTitle: problem.title,
      proposition: problem.proposition,
      teachingGuide: problem.teachingGuide,
      steps,
      labeledStudentSections: labeled,
    });
    return {
      stepsConfigured: true,
      breakdown: mergeRubricApiToBreakdown(steps, sources, rubricPayload),
      scoreNote:
        'GPT-4o 루브릭 의미 채점 결과입니다. (가정→근거→결론 연계를 분석합니다)',
    };
  } catch (e) {
    return {
      stepsConfigured: true,
      breakdown: computeStepScoreBreakdown(steps, sources),
      scoreNote: `의미 채점 API 오류로 키워드 방식으로 표시합니다. (${e?.message || String(e)})`,
    };
  }
}

export function saveScoreSnapshot(problemId, payload) {
  const key = getScoreSnapshotStorageKey(problemId);
  sessionStorage.setItem(
    key,
    JSON.stringify({
      v: 1,
      savedAt: Date.now(),
      problemId: String(problemId),
      ...payload,
    })
  );
}

export function loadScoreSnapshot(problemId) {
  try {
    const raw = sessionStorage.getItem(getScoreSnapshotStorageKey(problemId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.problemId !== String(problemId)) return null;
    return data;
  } catch {
    return null;
  }
}
