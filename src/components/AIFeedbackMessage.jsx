import MathMarkdown from './MathMarkdown';
import { parseAIFeedbackSections } from '../lib/parseAIFeedbackSections';

/**
 * AI 가이드 메시지 — [학생풀이요약] / [피드백] 구조가 있으면 섹션별로 표시
 */
export default function AIFeedbackMessage({ text, variant = 'chat' }) {
  const sections = parseAIFeedbackSections(text);

  if (!sections) {
    return <MathMarkdown>{text}</MathMarkdown>;
  }

  const headingClass =
    variant === 'print'
      ? 'text-xs font-bold text-slate-700'
      : 'text-xs font-semibold tracking-wide';

  return (
    <div className="space-y-3">
      <div>
        <p className={`${headingClass} text-slate-500`}>[학생풀이요약]</p>
        <MathMarkdown
          className="mt-1 text-sm text-slate-700"
          emptyLabel="(작성된 풀이 없음)"
        >
          {sections.summary}
        </MathMarkdown>
      </div>
      <div>
        <p className={`${headingClass} text-blue-700`}>[피드백]</p>
        <MathMarkdown className="mt-1 text-sm text-slate-800">
          {sections.feedback}
        </MathMarkdown>
      </div>
    </div>
  );
}
