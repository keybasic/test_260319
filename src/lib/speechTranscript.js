/**
 * 음성 인식 결과 정규화: 도형 기호에 쓰는 라틴 알파벳은 대문자로 통일
 */
export function normalizeSpeechTranscript(text) {
  if (!text) return '';
  return text.replace(/[a-z]/g, (ch) => ch.toUpperCase());
}
