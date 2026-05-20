import { useRef } from 'react';

/** 중2 도형 정당화에서 자주 쓰는 기호 (설명 칸에 바로 보이는 문자) */
export const GEOMETRY_SYMBOLS = [
  { label: '△ 삼각형', display: '△', value: '△' },
  { label: '∠ 각', display: '∠', value: '∠' },
  { label: '≡ 합동', display: '≡', value: '≡' },
  { label: '∽ 닮음', display: '∽', value: '∽' },
  { label: '∥ 평행', display: '∥', value: '∥' },
  { label: '⊥ 수직', display: '⊥', value: '⊥' },
  { label: '° 도', display: '°', value: '°' },
];

export function insertTextAtSelection(inputEl, value, insertText, onChange) {
  const start = inputEl?.selectionStart ?? value.length;
  const end = inputEl?.selectionEnd ?? value.length;
  const newValue = value.substring(0, start) + insertText + value.substring(end);
  onChange(newValue);
  const nextPos = start + insertText.length;
  requestAnimationFrame(() => {
    if (!inputEl) return;
    inputEl.focus();
    inputEl.setSelectionRange(nextPos, nextPos);
  });
  return newValue;
}

export function GeometrySymbolToolbar({ inputRef, value, onChange, className = '' }) {
  const insertSymbol = (symbol) => {
    insertTextAtSelection(inputRef.current, value, symbol, onChange);
  };

  return (
    <div
      className={`flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50/80 p-2 ${className}`}
      role="toolbar"
      aria-label="기하 기호"
    >
      {GEOMETRY_SYMBOLS.map((sym) => (
        <button
          key={sym.value}
          type="button"
          title={sym.label}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insertSymbol(sym.value)}
          className="min-w-[2.25rem] px-2 py-1.5 text-sm font-semibold bg-white border border-slate-300 rounded-md shadow-sm text-slate-800 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          {sym.display}
        </button>
      ))}
    </div>
  );
}

/**
 * 중2 기하용 미니 툴바 + 설명 입력칸 (음성 텍스트 수정·기호 삽입)
 */
export default function GeometrySymbolInput({
  value,
  onChange,
  placeholder = '말로 설명한 내용을 적거나, 음성 녹음으로 입력하세요...',
  label = '정당화 설명',
  hint = '△ ∠ ≡ 등 버튼을 누르면 커서 위치(또는 선택한 글자)에 기호가 들어갑니다.',
  className = '',
  textareaClassName = '',
  highlightRecording = false,
}) {
  const inputRef = useRef(null);

  return (
    <div
      className={`flex min-h-[280px] flex-col rounded-xl border bg-white p-3 shadow-sm ${
        highlightRecording
          ? 'border-blue-500 ring-2 ring-blue-400/40 animate-pulse'
          : 'border-slate-200'
      } ${className}`}
    >
      {label ? (
        <p className="text-xs font-medium text-slate-600 mb-2">{label}</p>
      ) : null}

      <GeometrySymbolToolbar
        inputRef={inputRef}
        value={value}
        onChange={onChange}
        className="mb-2"
      />

      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck
        className={`flex-1 min-h-[220px] resize-none rounded-lg border border-slate-300 bg-slate-50/70 px-3 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 ${textareaClassName}`}
      />

      {hint ? (
        <p className="text-xs text-slate-400 mt-1.5">{hint}</p>
      ) : null}
    </div>
  );
}
