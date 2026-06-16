/**
 * AI 자동 피드백 응답을 [학생풀이요약] / [피드백] 블록으로 분리
 * @param {string} text
 * @returns {{ summary: string, feedback: string } | null}
 */
export function parseAIFeedbackSections(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const hasMarkers =
    /\[학생\s*풀이\s*요약\]/i.test(raw) && /\[피드백\]/i.test(raw);
  if (!hasMarkers) return null;

  const summaryMatch = raw.match(
    /\[학생\s*풀이\s*요약\]\s*([\s\S]*?)(?=\[피드백\]|$)/i
  );
  const feedbackMatch = raw.match(/\[피드백\]\s*([\s\S]*)/i);

  return {
    summary: (summaryMatch?.[1] || '').trim(),
    feedback: (feedbackMatch?.[1] || '').trim(),
  };
}
