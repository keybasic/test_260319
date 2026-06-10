/** GPT·학생 입력의 \( \), \[ \] → remark-math용 $, $$ */
export function normalizeMathDelimiters(text) {
  if (!text) return '';
  return text
    .replace(/\\\[((?:.|\n)*?)\\\]/g, (_, expr) => `$$${expr}$$`)
    .replace(/\\\(((?:.|\n)*?)\\\)/g, (_, expr) => `$${expr}$`);
}

const BARE_LATEX_PATTERNS = [
  /\\triangle(?:\s+[A-Za-z]+)?/g,
  /\\angle(?:\s+[A-Za-z]+)?/g,
  /\\equiv/g,
  /\\sim/g,
  /\\parallel/g,
  /\\perp/g,
  /\^\{\\circ\}/g,
  /\^\\circ/g,
];

/** $...$ 밖에 있는 기하 LaTeX 조각을 인라인 수식으로 감싼다 */
export function wrapBareLatexCommands(text) {
  if (!text) return '';
  const normalized = text.replace(
    /\\\\(triangle|angle|equiv|sim|parallel|perp)\b/g,
    '\\$1'
  );
  const segments = normalized.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/);

  return segments
    .map((segment, index) => {
      if (index % 2 === 1) return segment;
      let out = segment;
      for (const pattern of BARE_LATEX_PATTERNS) {
        out = out.replace(pattern, (match) => `$${match}$`);
      }
      return out;
    })
    .join('');
}

/** ReactMarkdown + KaTeX 렌더링 전 텍스트 정규화 */
export function prepareMathMarkdownText(text) {
  if (!text) return '';
  return wrapBareLatexCommands(normalizeMathDelimiters(text));
}
