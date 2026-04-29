/**
 * 캔버스에 흰 배경 외의 필기(선, 도형 등)가 있는지 대략 판별.
 */
export function canvasHasNonWhiteDrawing(canvas) {
  if (!canvas || canvas.width < 2 || canvas.height < 2) return false;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  let imageData;
  try {
    imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  } catch {
    return false;
  }
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r < 252 || g < 252 || b < 252) return true;
  }
  return false;
}

function inputModeLabel(mode) {
  if (mode === 'verbal') return '말하기·텍스트 / 수식';
  if (mode === 'draw') return '디지털 판서(캔버스)';
  if (mode === 'photo') return '풀이 사진';
  return String(mode || '—');
}

/**
 * API에 넣을 "학생이 실제로 남긴 것"만 기술한 문맥 문자열.
 * 문제 명제·조건을 서술하지 않는다.
 */
export function buildStudentWorkDescriptor({
  inputMode,
  draft = '',
  mathLatex = '',
  chatMessages = [],
  photoDataUrl = '',
  canvasHasInk = false,
  canvasPageCount = 0,
}) {
  const lines = [];
  lines.push(`【선택한 입력 방식】 ${inputModeLabel(inputMode)}`);
  lines.push('');

  if (inputMode === 'verbal') {
    lines.push(
      `· 말하기·텍스트: ${draft.trim() || '(입력 없음)'}`
    );
    lines.push(
      `· 수식(LaTeX): ${mathLatex.trim() || '(입력 없음)'}`
    );
  } else if (inputMode === 'draw') {
    lines.push(
      `· 캔버스 필기: ${
        canvasHasInk
          ? `필기(선·도형 등) 있음 (공간 ${canvasPageCount}개)`
          : '비어 있음 또는 눈에 띄는 필기 없음'
      }`
    );
    lines.push(
      '· (캔버스 모드에서 말하기/수식 칸에 쓴 내용이 있으면 아래에 별도 표시)'
    );
    if (draft.trim() || mathLatex.trim()) {
      if (draft.trim()) lines.push(`  - 추가 텍스트: ${draft.trim()}`);
      if (mathLatex.trim()) lines.push(`  - 추가 수식: ${mathLatex.trim()}`);
    }
  } else if (inputMode === 'photo') {
    lines.push(
      `· 풀이 사진: ${photoDataUrl ? '이미지 업로드됨(별도 시각 분석됨)' : '(아직 없음)'}`
    );
  }

  lines.push('');
  const userUtterances = (chatMessages || [])
    .filter((m) => m.role === 'user' && m.id !== 'welcome')
    .map((m) => (m.text || '').trim())
    .filter(Boolean);

  lines.push('【AI 대화창에 학생이 직접 입력한 문장·질문】');
  if (userUtterances.length === 0) {
    lines.push('(없음)');
  } else {
    userUtterances.forEach((t, i) => {
      lines.push(`${i + 1}. ${t}`);
    });
  }

  lines.push('');
  lines.push(
    '※ 위에 적히지 않은 증명 단계·결론·조건은 학생이 텍스트로 제시한 것이 아니다. 문제 본문의 명제나 조건을 학생의 풀이로 요약하거나 옮기지 마라.'
  );

  return lines.join('\n');
}
