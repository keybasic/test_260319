/**
 * OpenAI 등 외부 API 호출 빈도 제한 (Debounce + Throttle)
 * - Debounce: 입력이 잠시 멈춘 뒤에만 후속 로직 실행 (StudentWorkspace의 훅/타이머에서 사용)
 * - Throttle: 마지막 호출 완료 시각 기준 최소 간격(minIntervalMs) 보장
 */

export const API_RATE = {
  /** 말하기/텍스트: 입력 안정화 후 전송 + 연속 호출 간 최소 간격 */
  verbal: {
    debounceMs: 900,
    minIntervalMs: 3500,
  },
  /** 캔버스: 필기 멈춤 후 캡처 + 비전 호출 간 최소 간격 */
  canvas: {
    idleDebounceMs: 1000,
    minIntervalMs: 4500,
  },
  /** 사진: 연속 업로드 시 최소 간격 */
  photo: {
    minIntervalMs: 3000,
  },
};

/**
 * @param {number} lastCompletedAt - Date.now() (마지막 성공/시도 완료 시각)
 * @param {number} minIntervalMs
 * @returns {number} 이만큼 ms 대기한 뒤 API를 호출하면 됨
 */
export function getThrottleWaitMs(lastCompletedAt, minIntervalMs) {
  if (!lastCompletedAt || minIntervalMs <= 0) return 0;
  return Math.max(0, minIntervalMs - (Date.now() - lastCompletedAt));
}
