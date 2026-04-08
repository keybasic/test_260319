import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  PenTool,
  Camera,
  Mic,
  SquareStop,
  Send,
  Loader2,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import 'mathlive/static.css';
import 'mathlive';

import Button from '../components/Button';
import { getSolutionMethodsFromConfig } from '../data/mockData';
import { fetchAIFeedback } from '../services/openaiFeedback';
import { API_RATE, getThrottleWaitMs } from '../lib/apiCallRateLimit';
import { useProblems } from '../context/ProblemsContext';

function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}

function nowTime() {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function problemContextText(problem) {
  return `제목: ${problem.title}\n명제: ${problem.proposition}`;
}

export default function StudentWorkspace() {
  const { problemId } = useParams();
  const navigate = useNavigate();
  const { getProblem } = useProblems();
  const problem = useMemo(() => {
    const fromStore = getProblem(problemId);
    if (fromStore) return fromStore;
    return {
      id: problemId,
      title: '문제를 찾을 수 없습니다',
      emoji: '📘',
      proposition: '홈으로 돌아가 다른 문제를 선택해 주세요.',
      allowedMethods: { verbal: true, draw: true, photo: false },
    };
  }, [getProblem, problemId]);

  const inputConfig = useMemo(
    () => problem.allowedMethods || { verbal: true, draw: true, photo: false },
    [problem]
  );
  const solutionMethods = useMemo(
    () => getSolutionMethodsFromConfig(inputConfig),
    [inputConfig]
  );

  const firstEnabledId = useMemo(() => {
    const m = solutionMethods.find((x) => x.enabled);
    return m?.id ?? 'verbal';
  }, [solutionMethods]);

  const [inputMode, setInputMode] = useState(firstEnabledId);

  useEffect(() => {
    setInputMode(firstEnabledId);
  }, [firstEnabledId]);

  const [draft, setDraft] = useState('');
  const [mathLatex, setMathLatex] = useState('');
  const mathFieldRef = useRef(null);

  const [chatHistory, setChatHistory] = useState(() => [
    {
      id: 'welcome',
      role: 'ai',
      kind: 'welcome',
      text: '안녕하세요! 정당화 연습을 끝까지 도와줄게요. 😊\n풀이 방식을 고른 뒤, 말하기·필기·사진 중 편한 방법으로 설명해 보세요. 질문으로 함께 생각해 나가요.',
      timestamp: nowTime(),
    },
  ]);
  const [aiLoading, setAiLoading] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);

  const canvasRef = useRef(null);
  const canvasIdleTimerRef = useRef(null);
  const canvasVisionSeqRef = useRef(0);
  const lastCanvasSentRef = useRef('');
  const lastCanvasApiCompletedAtRef = useRef(0);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef(null);

  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const photoInputRef = useRef(null);

  const pdfRootRef = useRef(null);
  const [pdfSubmitting, setPdfSubmitting] = useState(false);
  const [canvasTick, setCanvasTick] = useState(0);
  const lastPhotoApiCompletedAtRef = useRef(0);

  const verbalCombined = useMemo(() => {
    const parts = [];
    if (draft.trim()) parts.push(draft.trim());
    if (mathLatex.trim()) parts.push(`[수식 LaTeX]\n${mathLatex.trim()}`);
    return parts.join('\n\n');
  }, [draft, mathLatex]);

  const debouncedVerbal = useDebouncedValue(
    verbalCombined,
    API_RATE.verbal.debounceMs
  );
  const lastVerbalSentRef = useRef('');
  const verbalSeqRef = useRef(0);
  const latestDebouncedVerbalRef = useRef(debouncedVerbal);
  const lastVerbalApiCompletedAtRef = useRef(0);

  useEffect(() => {
    latestDebouncedVerbalRef.current = debouncedVerbal;
  }, [debouncedVerbal]);

  useEffect(() => {
    if (inputMode !== 'verbal') return;
    const el = mathFieldRef.current;
    if (!el) return;
    const handler = () => {
      try {
        setMathLatex(el.getValue?.('latex') ?? el.value ?? '');
      } catch {
        setMathLatex('');
      }
    };
    el.addEventListener('input', handler);
    handler();
    return () => el.removeEventListener('input', handler);
  }, [inputMode]);

  useEffect(() => {
    if (inputMode !== 'verbal') return;
    const snapshot = debouncedVerbal.trim();
    if (!snapshot) return;
    if (snapshot === lastVerbalSentRef.current) return;

    let active = true;

    (async () => {
      const throttleWait = getThrottleWaitMs(
        lastVerbalApiCompletedAtRef.current,
        API_RATE.verbal.minIntervalMs
      );
      if (throttleWait > 0) {
        await new Promise((r) => setTimeout(r, throttleWait));
      }
      if (!active) return;

      const textToSend = latestDebouncedVerbalRef.current.trim();
      if (!textToSend) return;
      if (textToSend === lastVerbalSentRef.current) return;

      const seq = ++verbalSeqRef.current;
      setAiLoading(true);
      try {
        const reply = await fetchAIFeedback({
          problemContext: problemContextText(problem),
          userText: textToSend,
          imagesBase64: [],
        });
        if (!active || verbalSeqRef.current !== seq) return;
        lastVerbalSentRef.current = textToSend;
        lastVerbalApiCompletedAtRef.current = Date.now();
        setChatHistory((prev) => [
          ...prev,
          {
            id: `gpt-v-${Date.now()}`,
            role: 'ai',
            kind: 'gpt',
            text: reply,
            timestamp: nowTime(),
          },
        ]);
      } catch (e) {
        if (active && verbalSeqRef.current === seq) {
          window.alert(e?.message || String(e));
        }
      } finally {
        lastVerbalApiCompletedAtRef.current = Date.now();
        if (verbalSeqRef.current === seq && active) setAiLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [debouncedVerbal, inputMode, problem]);

  const getSpeechRecognitionCtor = () =>
    window.SpeechRecognition || window.webkitSpeechRecognition;

  const stopRecording = useCallback(() => {
    if (!recognitionRef.current) {
      setIsRecording(false);
      return;
    }
    try {
      recognitionRef.current.stop();
    } catch {
      // ignore
    } finally {
      setIsRecording(false);
      recognitionRef.current = null;
    }
  }, []);

  const startRecording = useCallback(() => {
    const SpeechRecognition = getSpeechRecognitionCtor();
    if (!SpeechRecognition) {
      window.alert('이 브라우저는 음성 인식을 지원하지 않아요.');
      return;
    }
    if (isRecording) return;

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'ko-KR';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result?.[0]?.transcript;
        if (result?.isFinal && transcript) finalTranscript += transcript;
      }
      const t = finalTranscript.trim();
      if (!t) return;
      setDraft((prev) => {
        if (!prev) return t;
        const needsSpace = prev.length > 0 && !/\s$/.test(prev);
        return prev + (needsSpace ? ' ' : '') + t;
      });
    };

    recognition.onerror = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };

    recognition.start();
    setIsRecording(true);
  }, [isRecording]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (inputMode !== 'verbal') stopRecording();
  }, [inputMode, stopRecording]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, rect.width * dpr);
    canvas.height = Math.max(1, rect.height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#1d4ed8';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, []);

  useEffect(() => {
    if (inputMode !== 'draw') return;
    resizeCanvas();
    const onResize = () => resizeCanvas();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [inputMode, resizeCanvas]);

  const scheduleCanvasVision = useCallback(() => {
    if (inputMode !== 'draw') return;
    clearTimeout(canvasIdleTimerRef.current);
    const seq = ++canvasVisionSeqRef.current;
    canvasIdleTimerRef.current = setTimeout(async () => {
      if (canvasVisionSeqRef.current !== seq) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      let dataUrl = canvas.toDataURL('image/png', 0.92);
      if (dataUrl === lastCanvasSentRef.current) return;

      const throttleWait = getThrottleWaitMs(
        lastCanvasApiCompletedAtRef.current,
        API_RATE.canvas.minIntervalMs
      );
      if (throttleWait > 0) {
        await new Promise((r) => setTimeout(r, throttleWait));
      }
      if (canvasVisionSeqRef.current !== seq) return;

      dataUrl = canvas.toDataURL('image/png', 0.92);
      if (dataUrl === lastCanvasSentRef.current) return;

      setAiLoading(true);
      try {
        const reply = await fetchAIFeedback({
          problemContext: problemContextText(problem),
          userText:
            '캔버스 필기 이미지를 읽고, OCR에 가깝게 텍스트로 요약한 뒤 정당화 논리에 대한 비계(질문 중심) 피드백을 주세요.',
          imagesBase64: [dataUrl],
        });
        if (canvasVisionSeqRef.current !== seq) return;
        lastCanvasSentRef.current = dataUrl;
        lastCanvasApiCompletedAtRef.current = Date.now();
        setChatHistory((prev) => [
          ...prev,
          {
            id: `gpt-d-${Date.now()}`,
            role: 'ai',
            kind: 'gpt',
            text: reply,
            timestamp: nowTime(),
          },
        ]);
      } catch (e) {
        if (canvasVisionSeqRef.current === seq) {
          window.alert(e?.message || String(e));
        }
      } finally {
        lastCanvasApiCompletedAtRef.current = Date.now();
        if (canvasVisionSeqRef.current === seq) setAiLoading(false);
      }
    }, API_RATE.canvas.idleDebounceMs);
  }, [inputMode, problem]);

  const getCanvasPoint = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    if (clientX == null || clientY == null) return null;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const drawLine = (from, to) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !from || !to) return;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  const handleCanvasPointerDown = (e) => {
    e.preventDefault();
    const p = getCanvasPoint(e);
    if (!p) return;
    isDrawingRef.current = true;
    lastPointRef.current = p;
  };

  const handleCanvasPointerMove = (e) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const p = getCanvasPoint(e);
    if (!p || !lastPointRef.current) return;
    drawLine(lastPointRef.current, p);
    lastPointRef.current = p;
  };

  const handleCanvasPointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPointRef.current = null;
    setCanvasTick((n) => n + 1);
    scheduleCanvasVision();
  };

  const clearCanvas = () => {
    resizeCanvas();
    lastCanvasSentRef.current = '';
    setCanvasTick((n) => n + 1);
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== 'string') return;
      setPhotoDataUrl(dataUrl);

      const throttleWait = getThrottleWaitMs(
        lastPhotoApiCompletedAtRef.current,
        API_RATE.photo.minIntervalMs
      );
      if (throttleWait > 0) {
        await new Promise((r) => setTimeout(r, throttleWait));
      }

      setAiLoading(true);
      try {
        const reply = await fetchAIFeedback({
          problemContext: problemContextText(problem),
          userText:
            '업로드된 풀이 사진을 OCR하고, 증명의 논리 위계를 간단히 정리한 뒤 종합 비계 피드백(질문 중심)을 주세요.',
          imagesBase64: [dataUrl],
        });
        lastPhotoApiCompletedAtRef.current = Date.now();
        setChatHistory((prev) => [
          ...prev,
          {
            id: `gpt-p-${Date.now()}`,
            role: 'ai',
            kind: 'gpt',
            text: reply,
            timestamp: nowTime(),
          },
        ]);
      } catch (err) {
        window.alert(err?.message || String(err));
      } finally {
        lastPhotoApiCompletedAtRef.current = Date.now();
        setAiLoading(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmitPdf = async () => {
    if (!pdfRootRef.current) return;
    setPdfSubmitting(true);
    try {
      const canvas = await html2canvas(pdfRootRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const maxW = pageW - 2 * margin;
      const maxH = pageH - 2 * margin;
      const pxToMm = (px) => (px * 25.4) / 96;
      const imgWmm = pxToMm(canvas.width);
      const imgHmm = pxToMm(canvas.height);
      const scale = Math.min(maxW / imgWmm, maxH / imgHmm);
      const w = imgWmm * scale;
      const h = imgHmm * scale;
      pdf.addImage(imgData, 'PNG', margin, margin, w, h);
      pdf.save(`정당화_과제_${problem.id}.pdf`);
    } catch (err) {
      window.alert(err?.message || String(err));
    } finally {
      setPdfSubmitting(false);
    }
  };

  const drawPdfDataUrl = useMemo(() => {
    if (inputMode !== 'draw') return '';
    const c = canvasRef.current;
    if (!c) return '';
    try {
      return c.toDataURL('image/png', 0.92);
    } catch {
      return '';
    }
  }, [inputMode, canvasTick]);

  return (
    <div className="flex h-screen flex-col bg-slate-50">
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

      <div className="grid flex-1 min-h-0 grid-cols-3">
        {/* 좌: 문제 */}
        <section className="flex min-h-0 flex-col border-r border-slate-200 bg-white overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
              <span aria-hidden>{problem.emoji}</span>
              {problem.title}
            </h2>
            <p className="mt-4 rounded-lg bg-blue-50 p-4 text-slate-700 border border-blue-100">
              <strong className="text-blue-800">문제 명제:</strong>{' '}
              {problem.proposition}
            </p>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 aspect-video overflow-hidden flex items-center justify-center">
              {problem.imageDataUrl ? (
                <img
                  src={problem.imageDataUrl}
                  alt={problem.imageAlt || '도형 이미지'}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="text-slate-400 text-sm">
                  도형 이미지 (Placeholder)
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 중: 입력 방식 + UI */}
        <section className="flex min-h-0 flex-col border-r border-slate-200 bg-slate-50 overflow-hidden">
          <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <span aria-hidden>✍️</span>
              나의 풀이
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              방식을 선택한 뒤 풀이해 보세요. GPT-4o가 비계 피드백을 제공합니다.
            </p>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            <div className="flex flex-wrap gap-2 mb-4">
              {solutionMethods.map((method) => {
                const active = inputMode === method.id;
                const Icon =
                  method.id === 'verbal'
                    ? Mic
                    : method.id === 'draw'
                      ? PenTool
                      : Camera;
                return (
                  <button
                    key={method.id}
                    type="button"
                    disabled={!method.enabled}
                    onClick={() => method.enabled && setInputMode(method.id)}
                    className={[
                      'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors',
                      !method.enabled
                        ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed line-through'
                        : active
                          ? 'border-blue-500 bg-blue-600 text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>
                      {method.emoji} {method.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {inputMode === 'verbal' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="primary"
                    size="md"
                    disabled={!inputConfig.verbal}
                    leftIcon={isRecording ? SquareStop : Mic}
                    onClick={() =>
                      isRecording ? stopRecording() : startRecording()
                    }
                    className={
                      isRecording
                        ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                        : ''
                    }
                  >
                    {isRecording
                      ? '녹음 중지 (말하는 중...)'
                      : '말로 설명하기'}
                    {isRecording && (
                      <span
                        aria-hidden
                        className="ml-2 inline-flex h-2 w-2 animate-pulse rounded-full bg-red-500"
                      />
                    )}
                  </Button>
                  <span className="text-xs text-slate-500">
                    음성은 아래 텍스트 영역에 이어 붙습니다. 수식은 MathLive 칸에
                    입력하세요.
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <p className="text-xs font-medium text-slate-600 mb-2">
                    수식 입력 (MathLive)
                  </p>
                  <math-field
                    ref={mathFieldRef}
                    className="w-full min-h-[100px] rounded-lg border border-slate-300 bg-slate-50/80 px-2 py-2 text-base"
                  />
                </div>

                <div
                  className={`flex min-h-[280px] flex-col rounded-xl border bg-white/80 p-3 shadow-sm ${
                    isRecording
                      ? 'border-blue-500 ring-2 ring-blue-400/40 animate-pulse'
                      : 'border-slate-200'
                  }`}
                >
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="말로 설명한 내용과 추가 설명을 적어 보세요..."
                    className="flex-1 min-h-[220px] resize-none rounded-lg border border-slate-300 bg-slate-50/70 px-3 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    입력이 잠시 안정된 뒤(디바운스 {API_RATE.verbal.debounceMs}
                    ms) 전송하며, 연속 호출은 최소 {API_RATE.verbal.minIntervalMs}
                    ms 간격(스로틀)으로 제한됩니다.
                  </p>
                </div>
              </div>
            )}

            {inputMode === 'draw' && (
              <div className="flex h-[min(520px,calc(100vh-220px))] min-h-[320px] flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-700">
                    디지털 판서 (Canvas)
                  </p>
                  <Button variant="secondary" size="sm" onClick={clearCanvas}>
                    지우기
                  </Button>
                </div>
                <div className="relative flex-1 min-h-0 rounded-lg border border-slate-200 bg-white overflow-hidden touch-none">
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 h-full w-full cursor-crosshair"
                    onPointerDown={handleCanvasPointerDown}
                    onPointerMove={handleCanvasPointerMove}
                    onPointerUp={handleCanvasPointerUp}
                    onPointerLeave={handleCanvasPointerUp}
                    onPointerCancel={handleCanvasPointerUp}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  필기 후 {API_RATE.canvas.idleDebounceMs}ms 정도 멈추면 캡처하고,
                  API 호출은 최소 {API_RATE.canvas.minIntervalMs}ms 간격으로
                  제한됩니다.
                </p>
              </div>
            )}

            {inputMode === 'photo' && (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={Camera}
                  onClick={() => photoInputRef.current?.click()}
                >
                  풀이 사진 업로드
                </Button>
                {photoDataUrl && (
                  <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <img
                      src={photoDataUrl}
                      alt="업로드한 풀이"
                      className="max-h-64 w-full object-contain"
                    />
                  </div>
                )}
                <p className="text-xs text-slate-500">
                  업로드 직시 OCR·논리 분석 피드백이 오른쪽에 표시됩니다.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* 우: AI */}
        <section className="flex min-h-0 flex-col bg-slate-50 overflow-hidden">
          <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <span aria-hidden>🤖</span>
              AI 가이드
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              질문 중심 비계 · LaTeX 수식 포함 응답
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {aiLoading && (
              <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                <Loader2 className="h-4 w-4 animate-spin" />
                AI가 분석 중이에요…
              </div>
            )}
            {chatHistory.map((msg) => (
              <div key={msg.id} className="flex justify-start">
                <div className="max-w-[95%] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  <span className="mt-2 block text-xs text-slate-400">
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 과제 제출 + PDF용 숨김 렌더 */}
      <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            API 키는 <code className="rounded bg-slate-100 px-1">.env</code>의{' '}
            <code className="rounded bg-slate-100 px-1">
              VITE_OPENAI_API_KEY
            </code>
            를 사용합니다. (클라이언트 노출 주의)
          </p>
          <Button
            variant="primary"
            size="lg"
            leftIcon={pdfSubmitting ? Loader2 : Send}
            disabled={pdfSubmitting}
            onClick={handleSubmitPdf}
            className={pdfSubmitting ? 'opacity-80' : ''}
          >
            {pdfSubmitting ? 'PDF 생성 중…' : '과제 제출 (PDF 다운로드)'}
          </Button>
        </div>
      </footer>

      {/* PDF 캡처용 (화면 밖, html2canvas 대상) */}
      <div
        ref={pdfRootRef}
        className="pointer-events-none fixed left-0 top-0 z-[-1] w-[794px] bg-white p-6 text-slate-900"
        aria-hidden
      >
        <h1 className="text-xl font-bold text-blue-900">
          2학년 도형의 성질 정당화 연습 — 과제 제출본
        </h1>
        <p className="mt-2 text-sm font-semibold">{problem.title}</p>
        <p className="mt-1 text-sm leading-relaxed">{problem.proposition}</p>

        <h2 className="mt-6 text-base font-bold border-b border-slate-300 pb-1">
          학생 풀이
        </h2>
        <p className="mt-2 text-xs text-slate-500">입력 방식: {inputMode}</p>
        {inputMode === 'verbal' && (
          <div className="mt-2 text-sm space-y-2">
            <p className="font-medium">말하기/텍스트</p>
            <p className="whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-2">
              {draft || '(없음)'}
            </p>
            <p className="font-medium">수식 (LaTeX)</p>
            <p className="whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-2 font-mono text-xs">
              {mathLatex || '(없음)'}
            </p>
          </div>
        )}
        {inputMode === 'draw' && (
          <div className="mt-2">
            {drawPdfDataUrl ? (
              <img
                src={drawPdfDataUrl}
                alt="필기"
                className="max-h-80 border border-slate-200"
              />
            ) : (
              <p className="text-sm text-slate-500">(필기 없음)</p>
            )}
          </div>
        )}
        {inputMode === 'photo' && (
          <div className="mt-2">
            {photoDataUrl ? (
              <img
                src={photoDataUrl}
                alt="풀이 사진"
                className="max-h-80 border border-slate-200"
              />
            ) : (
              <p className="text-sm text-slate-500">(사진 없음)</p>
            )}
          </div>
        )}

        <h2 className="mt-6 text-base font-bold border-b border-slate-300 pb-1">
          AI 피드백 기록
        </h2>
        <ul className="mt-2 list-decimal space-y-2 pl-5 text-sm">
          {chatHistory.map((m) => (
            <li key={m.id} className="whitespace-pre-wrap">
              {m.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
