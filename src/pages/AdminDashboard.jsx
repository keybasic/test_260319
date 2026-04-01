import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Image as ImageIcon,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

import Button from '../components/Button';

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function emptyForm() {
  return {
    title: '',
    imageFileName: '',
    proposition: '',
    allowedMethods: {
      verbal: true,
      draw: true,
      photo: false,
    },
    rubric: {
      positiveKeywords: [],
      misconceptionKeywords: [],
      counterexampleImageFileName: '',
      hintQuestion: '',
    },
    steps: [
      {
        id: createId('step'),
        logicKeyword: '',
        points: '',
      },
    ],
  };
}

function normalizeTagValue(v) {
  return v.trim().replace(/\s+/g, ' ');
}

function AdminDashboard() {
  const navigate = useNavigate();

  const [problems, setProblems] = useState(() => [
    {
      id: 1,
      title: '이등변삼각형 밑각의 성질',
      imageFileName: 'isosceles-triangle.png',
      proposition:
        '△ABC가 AB = AC인 이등변삼각형일 때, ∠B = ∠C임을 설명하시오.',
      allowedMethods: { verbal: true, draw: true, photo: false },
      rubric: {
        positiveKeywords: ['엇각', '밑각', '대칭'],
        misconceptionKeywords: ['두 변만 같다고 함'],
        counterexampleImageFileName: 'counterexample_1.png',
        hintQuestion:
          '밑각을 비교할 때, 꼭짓점에서 어떤 선을 생각해볼 수 있을까요?',
      },
      steps: [
        { id: 's1', logicKeyword: '대칭축/보조선 설정', points: 3 },
        { id: 's2', logicKeyword: '밑각의 일치 이유 설명', points: 5 },
        { id: 's3', logicKeyword: '결론 도출(∠B=∠C)', points: 2 },
      ],
    },
    {
      id: 2,
      title: '평행사변형 대각선의 성질',
      imageFileName: 'parallelogram-diagonals.png',
      proposition:
        '평행사변형 ABCD에서 대각선 AC와 BD가 만나는 점을 O라 할 때, AO = CO, BO = DO임을 설명하시오.',
      allowedMethods: { verbal: true, draw: true, photo: true },
      rubric: {
        positiveKeywords: ['대각선', '이등분', '대응'],
        misconceptionKeywords: ['한 변이 평행이면 됨'],
        counterexampleImageFileName: 'counterexample_2.png',
        hintQuestion:
          '대각선들이 서로를 어떻게 나누는지, 만나는 점 O를 중심으로 생각해볼까요?',
      },
      steps: [
        { id: 's1', logicKeyword: '대각선이 만나는 점 O 설정', points: 2 },
        { id: 's2', logicKeyword: '서로 이등분함을 근거로 제시', points: 6 },
        { id: 's3', logicKeyword: '거리/길이 관계 결론', points: 2 },
      ],
    },
    {
      id: 3,
      title: '직각삼각형의 합동 조건',
      imageFileName: 'right-triangle-congruence.png',
      proposition:
        '빗변의 길이와 한 예각의 크기가 같은 두 직각삼각형은 합동임을 설명하시오.',
      allowedMethods: { verbal: true, draw: true, photo: false },
      rubric: {
        positiveKeywords: ['합동', '예각', '빗변'],
        misconceptionKeywords: ['변 하나만 같음'],
        counterexampleImageFileName: 'counterexample_3.png',
        hintQuestion:
          '빗변과 예각이 같다면, 나머지 요소(다른 각/변)는 어떻게 결정될까요?',
      },
      steps: [
        { id: 's1', logicKeyword: '빗변과 예각 조건 제시', points: 3 },
        { id: 's2', logicKeyword: '나머지 한 변/각의 결정', points: 6 },
        { id: 's3', logicKeyword: '합동 결론(대응 관계)', points: 1 },
      ],
    },
  ]);

  const [selectedProblem, setSelectedProblem] = useState(null);
  const [form, setForm] = useState(() => emptyForm());

  // Tag 입력 전용 상태
  const [positiveTagDraft, setPositiveTagDraft] = useState('');
  const [misconceptionTagDraft, setMisconceptionTagDraft] = useState('');

  // 이미지 업로드 placeholder용 입력값
  const fileInputRef = useRef(null);
  const counterexampleInputRef = useRef(null);

  const canEdit = useMemo(() => selectedProblem !== null, [selectedProblem]);

  const resetFormForNew = () => {
    setSelectedProblem(null);
    setForm(emptyForm());
    setPositiveTagDraft('');
    setMisconceptionTagDraft('');
  };

  const loadFormFromProblem = (p) => {
    setSelectedProblem(p);
    setForm({
      title: p.title || '',
      imageFileName: p.imageFileName || '',
      proposition: p.proposition || '',
      allowedMethods: p.allowedMethods || {
        verbal: true,
        draw: true,
        photo: false,
      },
      rubric: {
        positiveKeywords: p.rubric?.positiveKeywords || [],
        misconceptionKeywords: p.rubric?.misconceptionKeywords || [],
        counterexampleImageFileName: p.rubric?.counterexampleImageFileName || '',
        hintQuestion: p.rubric?.hintQuestion || '',
      },
      steps:
        p.steps?.length
          ? p.steps.map((s) => ({
              id: s.id ?? createId('step'),
              logicKeyword: s.logicKeyword ?? '',
              points: String(s.points ?? ''),
            }))
          : emptyForm().steps,
    });
    setPositiveTagDraft('');
    setMisconceptionTagDraft('');
  };

  useEffect(() => {
    // 처음 진입 시 첫 문제를 보여주지 않고 "새 문제 만들기" 상태로 둡니다.
  }, []);

  const addTag = (type) => {
    const raw =
      type === 'positive' ? positiveTagDraft : misconceptionTagDraft;
    const normalized = normalizeTagValue(raw);
    if (!normalized) return;

    setForm((prev) => {
      const next = { ...prev };
      if (type === 'positive') {
        if (next.rubric.positiveKeywords.includes(normalized)) return prev;
        next.rubric = {
          ...next.rubric,
          positiveKeywords: [...next.rubric.positiveKeywords, normalized],
        };
      } else {
        if (next.rubric.misconceptionKeywords.includes(normalized))
          return prev;
        next.rubric = {
          ...next.rubric,
          misconceptionKeywords: [
            ...next.rubric.misconceptionKeywords,
            normalized,
          ],
        };
      }
      return next;
    });

    if (type === 'positive') setPositiveTagDraft('');
    else setMisconceptionTagDraft('');
  };

  const removeTag = (type, tag) => {
    setForm((prev) => {
      const next = { ...prev };
      next.rubric = { ...next.rubric };
      if (type === 'positive') {
        next.rubric.positiveKeywords = next.rubric.positiveKeywords.filter(
          (t) => t !== tag
        );
      } else {
        next.rubric.misconceptionKeywords =
          next.rubric.misconceptionKeywords.filter((t) => t !== tag);
      }
      return next;
    });
  };

  const addStep = () => {
    setForm((prev) => ({
      ...prev,
      steps: [
        ...prev.steps,
        { id: createId('step'), logicKeyword: '', points: '' },
      ],
    }));
  };

  const removeStep = (stepId) => {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.filter((s) => s.id !== stepId),
    }));
  };

  const updateStep = (stepId, patch) => {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)),
    }));
  };

  const handleSave = () => {
    const payload = {
      ...form,
      steps: form.steps.map((s, idx) => ({
        id: s.id ?? `step-${idx + 1}`,
        logicKeyword: s.logicKeyword,
        points: Number(s.points || 0),
      })),
    };

    if (!selectedProblem) {
      const nextId =
        problems.reduce((acc, p) => Math.max(acc, p.id), 0) + 1;
      const created = { id: nextId, ...payload };
      setProblems((prev) => [created, ...prev]);
      loadFormFromProblem(created);
      return;
    }

    setProblems((prev) =>
      prev.map((p) => (p.id === selectedProblem.id ? { ...p, ...payload } : p))
    );

    setSelectedProblem((prev) => {
      if (!prev) return prev;
      return { ...prev, ...payload };
    });
  };

  const handleDelete = () => {
    if (!selectedProblem) return;
    const ok = window.confirm('정말로 이 문제를 삭제할까요?');
    if (!ok) return;

    setProblems((prev) => prev.filter((p) => p.id !== selectedProblem.id));
    resetFormForNew();
  };

  const problemsSorted = useMemo(() => {
    return [...problems].sort((a, b) => b.id - a.id);
  }, [problems]);

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar: 25% */}
      <aside className="w-1/4 shrink-0 border-r border-slate-200 bg-white">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="홈으로"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="inline-flex items-center gap-2">
              <span className="text-lg" aria-hidden>
                🧭
              </span>
              <span className="text-sm font-semibold text-slate-800">
                관리자 모드
              </span>
            </span>
          </div>

          <h1 className="mt-2 text-base font-bold text-slate-900">
            2학년 도형의 성질 정당화 연습 - 관리자 모드
          </h1>

          <Button
            variant="primary"
            size="md"
            className="mt-4 w-full"
            leftIcon={Plus}
            onClick={resetFormForNew}
          >
            + 새 문제 만들기
          </Button>
        </div>

        <div className="h-[calc(100vh-160px)] overflow-y-auto p-3">
          <p className="px-1 text-xs font-medium text-slate-500">
            배포된 문제 목록
          </p>
          <div className="mt-3 space-y-2">
            {problemsSorted.map((p) => {
              const isActive = selectedProblem?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => loadFormFromProblem(p)}
                  className={[
                    'w-full rounded-xl border px-4 py-3 text-left transition-colors',
                    isActive
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="block min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
                      {p.title}
                    </span>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                      {p.id}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500 line-clamp-1">
                    {p.proposition}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Main: 75% */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                {selectedProblem ? '기존 문제 수정' : '새 문제 배포하기'}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                문제 제목, 도형 이미지, 풀이 방식, AI 튜터 루브릭과 논리 위계를
                설정하세요.
              </p>
            </div>
            {selectedProblem && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={handleDelete}
                  className="text-sm font-semibold text-red-600 hover:text-red-700"
                >
                  이 문제 삭제하기
                </button>
              </div>
            )}
          </div>

          <div className="mt-8 space-y-6">
            {/* Section A */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">
                섹션 A: 기본 문제 설정
              </h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="md:col-span-1">
                  <label className="block text-sm font-medium text-slate-700">
                    문제 제목
                  </label>
                  <input
                    value={form.title}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, title: e.target.value }))
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="예: 이등변삼각형 밑각의 성질"
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm font-medium text-slate-700">
                    도형 이미지 업로드
                  </label>
                  <div className="mt-1.5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setForm((prev) => ({
                          ...prev,
                          imageFileName: file.name,
                        }));
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-blue-400 hover:bg-blue-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <Upload className="h-4 w-4" />
                      이미지 업로드
                    </button>
                    {form.imageFileName && (
                      <p className="mt-2 text-xs text-slate-500">
                        선택됨: {form.imageFileName}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700">
                  증명할 명제 (Textarea)
                </label>
                <textarea
                  value={form.proposition}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, proposition: e.target.value }))
                  }
                  placeholder="예: △ABC가 AB = AC인 이등변삼각형일 때, ∠B = ∠C임을 설명하시오."
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  rows={4}
                />
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700">
                  허용할 입력 방식
                </label>
                <div className="mt-2 flex flex-wrap gap-4">
                  {[
                    { key: 'verbal', label: '말로 설명하기' },
                    { key: 'draw', label: '화면에 풀기' },
                    { key: 'photo', label: '풀이 촬영하기' },
                  ].map((m) => (
                    <label
                      key={m.key}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 cursor-pointer hover:bg-white"
                    >
                      <input
                        type="checkbox"
                        checked={form.allowedMethods[m.key]}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            allowedMethods: {
                              ...prev.allowedMethods,
                              [m.key]: e.target.checked,
                            },
                          }))
                        }
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </section>

            {/* Section B */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">
                섹션 B: AI 튜터 루브릭 설정
              </h3>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    긍정적 피드백 키워드 (태그)
                  </label>
                  <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-wrap gap-2">
                      {form.rubric.positiveKeywords.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800"
                        >
                          {t}
                          <button
                            type="button"
                            onClick={() => removeTag('positive', t)}
                            className="rounded-full p-1 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            aria-label={`${t} 삭제`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        value={positiveTagDraft}
                        onChange={(e) => setPositiveTagDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addTag('positive');
                          }
                        }}
                        placeholder="키워드 입력 후 Enter"
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={Plus}
                        onClick={() => addTag('positive')}
                      >
                        추가
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    오개념/오류 탐지 키워드 (태그)
                  </label>
                  <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-wrap gap-2">
                      {form.rubric.misconceptionKeywords.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700"
                        >
                          {t}
                          <button
                            type="button"
                            onClick={() => removeTag('misconception', t)}
                            className="rounded-full p-1 hover:bg-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                            aria-label={`${t} 삭제`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        value={misconceptionTagDraft}
                        onChange={(e) => setMisconceptionTagDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addTag('misconception');
                          }
                        }}
                        placeholder="키워드 입력 후 Enter"
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={Plus}
                        onClick={() => addTag('misconception')}
                      >
                        추가
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    반례 이미지/자료 (placeholder UI)
                  </label>
                  <div className="mt-1.5">
                    <input
                      ref={counterexampleInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setForm((prev) => ({
                          ...prev,
                          rubric: {
                            ...prev.rubric,
                            counterexampleImageFileName: file.name,
                          },
                        }));
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => counterexampleInputRef.current?.click()}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-blue-400 hover:bg-blue-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <ImageIcon className="h-4 w-4" />
                      반례 이미지 첨부
                    </button>
                    {form.rubric.counterexampleImageFileName && (
                      <p className="mt-2 text-xs text-slate-500">
                        선택됨: {form.rubric.counterexampleImageFileName}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    힌트 질문 (텍스트)
                  </label>
                  <textarea
                    value={form.rubric.hintQuestion}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        rubric: { ...prev.rubric, hintQuestion: e.target.value },
                      }))
                    }
                    placeholder="예: 대각선의 길이를 비교하려면 어떤 선이 필요할까요?"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    rows={3}
                  />
                </div>
              </div>
            </section>

            {/* Section C */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">
                섹션 C: 논리 위계 및 단계별 배점 설정
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                순서가 중요한 증명 단계를 Step 1, Step 2...로 추가/삭제하고,
                각 단계의 배점을 설정하세요.
              </p>

              <div className="mt-5 space-y-4">
                {form.steps.map((s, idx) => (
                  <div
                    key={s.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-800">
                          Step {idx + 1}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          핵심 논리/키워드와 배점을 입력하세요.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeStep(s.id)}
                        className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-600 hover:bg-white hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        aria-label="Step 삭제"
                        disabled={form.steps.length <= 1}
                      >
                        <span className="inline-flex items-center gap-2">
                          <Trash2 className="h-4 w-4" />
                          삭제
                        </span>
                      </button>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-5">
                      <div className="md:col-span-4">
                        <label className="block text-xs font-medium text-slate-700">
                          단계 핵심 논리/키워드
                        </label>
                        <input
                          value={s.logicKeyword}
                          onChange={(e) =>
                            updateStep(s.id, { logicKeyword: e.target.value })
                          }
                          placeholder="예: 평행선의 엇각 성질 언급"
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                      <div className="md:col-span-1">
                        <label className="block text-xs font-medium text-slate-700">
                          배점 (점)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={s.points}
                          onChange={(e) =>
                            updateStep(s.id, { points: e.target.value })
                          }
                          placeholder="0"
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex justify-end">
                  <Button
                    variant="secondary"
                    size="md"
                    leftIcon={Plus}
                    onClick={addStep}
                  >
                    Step 추가
                  </Button>
                </div>
              </div>
            </section>

            {/* Section D */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col">
                  <p className="text-sm font-semibold text-slate-900">
                    {canEdit ? '수정 내용을 저장' : '새 문제를 배포'}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    (더미 동작) 실제 서버 저장 없이 UI 상태만 갱신됩니다.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="text-sm font-semibold text-red-600 hover:text-red-700"
                    >
                      이 문제 삭제하기
                    </button>
                  )}
                  <Button
                    variant="primary"
                    size="lg"
                    leftIcon={Save}
                    onClick={handleSave}
                  >
                    {canEdit ? '수정 내용 저장하기' : '새 문제 배포하기'}
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

export default AdminDashboard;
