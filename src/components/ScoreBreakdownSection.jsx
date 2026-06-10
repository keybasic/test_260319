import MathMarkdown from './MathMarkdown';

/**
 * 단계별 채점 결과 UI (점수 확인 창 · PDF 공용)
 */
export default function ScoreBreakdownSection({
  stepsConfigured,
  breakdown,
  scoreNote,
  variant = 'screen',
}) {
  const isPrint = variant === 'print';

  if (!stepsConfigured) {
    return (
      <div
        className={
          isPrint
            ? 'mt-2 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950'
            : 'mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950 sm:mt-6 sm:p-5 sm:text-sm'
        }
      >
        {isPrint
          ? '이 문제에는 아직 관리자용 단계 배점이 설정되어 있지 않습니다.'
          : '이 문제에는 아직 관리자용 단계 배점이 설정되어 있지 않습니다. 관리자 대시보드의「섹션 C: 논리 위계 및 단계별 배점」에서 Step을 추가해 주세요.'}
      </div>
    );
  }

  if (!breakdown) {
    return (
      <p className={`text-slate-500 ${isPrint ? 'text-sm' : 'text-xs sm:text-sm'}`}>
        채점 결과를 불러오지 못했습니다.
      </p>
    );
  }

  const sectionGap = isPrint ? 'mt-4' : 'mt-4 sm:mt-6';
  const cardClass = isPrint
    ? 'rounded border border-slate-200 bg-slate-50 p-3'
    : 'rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm sm:p-6';

  return (
    <>
      {scoreNote ? (
        <MathMarkdown
          className={
            isPrint
              ? 'mt-2 rounded border border-slate-200 bg-slate-100 px-2 py-1.5 text-xs text-slate-700'
              : 'mt-2 rounded-lg bg-slate-100 px-2 py-1.5 text-xs text-slate-700'
          }
        >
          {scoreNote}
        </MathMarkdown>
      ) : null}

      <section className={`${sectionGap} ${cardClass}`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className={`font-medium text-slate-600 ${isPrint ? 'text-xs' : 'text-sm'}`}>
              획득 점수
            </p>
            <p
              className={`mt-1 font-bold tabular-nums text-slate-900 ${
                isPrint ? 'text-xl' : 'text-2xl sm:text-3xl'
              }`}
            >
              {breakdown.earnedTotal ?? 0}
              <span
                className={`font-semibold text-slate-500 ${
                  isPrint ? 'text-sm' : 'text-base sm:text-lg'
                }`}
              >
                {' '}
                / {breakdown.maxTotal ?? 0}
              </span>
            </p>
          </div>
          {breakdown.percent != null ? (
            <div className="text-right">
              <p className={`font-medium text-slate-600 ${isPrint ? 'text-xs' : 'text-sm'}`}>
                만점 대비
              </p>
              <p
                className={`mt-1 font-bold tabular-nums text-blue-700 ${
                  isPrint ? 'text-lg' : 'text-xl sm:text-2xl'
                }`}
              >
                {breakdown.percent}%
              </p>
            </div>
          ) : null}
        </div>

        {breakdown.modeHints?.length ? (
          <ul className={`mt-3 space-y-2 text-slate-700 ${isPrint ? 'text-xs' : 'text-xs sm:text-sm'}`}>
            {breakdown.modeHints.map((h, i) => (
              <li
                key={`hint-${i}`}
                className="rounded-lg border border-slate-200/80 bg-white/80 px-3 py-2"
              >
                <span className="font-medium text-slate-800">{h.label}</span>
                <MathMarkdown className="mt-1 text-slate-600">{h.message}</MathMarkdown>
              </li>
            ))}
          </ul>
        ) : null}

        {!breakdown.hasSearchableText ? (
          <p
            className={`mt-3 rounded-lg bg-amber-100/80 px-3 py-2 text-amber-950 ${
              isPrint ? 'text-xs' : 'text-xs sm:text-sm'
            }`}
          >
            비교할 글이 없습니다. 말하기·텍스트, 수식, 또는 AI 대화에서 학생 메시지를
            입력하면 채점이 가능합니다.
          </p>
        ) : null}

        {breakdown.overallProofSummary ? (
          <div
            className={`mt-3 rounded-lg border border-slate-200 bg-white/90 px-3 py-2.5 text-slate-800 ${
              isPrint ? 'text-xs' : 'text-xs sm:text-sm'
            }`}
          >
            <p className="font-semibold text-slate-700">총평</p>
            <MathMarkdown className="mt-1.5 leading-relaxed">
              {breakdown.overallProofSummary}
            </MathMarkdown>
          </div>
        ) : null}
      </section>

      <section
        className={`${sectionGap} overflow-hidden rounded-2xl border border-slate-200 bg-white ${
          isPrint ? '' : 'shadow-sm'
        }`}
      >
        <h2
          className={`border-b border-slate-100 bg-slate-50 font-semibold text-slate-800 ${
            isPrint
              ? 'px-3 py-2 text-xs'
              : 'px-4 py-2.5 text-xs sm:px-5 sm:py-3 sm:text-sm'
          }`}
        >
          {breakdown.scoringMethod === 'semantic'
            ? '루브릭별 채점 결과'
            : '단계별 결과'}
        </h2>
        <div className="divide-y divide-slate-100">
          {(breakdown.stepRows || []).map((row) => (
            <div
              key={row.id}
              className={isPrint ? 'px-3 py-2.5' : 'px-4 py-3 sm:px-5 sm:py-4'}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-slate-500">
                    Step {row.stepIndex}
                  </span>
                  <MathMarkdown
                    className={`mt-0.5 font-medium text-slate-900 ${
                      isPrint ? 'text-sm' : 'text-sm sm:text-base'
                    }`}
                    emptyLabel="(키워드 없음)"
                  >
                    {row.logicKeyword}
                  </MathMarkdown>
                  {row.rubricCriteria ? (
                    <div className="mt-0.5 text-xs text-slate-600">
                      <span className="font-medium">채점 기준 요약: </span>
                      <MathMarkdown className="inline-block">
                        {row.rubricCriteria}
                      </MathMarkdown>
                    </div>
                  ) : null}
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  <span
                    className={
                      breakdown.scoringMethod === 'semantic'
                        ? row.maxPoints > 0 && row.earned >= row.maxPoints - 0.01
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
                  <span className="text-slate-500"> / {row.maxPoints}점</span>
                </div>
              </div>

              {row.note ? (
                <MathMarkdown className="mt-2 text-xs text-amber-800">
                  {row.note}
                </MathMarkdown>
              ) : null}

              {row.rationale ? (
                <div
                  className={`mt-2 leading-relaxed text-slate-700 ${
                    isPrint ? 'text-xs' : 'text-xs sm:text-sm'
                  }`}
                >
                  <p className="font-medium text-slate-800">
                    {breakdown.scoringMethod === 'semantic' ? '피드백' : '판정'}
                  </p>
                  <MathMarkdown>{row.rationale}</MathMarkdown>
                </div>
              ) : null}

              {row.matched && row.matchLocations?.length ? (
                <div
                  className={`mt-2 rounded-lg bg-slate-50 px-3 py-2 ${
                    isPrint ? 'text-xs' : 'text-xs sm:text-sm'
                  }`}
                >
                  <p className="font-medium text-slate-700">근거 인용</p>
                  <ul className="mt-1.5 space-y-2">
                    {row.matchLocations.map((loc, i) => (
                      <li key={`${row.id}-loc-${i}`}>
                        <span className="text-xs font-semibold text-blue-700">
                          {loc.sourceLabel}
                        </span>
                        <MathMarkdown className="mt-0.5 break-words text-xs text-slate-600">
                          {loc.excerpt}
                        </MathMarkdown>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {!row.matched && row.logicKeyword && !row.note ? (
                <p className="mt-2 text-xs text-slate-500">
                  {breakdown.scoringMethod === 'semantic'
                    ? '이 단계에 해당하는 논리가 학생 텍스트에서 확인되지 않았습니다.'
                    : '관리자가 설정한 문구가 풀이 텍스트에 포함되지 않았습니다.'}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
