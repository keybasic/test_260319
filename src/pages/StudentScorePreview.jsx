import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Loader2 } from 'lucide-react';
import Button from '../components/Button';
import ScoreBreakdownSection from '../components/ScoreBreakdownSection';
import { useProblems } from '../context/ProblemsContext';
import {
  hasConfiguredGradingSteps,
  loadScoreSnapshot,
  resolveScoreBreakdown,
} from '../lib/stepScore';

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
      setScoreNote(null);
      return undefined;
    }

    let cancelled = false;
    setScoreNote(null);
    setBreakdown(null);

    (async () => {
      const result = await resolveScoreBreakdown(problem, snapshot);
      if (cancelled) return;
      setBreakdown(result.breakdown);
      setScoreNote(result.scoreNote);
    })();

    return () => {
      cancelled = true;
    };
  }, [snapshot, problem]);

  const awaitingScore =
    !!snapshot &&
    !!problem &&
    hasConfiguredGradingSteps(problem.steps) &&
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

  const stepsConfigured = hasConfiguredGradingSteps(problem.steps);

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
              선생님이 제시한 부분점수 배점에 따라 증명 논리를 분석해 채점합니다.
            </p>
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

        <ScoreBreakdownSection
          stepsConfigured={stepsConfigured}
          breakdown={breakdown}
          scoreNote={scoreNote}
        />

        <p className="mt-6 text-[11px] text-slate-500 sm:mt-8 sm:text-xs">
          의미 채점은 VITE_OPENAI_API_KEY와 네트워크로 OpenAI에 연결됩니다. 판서만
          쓸 때는 AI 가이드의 필기 해석이 포함된 뒤 점수 확인을 권장합니다. API
          오류 시에만 키워드 방식으로 대체됩니다.
        </p>
      </main>
    </div>
  );
}
