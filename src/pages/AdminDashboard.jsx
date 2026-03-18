import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Settings,
  LayoutDashboard,
  Upload,
  Plus,
  X,
} from 'lucide-react';
import Button from '../components/Button';
import { adminStats } from '../data/mockData';

const SIDEBAR_TABS = [
  { id: 'problems', label: '문제 설정', icon: Settings },
  { id: 'dashboard', label: '대시보드', icon: LayoutDashboard },
];

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('problems');
  const [keywords, setKeywords] = useState(['합동', '보조선', '이등변삼각형']);
  const [newKeyword, setNewKeyword] = useState('');
  const navigate = useNavigate();

  const addKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      setKeywords([...keywords, newKeyword.trim()]);
      setNewKeyword('');
    }
  };

  const removeKeyword = (k) => {
    setKeywords(keywords.filter((x) => x !== k));
  };

  return (
    <div className="flex h-screen bg-slate-50">
      {/* 사이드바 */}
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white">
        <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="홈으로"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="font-semibold text-slate-800">관리자</span>
        </div>
        <nav className="p-2">
          {SIDEBAR_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-800'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'dashboard' && (
          <div className="p-8">
            <h1 className="text-2xl font-bold text-slate-800">📊 대시보드</h1>
            <p className="mt-1 text-slate-600">
              문제별 제출 현황과 통계를 확인하세요.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">등록된 문제 수</p>
                <p className="mt-1 text-2xl font-bold text-blue-600">
                  {adminStats.totalProblems}개
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">총 풀이 시도</p>
                <p className="mt-1 text-2xl font-bold text-slate-800">
                  {adminStats.totalAttempts}회
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">평균 완료율</p>
                <p className="mt-1 text-2xl font-bold text-emerald-600">
                  {adminStats.avgCompletionRate}%
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'problems' && (
          <div className="p-8 max-w-3xl">
            <h1 className="text-2xl font-bold text-slate-800">
              ⚙️ 문제 설정
            </h1>
            <p className="mt-1 text-slate-600">
              문제 명제, 도형 이미지, 풀이법, 평가 루브릭을 설정하세요.
            </p>

            <div className="mt-8 space-y-6">
              {/* 문제 명제 */}
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  문제 명제
                </label>
                <textarea
                  placeholder="예: 이등변삼각형에서 밑각이 같음을 설명하시오."
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  rows={3}
                  defaultValue="△ABC가 AB = AC인 이등변삼각형일 때, ∠B = ∠C임을 설명하시오."
                />
              </div>

              {/* 도형 이미지 업로드 */}
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  도형 이미지
                </label>
                <button
                  type="button"
                  className="mt-1.5 flex items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-slate-600 hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
                >
                  <Upload className="h-5 w-5" />
                  이미지 업로드
                </button>
              </div>

              {/* 풀이법 활성화 체크박스 */}
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  풀이법 활성화 (중복 선택 가능)
                </label>
                <div className="mt-2 flex flex-wrap gap-4">
                  {['말로 설명하기', '화면에 풀기', '풀이 촬영하기'].map(
                    (label) => (
                      <label
                        key={label}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          defaultChecked={label !== '풀이 촬영하기'}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-slate-700">{label}</span>
                      </label>
                    )
                  )}
                </div>
              </div>

              {/* 평가 루브릭: 필수 키워드 */}
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  필수 키워드 (태그)
                </label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {keywords.map((k) => (
                    <span
                      key={k}
                      className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800"
                    >
                      {k}
                      <button
                        type="button"
                        onClick={() => removeKeyword(k)}
                        className="rounded-full p-0.5 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label={`${k} 제거`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                      placeholder="키워드 입력 후 Enter"
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <Button variant="secondary" size="sm" onClick={addKeyword}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* 논리 위계 순서 */}
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  논리 위계 순서
                </label>
                <p className="mt-1 text-xs text-slate-500">
                  단계별로 설명해야 할 논리 순서를 설정하세요.
                </p>
                <textarea
                  placeholder="1. 보조선 설정\n2. 합동 조건 설명\n3. 대응각의 크기"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  rows={4}
                />
              </div>

              {/* 오개념 반례 자료 */}
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  오개념 탐지 시 반례 자료
                </label>
                <p className="mt-1 text-xs text-slate-500">
                  특정 오개념이 감지되면 보여줄 반례 이미지/설명을 설정하세요.
                </p>
                <div className="mt-2 space-y-2">
                  <input
                    type="text"
                    placeholder="오개념 설명 (예: 두 변만 같다고 생각하는 경우)"
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-2 text-sm text-slate-600 hover:border-blue-400 hover:bg-blue-50/50"
                  >
                    <Upload className="h-4 w-4" />
                    반례 이미지 첨부
                  </button>
                </div>
              </div>

              <div className="pt-4">
                <Button variant="primary" size="lg">
                  저장하기
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default AdminDashboard;
