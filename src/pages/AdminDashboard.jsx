import { useMemo, useRef, useState } from 'react';
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
import { useProblems } from '../context/ProblemsContext';
import { getExpectedAdminPassword, setAdminPassword } from '../lib/adminAuth';

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function emptyForm() {
  return {
    title: '',
    imageFileName: '',
    imageDataUrl: '',
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
      counterexampleImageDataUrl: '',
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

// 이미지 리사이즈 (최대 maxSize px) 후 dataURL 반환
function resizeImageToDataUrl(file, maxSize = 1024) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('이미지를 읽는 중 오류가 발생했습니다.'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const { width, height } = img;
        const scale = Math.min(1, maxSize / Math.max(width, height) || 1);
        const targetW = Math.max(1, Math.round(width * scale));
        const targetH = Math.max(1, Math.round(height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result);
          return;
        }
        ctx.clearRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);
        try {
          const dataUrl = canvas.toDataURL('image/png', 0.9);
          resolve(dataUrl);
        } catch {
          resolve(reader.result);
        }
      };
      img.onerror = () =>
        reject(new Error('이미지 포맷을 해석할 수 없습니다.'));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function getRecommendedTemplateByProposition(title, proposition) {
  const source = `${title} ${proposition}`.toLowerCase();

  if (source.includes('이등변삼각형') || source.includes('밑각')) {
    return {
      emoji: '△',
      topic: '이등변삼각형',
      difficulty: '기본',
      positiveKeywords: ['밑각', '합동', '대칭'],
      misconceptionKeywords: ['두 변만 같다고 단정', '밑변 기준 혼동'],
      hintQuestion: '밑각이 같음을 보이려면 어떤 보조선을 그으면 좋을까요?',
      steps: [
        { id: createId('step'), logicKeyword: '보조선 또는 대칭축 설정', points: 3 },
        { id: createId('step'), logicKeyword: '각의 대응 관계 설명', points: 4 },
        { id: createId('step'), logicKeyword: '∠B = ∠C 결론', points: 3 },
      ],
    };
  }

  if (source.includes('평행사변형') || source.includes('대각선')) {
    return {
      emoji: '◇',
      topic: '평행사변형',
      difficulty: '중급',
      positiveKeywords: ['대각선', '이등분', '교점'],
      misconceptionKeywords: ['대각선 길이 항상 동일', '조건 누락'],
      hintQuestion:
        '대각선의 교점 O를 두고, AO와 CO, BO와 DO 관계를 어떻게 설명할 수 있을까요?',
      steps: [
        { id: createId('step'), logicKeyword: '교점 O 설정', points: 2 },
        { id: createId('step'), logicKeyword: '이등분 성질 제시', points: 5 },
        { id: createId('step'), logicKeyword: '길이 관계 결론', points: 3 },
      ],
    };
  }

  if (source.includes('합동') || source.includes('직각삼각형')) {
    return {
      emoji: '▷',
      topic: '삼각형의 합동',
      difficulty: '중급',
      positiveKeywords: ['합동', '대응', '조건'],
      misconceptionKeywords: ['조건 일부만 사용', '대응 순서 오류'],
      hintQuestion:
        '주어진 합동 조건으로 어떤 대응 관계를 먼저 정리하면 좋을까요?',
      steps: [
        { id: createId('step'), logicKeyword: '주어진 조건 나열', points: 3 },
        { id: createId('step'), logicKeyword: '대응 관계 및 합동 성립', points: 5 },
        { id: createId('step'), logicKeyword: '최종 결론 도출', points: 2 },
      ],
    };
  }

  return {
    emoji: '📐',
    topic: '도형의 성질',
    difficulty: '기본',
    positiveKeywords: ['조건 정리', '논리 전개'],
    misconceptionKeywords: ['근거 없이 결론 도출'],
    hintQuestion: '주어진 조건에서 가장 먼저 확인할 성질은 무엇일까요?',
    steps: [
      { id: createId('step'), logicKeyword: '조건 정리', points: 3 },
      { id: createId('step'), logicKeyword: '성질 적용', points: 4 },
      { id: createId('step'), logicKeyword: '결론 정당화', points: 3 },
    ],
  };
}

function AdminDashboard() {
  const navigate = useNavigate();
  const { problems, isLoading, addProblem, updateProblem, deleteProblem } = useProblems();

  const [selectedProblem, setSelectedProblem] = useState(null);
  const [form, setForm] = useState(() => emptyForm());
  const [activeMenu, setActiveMenu] = useState(null);

  // Tag 입력 전용 상태
  const [positiveTagDraft, setPositiveTagDraft] = useState('');
  const [misconceptionTagDraft, setMisconceptionTagDraft] = useState('');
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [nextPasswordInput, setNextPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
      imageDataUrl: p.imageDataUrl || '',
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
        counterexampleImageDataUrl:
          p.rubric?.counterexampleImageDataUrl || '',
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

  const applyRecommendedDefaults = () => {
    const rec = getRecommendedTemplateByProposition(form.title, form.proposition);
    setForm((prev) => ({
      ...prev,
      rubric: {
        ...prev.rubric,
        positiveKeywords: rec.positiveKeywords,
        misconceptionKeywords: rec.misconceptionKeywords,
        hintQuestion: prev.rubric.hintQuestion || rec.hintQuestion,
      },
      steps: rec.steps,
    }));
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

  const handleSave = async () => {
    const rec = getRecommendedTemplateByProposition(form.title, form.proposition);
    const payload = {
      ...form,
      emoji: selectedProblem?.emoji || rec.emoji,
      topic: selectedProblem?.topic || rec.topic,
      difficulty: selectedProblem?.difficulty || rec.difficulty,
      description:
        selectedProblem?.description ||
        form.proposition?.slice(0, 80) ||
        `${form.title || '문제'} 정당화 연습`,
      steps: form.steps.map((s, idx) => ({
        id: s.id ?? `step-${idx + 1}`,
        logicKeyword: s.logicKeyword,
        points: Number(s.points || 0),
      })),
    };

    setIsSaving(true);
    try {
      if (!selectedProblem) {
        const created = { id: `prob-${Date.now()}`, ...payload };
        await addProblem(created);
        loadFormFromProblem(created);
        window.alert('새 문제가 성공적으로 배포되었습니다.');
        return;
      }

      await updateProblem(selectedProblem.id, payload);
      setSelectedProblem((prev) => {
        if (!prev) return prev;
        return { ...prev, ...payload };
      });
      window.alert('수정 내용이 성공적으로 저장되었습니다.');
    } catch (error) {
      window.alert(error?.message || '저장 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedProblem) return;
    const ok = window.confirm('정말로 이 문제를 삭제할까요?');
    if (!ok) return;
    setIsDeleting(true);
    try {
      await deleteProblem(selectedProblem.id);
      resetFormForNew();
    } catch (error) {
      window.alert(error?.message || '삭제 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleChangeAdminPassword = () => {
    const expected = getExpectedAdminPassword();
    if (currentPasswordInput.trim() !== expected) {
      window.alert('현재 비밀번호가 올바르지 않습니다.');
      return;
    }
    if (!nextPasswordInput.trim() || nextPasswordInput.trim().length < 4) {
      window.alert('새 비밀번호는 4자 이상 입력해 주세요.');
      return;
    }
    if (nextPasswordInput !== confirmPasswordInput) {
      window.alert('새 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    const ok = setAdminPassword(nextPasswordInput);
    if (!ok) {
      window.alert('비밀번호를 저장하지 못했습니다. 다시 시도해 주세요.');
      return;
    }

    setCurrentPasswordInput('');
    setNextPasswordInput('');
    setConfirmPasswordInput('');
    window.alert('관리자 비밀번호가 변경되었습니다. 다음 로그인부터 적용됩니다.');
  };

  const problemsSorted = useMemo(() => [...problems], [problems]);

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

          <div className="mt-3 grid gap-2">
            <button
              type="button"
              onClick={() => setActiveMenu('problems')}
              className={`w-full rounded-lg px-3 py-2 text-sm font-semibold ${
                activeMenu === 'problems'
                  ? 'bg-blue-600 text-white'
                  : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              문제 설정
            </button>
            <button
              type="button"
              onClick={() => setActiveMenu('password')}
              className={`w-full rounded-lg px-3 py-2 text-sm font-semibold ${
                activeMenu === 'password'
                  ? 'bg-blue-600 text-white'
                  : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              비밀번호 설정
            </button>
          </div>

        </div>

        {activeMenu === 'problems' && (
          <div className="h-[calc(100vh-220px)] overflow-y-auto p-3">
            <Button
              variant="secondary"
              size="sm"
              className="mb-3 ml-8 w-[calc(100%-2rem)] justify-start border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
              leftIcon={Plus}
              onClick={resetFormForNew}
            >
              새 문제 만들기
            </Button>
            <p className="px-1 text-xs font-medium text-slate-500">
              배포된 문제 목록
            </p>
            <div className="mt-3 space-y-2">
              {isLoading && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                  문제 목록을 불러오는 중입니다...
                </div>
              )}
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
        )}
      </aside>

      {/* Main: 75% */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl p-8">
          {activeMenu === null && (
            <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
              왼쪽 메뉴에서 <strong className="text-slate-700">문제 설정</strong> 또는{' '}
              <strong className="text-slate-700">비밀번호 설정</strong>을 선택해 주세요.
            </section>
          )}

          {activeMenu === 'problems' && (
            <>
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
                      disabled={isDeleting}
                      className="text-sm font-semibold text-red-600 hover:text-red-700"
                    >
                      {isDeleting ? '삭제 중...' : '이 문제 삭제하기'}
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
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const dataUrl = await resizeImageToDataUrl(file, 1024);
                          setForm((prev) => ({
                            ...prev,
                            imageFileName: file.name,
                            imageDataUrl:
                              typeof dataUrl === 'string' ? dataUrl : '',
                          }));
                        } catch (err) {
                          window.alert(
                            err?.message ||
                              '도형 이미지를 처리하는 중 오류가 발생했습니다.'
                          );
                        }
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
                    {form.imageDataUrl && (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2">
                        <img
                          src={form.imageDataUrl}
                          alt="도형 이미지 미리보기"
                          className="max-h-40 w-full object-contain"
                        />
                      </div>
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
              <div className="mt-2">
                <button
                  type="button"
                  onClick={applyRecommendedDefaults}
                  className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  명제 기반 디폴트 추천값 적용
                </button>
              </div>

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
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const dataUrl = await resizeImageToDataUrl(file, 1024);
                          setForm((prev) => ({
                            ...prev,
                            rubric: {
                              ...prev.rubric,
                              counterexampleImageFileName: file.name,
                              counterexampleImageDataUrl:
                                typeof dataUrl === 'string' ? dataUrl : '',
                            },
                          }));
                        } catch (err) {
                          window.alert(
                            err?.message ||
                              '반례 이미지를 처리하는 중 오류가 발생했습니다.'
                          );
                        }
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
                    {form.rubric.counterexampleImageDataUrl && (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2">
                        <img
                          src={form.rubric.counterexampleImageDataUrl}
                          alt="반례 이미지 미리보기"
                          className="max-h-40 w-full object-contain"
                        />
                      </div>
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
                    저장/수정 내용은 Firestore의 problems 컬렉션에 반영됩니다.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="text-sm font-semibold text-red-600 hover:text-red-700"
                    >
                      {isDeleting ? '삭제 중...' : '이 문제 삭제하기'}
                    </button>
                  )}
                  <Button
                    variant="primary"
                    size="lg"
                    leftIcon={Save}
                    onClick={handleSave}
                    disabled={isSaving || isDeleting}
                  >
                    {isSaving
                      ? '저장 중...'
                      : canEdit
                        ? '수정 내용 저장하기'
                        : '새 문제 배포하기'}
                  </Button>
                </div>
              </div>
            </section>
              </div>
            </>
          )}

          {activeMenu === 'password' && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900">비밀번호 설정</h2>
              <p className="mt-1 text-sm text-slate-600">
                관리자 로그인 비밀번호를 변경할 수 있습니다.
              </p>
              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    현재 비밀번호
                  </label>
                  <input
                    type="password"
                    value={currentPasswordInput}
                    onChange={(e) => setCurrentPasswordInput(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="현재 비밀번호"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    새 비밀번호
                  </label>
                  <input
                    type="password"
                    value={nextPasswordInput}
                    onChange={(e) => setNextPasswordInput(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="새 비밀번호(4자 이상)"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    새 비밀번호 확인
                  </label>
                  <input
                    type="password"
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="새 비밀번호 재입력"
                  />
                </div>
              </div>
              <div className="mt-6">
                <Button variant="primary" size="md" onClick={handleChangeAdminPassword}>
                  비밀번호 변경 저장
                </Button>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

export default AdminDashboard;
