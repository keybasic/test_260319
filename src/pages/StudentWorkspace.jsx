import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, PenTool, Camera } from 'lucide-react';
import Button from '../components/Button';
import {
  getProblemById,
  solutionMethods,
  aiChatMessages,
} from '../data/mockData';

function StudentWorkspace() {
  const { problemId } = useParams();
  const navigate = useNavigate();
  const problem = getProblemById(problemId);

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      {/* 상단 바: 뒤로가기 */}
      <header className="flex shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-4 py-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="홈으로"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm font-medium">목록으로</span>
        </button>
        <h1 className="text-lg font-semibold text-slate-800 truncate">
          {problem.title}
        </h1>
      </header>

      {/* 좌우 2분할 */}
      <div className="flex flex-1 min-h-0">
        {/* 왼쪽: 문제 및 풀이 입력 */}
        <section className="flex w-1/2 flex-col border-r border-slate-200 bg-white overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
              <span aria-hidden>{problem.emoji}</span>
              {problem.title}
            </h2>
            <div className="mt-4 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center aspect-video text-slate-400">
              <span className="text-sm">도형 이미지 영역 (Placeholder)</span>
            </div>
            <p className="mt-4 rounded-lg bg-blue-50 p-4 text-slate-700 border border-blue-100">
              <strong className="text-blue-800">문제 명제:</strong>{' '}
              {problem.proposition}
            </p>
          </div>
          <div className="shrink-0 border-t border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-sm font-medium text-slate-700">
              풀이 방법을 선택하세요
            </p>
            <div className="flex flex-wrap gap-3">
              {solutionMethods.map((method) => {
                const Icon =
                  method.id === 'verbal'
                    ? MessageCircle
                    : method.id === 'draw'
                      ? PenTool
                      : Camera;
                return (
                  <Button
                    key={method.id}
                    variant={method.enabled ? 'primary' : 'secondary'}
                    size="md"
                    disabled={!method.enabled}
                    leftIcon={Icon}
                    className={
                      !method.enabled
                        ? 'opacity-60 cursor-not-allowed line-through'
                        : ''
                    }
                  >
                    {method.emoji} {method.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </section>

        {/* 오른쪽: AI 튜터 피드백 (채팅) */}
        <section className="flex w-1/2 flex-col bg-slate-50">
          <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <span aria-hidden>🤖</span>
              AI 튜터 피드백
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              풀이 과정에 맞춰 실시간으로 도와드려요.
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {aiChatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    msg.role === 'ai'
                      ? 'bg-white border border-slate-200 shadow-sm text-slate-700'
                      : 'bg-blue-600 text-white'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                  {msg.hasImage && (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-100 aspect-video flex items-center justify-center text-slate-400 text-xs">
                      반례 이미지 (Placeholder)
                    </div>
                  )}
                  <span className="block mt-1 text-xs opacity-70">
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default StudentWorkspace;
