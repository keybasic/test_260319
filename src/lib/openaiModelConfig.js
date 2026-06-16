/**
 * OpenAI 피드백 호출용 모델·토큰 설정
 * - 텍스트 전용: reasoning_effort minimal (가장 빠름)
 * - 이미지(판서·사진): reasoning_effort low (OCR 품질 유지)
 *
 * 환경 변수(선택):
 * - VITE_OPENAI_TEXT_FEEDBACK_MODEL — 말하기·텍스트 피드백 (기본 gpt-5-mini)
 * - VITE_OPENAI_VISION_FEEDBACK_MODEL — 판서·사진 피드백 (기본 gpt-5-mini)
 *   텍스트만 빠르게 쓰려면 VITE_OPENAI_TEXT_FEEDBACK_MODEL=gpt-4o-mini 등으로 설정
 */

const DEFAULT_MODEL = 'gpt-5-mini';

function readEnvModel(key) {
  const value = import.meta.env[key];
  return value && String(value).trim() ? String(value).trim() : '';
}

export function getAutoFeedbackModel(hasImages) {
  if (hasImages) {
    return readEnvModel('VITE_OPENAI_VISION_FEEDBACK_MODEL') || DEFAULT_MODEL;
  }
  return readEnvModel('VITE_OPENAI_TEXT_FEEDBACK_MODEL') || DEFAULT_MODEL;
}

/** 자동 피드백(말하기·판서·사진) API body 옵션 */
export function getAutoFeedbackRequestOptions(hasImages) {
  return {
    model: getAutoFeedbackModel(hasImages),
    max_completion_tokens: hasImages ? 1800 : 900,
    reasoning_effort: hasImages ? 'low' : 'minimal',
  };
}

/** Socratic 채팅 API body 옵션 */
export function getSocraticRequestOptions() {
  return {
    model: readEnvModel('VITE_OPENAI_TEXT_FEEDBACK_MODEL') || DEFAULT_MODEL,
    max_completion_tokens: 1200,
    reasoning_effort: 'low',
  };
}

/** 채팅 기록이 길어질 때 전송 토큰·지연을 줄이기 위한 상한 */
export const SOCRATIC_HISTORY_LIMIT = 10;
