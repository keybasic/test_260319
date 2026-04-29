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

  if (draft?.trim()) {
    sources.push({
      id: 'draft',
      label: '말하기·텍스트',
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
