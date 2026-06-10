import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { prepareMathMarkdownText } from '../lib/mathMarkdown';

/**
 * 화면·PDF 공용 — KaTeX 수식이 포함된 마크다운 렌더
 */
export default function MathMarkdown({
  children,
  className = '',
  emptyLabel = null,
  inline = false,
}) {
  const prepared = prepareMathMarkdownText(
    typeof children === 'string' ? children : ''
  );

  if (!prepared.trim()) {
    return emptyLabel ? (
      <span className={className}>{emptyLabel}</span>
    ) : null;
  }

  const Tag = inline ? 'span' : 'div';

  return (
    <Tag
      className={`prose prose-sm max-w-none break-words whitespace-pre-wrap ${className}`}
    >
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {prepared}
      </ReactMarkdown>
    </Tag>
  );
}
