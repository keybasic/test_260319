import { useNavigate } from 'react-router-dom';

/**
 * 홈 화면용 문제 카드
 * 클릭 시 해당 문제의 학생 풀이 화면으로 이동
 */
function ProblemCard({ problem }) {
  const navigate = useNavigate();
  const {
    id,
    title,
    emoji = '📘',
    description,
    proposition,
    imageDataUrl,
    difficulty = '기본',
    topic = '도형의 성질',
  } = problem;

  const difficultyColors = {
    기본: 'bg-emerald-100 text-emerald-700',
    중급: 'bg-amber-100 text-amber-700',
    심화: 'bg-rose-100 text-rose-700',
  };
  const color = difficultyColors[difficulty] || 'bg-slate-100 text-slate-600';

  return (
    <button
      type="button"
      onClick={() => navigate(`/workspace/${id}`)}
      className="w-full text-left rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow-md hover:bg-blue-50/30 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          {imageDataUrl ? (
            <img
              src={imageDataUrl}
              alt=""
              className="h-14 w-14 rounded-lg border border-slate-200 bg-white object-contain"
            />
          ) : (
            <span
              className="text-3xl shrink-0 rounded-lg bg-slate-100 p-2 inline-flex"
              aria-hidden
            >
              {emoji}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-slate-800 truncate">{title}</h3>
          <p className="mt-1 text-sm text-slate-600 line-clamp-2">
            {description || proposition || '문제 설명이 아직 입력되지 않았습니다.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}
            >
              {difficulty}
            </span>
            <span className="text-xs text-slate-500">{topic}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

export default ProblemCard;
