import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Loader2 } from 'lucide-react';
import Button from '../components/Button';
import { useProblems } from '../context/ProblemsContext';
import {
  buildStudentTextSources,
  computeStepScoreBreakdown,
  loadScoreSnapshot,
  mergeRubricApiToBreakdown,
} from '../lib/stepScore';
import { fetchSemanticRubricGrading } from '../services/semanticRubricGrading';

export default function StudentScorePreview() {
  const { problemId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPopupLayout = searchParams.get('popup') === '1';

  const { getProblem, isLoading } = useProblems();

  const problem = useMemo(
    () => (problemId ? getProblem(problemId) : null),
    [getProblem, problemId]
  );

  const snapshot = useMemo(
    () => (problemId ? loadScoreSnapshot(problemId) : null),
    [problemId]
  );

  const [breakdown, setBreakdown] = useState(null);
  const [scoreNote, setScoreNote] = useState(null);

  useEffect(() => {
    if (!snapshot || !problem) {
      setBreakdown(null);
      return undefined;
    }

    const sources = buildStudentTextSources({
      inputMode: snapshot.inputMode,
      draft: snapshot.draft,
      mathLatex: snapshot.mathLatex,
      chatMessages: snapshot.chatMessages || [],
    });

    const labeled = sources
      .filter((s) => s.text?.trim())
      .map((s) => ({ label: s.label, text: s.text }));

    if (!labeled.length) {
      setBreakdown(computeStepScoreBreakdown(problem.steps || [], sources));
      setScoreNote(null);
      return undefined;
    }

    const steps = problem.steps || [];
    if (!steps.length) {
      setBreakdown(computeStepScoreBreakdown(steps, sources));
      setScoreNote(null);
      return undefined;
    }

    let cancelled = false;
    setScoreNote(null);
    setBreakdown(null);

    (async () => {
      try {
        const rubricPayload = await fetchSemanticRubricGrading({
          problemTitle: problem.title,
          proposition: problem.proposition,
          teachingGuide: problem.teachingGuide,
          steps,
          labeledStudentSections: labeled,
        });
        if (cancelled) return;
        setBreakdown(mergeRubricApiToBreakdown(steps, sources, rubricPayload));
        setScoreNote(
          'GPT-4o 루브릭 의미 채점 결과입니다. (가정→근거→결론 연계를 분석합니다)'
        );
      } catch (e) {
        if (cancelled) return;
        setBreakdown(computeStepScoreBreakdown(steps, sources));
        setScoreNote(
          `의미 채점 API 오류로 키워드 방식으로 표시합니다. (${e?.message || String(e)})`
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [snapshot, problem]);

  const awaitingScore =
    !!snapshot &&
    !!problem &&
    (problem.steps || []).length > 0 &&
    breakdown === null;

  if (isLoading || awaitingScore) {
    return (
      <div
        className={`bg-slate-50 flex items-center justify-center text-slate-600 ${
          isPopupLayout ? 'min-h-[60vh]' : 'min-h-screen'
        }`}
      >
        <Loader2 className="mr-2 h-5 w-5 animate-spin shrink-0" />
        {isLoading ? '불러오는 중…' : '단계별 점수 분석 중…'}
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-slate-700">문제를 찾을 수 없습니다.</p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => navigate('/')}
          >
            홈으로
          </Button>
        </div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center shadow-sm">
          <p className="text-amber-900">
            점수 확인에 필요한 데이터가 없습니다. 학생 풀이 화면에서「점수
            확인」을 다시 눌러 주세요.
          </p>
          <Button
            variant="secondary"
            className="mt-4"
            leftIcon={ArrowLeft}
            onClick={() => navigate(`/workspace/${problemId}`)}
          >
            풀이 화면으로
          </Button>
        </div>
      </div>
    );
  }

  const stepsConfigured = (problem.steps || []).length > 0;

  const mainClass = isPopupLayout
    ? 'min-h-0 bg-slate-50 pb-6'
    : 'min-h-screen bg-slate-50';
  const innerClass = isPopupLayout ? 'max-w-md mx-auto' : 'max-w-3xl mx-auto';

  return (
    <div className={mainClass}>
      <main className={`${innerClass} px-3 py-4 sm:px-4 sm:py-6`}>
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <ClipboardList className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h1
              className={`font-bold text-slate-900 ${isPopupLayout ? 'text-lg' : 'text-xl'}`}
            >
              단계별 점수 확인
            </h1>
            <p className="mt-1 text-xs text-slate-600 sm:text-sm">
              관리자 루브릭에 따라 증명 논리를 분석해 배점합니다. 키워드 일치가
              아니라 의미·연계를 봅니다.
            </p>
            {scoreNote ? (
              <p className="mt-2 rounded-lg bg-slate-100 px-2 py-1.5 text-xs text-slate-700">
                {scoreNote}
              </p>
            ) : null}
          </div>
        </div>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:mt-6 sm:p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            문제
          </p>
          <p className="mt-1 text-base font-semibold text-slate-900 sm:text-lg">
            {problem.title}
          </p>
          {problem.proposition ? (
            <p className="mt-2 text-xs leading-relaxed text-slate-700 whitespace-pre-wrap sm:text-sm">
              {problem.proposition}
            </p>
          ) : null}
        </section>

        {!stepsConfigured ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950 sm:mt-6 sm:p-5 sm:text-sm">
            이 문제에는 아직 관리자용 단계 배점이 설정되어 있지 않습니다.
            관리자 대시보드의「섹션 C: 논리 위계 및 단계별 배점」에서 Step을
            추가해 주세요.
          </div>
        ) : (
          <>
            <section className="mt-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm sm:mt-6 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-600">획득 점수</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">
                    {breakdown?.earnedTotal ?? 0}
                    <span className="text-base font-semibold text-slate-500 sm:text-lg">
                      {' '}
                      / {breakdown?.maxTotal ?? 0}
                    </span>
                  </p>
                </div>
                {breakdown?.percent != null ? (
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-600">
                      만점 대비
                    </p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-blue-700 sm:text-2xl">
                      {breakdown.percent}%
                    </p>
                  </div>
                ) : null}
              </div>
              {breakdown?.modeHints?.length ? (
                <ul className="mt-3 space-y-2 text-xs text-slate-700 sm:text-sm">
                  {breakdown.modeHints.map((h, i) => (
                    <li
                      key={`hint-${i}`}
                      className="rounded-lg border border-slate-200/80 bg-white/80 px-3 py-2"
                    >
                      <span className="font-medium text-slate-800">{h.label}</span>
                      <p className="mt-1 text-slate-600">{h.message}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
              {!breakdown?.hasSearchableText ? (
                <p className="mt-3 rounded-lg bg-amber-100/80 px-3 py-2 text-xs text-amber-950 sm:text-sm">
                  비교할 글이 없습니다. 말하기·텍스트, 수식, 또는 AI 대화에서
                  학생 메시지를 입력하면 채점이 가능합니다.
                </p>
              ) : null}
              {breakdown?.overallProofSummary ? (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white/90 px-3 py-2.5 text-xs text-slate-800 sm:text-sm">
                  <p className="font-semibold text-slate-700">총평</p>
                  <p className="mt-1.5 leading-relaxed whitespace-pre-wrap">
                    {breakdown.overallProofSummary}
                  </p>
                </div>
              ) : null}
            </section>

            <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:mt-6">
              <h2 className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-800 sm:px-5 sm:py-3 sm:text-sm">
                {breakdown?.scoringMethod === 'semantic'
                  ? '루브릭별 채점 결과'
                  : '단계별 결과'}
              </h2>
              <div className="divide-y divide-slate-100">
                {(breakdown?.stepRows || []).map((row) => (
                  <div key={row.id} className="px-4 py-3 sm:px-5 sm:py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-slate-500">
                          Step {row.stepIndex}
                        </span>
                        <p className="mt-0.5 text-sm font-medium text-slate-900 sm:text-base">
                          {row.logicKeyword || '(키워드 없음)'}
                        </p>
                        {row.rubricCriteria ? (
                          <p className="mt-0.5 text-xs text-slate-600">
                            채점 기준 요약: {row.rubricCriteria}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-right tabular-nums shrink-0">
                        <span
                          className={
                            breakdown?.scoringMethod === 'semantic'
                              ? row.maxPoints > 0 &&
                                row.earned >= row.maxPoints - 0.01
                                ? 'text-lg font-bold text-emerald-700'
                                : row.earned > 0
                                  ? 'text-lg font-bold text-amber-700'
                                  : 'text-lg font-semibold text-slate-400'
                              : row.matched
                                ? 'text-lg font-bold text-emerald-700'
                                : 'text-lg font-semibold text-slate-400'
                          }
                        >
                          +{row.earned}
                        </span>
                        <span className="text-slate-500">
                          {' '}
                          / {row.maxPoints}점
                        </span>
                      </div>
                    </div>

                    {row.note ? (
                      <p className="mt-2 text-xs text-amber-800">{row.note}</p>
                    ) : null}

                    {row.rationale ? (
                      <p className="mt-2 text-xs text-slate-700 leading-relaxed sm:text-sm">
                        <span className="font-medium text-slate-800">
                          {breakdown?.scoringMethod === 'semantic'
                            ? '피드백: '
                            : '판정: '}
                        </span>
                        {row.rationale}
                      </p>
                    ) : null}

                    {row.matched && row.matchLocations?.length ? (
                      <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs sm:text-sm">
                        <p className="font-medium text-slate-700">근거 인용</p>
                        <ul className="mt-1.5 space-y-2">
                          {row.matchLocations.map((loc, i) => (
                            <li key={`${row.id}-loc-${i}`}>
                              <span className="text-xs font-semibold text-blue-700">
                                {loc.sourceLabel}
                              </span>
                              <p className="mt-0.5 break-words text-xs text-slate-600">
                                {loc.excerpt}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {!row.matched && row.logicKeyword && !row.note ? (
                      <p className="mt-2 text-xs text-slate-500">
                        {breakdown?.scoringMethod === 'semantic'
                          ? '이 단계에 해당하는 논리가 학생 텍스트에서 확인되지 않았습니다.'
                          : '관리자가 설정한 문구가 풀이 텍스트에 포함되지 않았습니다.'}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        <p className="mt-6 text-[11px] text-slate-500 sm:mt-8 sm:text-xs">
          의미 채점은 VITE_OPENAI_API_KEY와 네트워크로 OpenAI에 연결됩니다. 판서만
          쓸 때는 AI 가이드의 필기 해석이 포함된 뒤 점수 확인을 권장합니다. API
          오류 시에만 키워드 방식으로 대체됩니다.
        </p>
      </main>
    </div>
  );
}
