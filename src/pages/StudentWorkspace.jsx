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
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import 'mathlive/static.css';
import 'mathlive';

import Button from '../components/Button';
import { getSolutionMethodsFromConfig } from '../data/mockData';
import {
  fetchAIFeedback,
  fetchSocraticChatReply,
} from '../services/openaiFeedback';
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

const MATH_VERIFICATION_PROTOCOL = `[수학적 엄밀함 검증 프로토콜]

1. 선-검증 후-답변 (Verify First):
- 학생이 "각 A와 각 B가 같다"고 주장하면, 답변 전에 반드시 다음 두 가지를 내부 검토한다.
- (1) 주어진 조건(가정)이나 이전 단계 결론만으로 이 사실이 증명 가능한가?
- (2) 학생이 이 주장에 대한 수학적 근거(예: 엇각, 이등변삼각형의 성질 등)를 명시했는가?

2. 근거 없는 비약 차단:
- 수학적으로 맞더라도 근거 없이 결과만 말하면 "맞았어"라고 하지 않는다.
- 대신 "왜 그 두 각의 크기가 같다고 생각했니?"처럼 근거를 먼저 묻는다.

3. 오류 지적 방식:
- 학생이 틀린 사실(같지 않은 각을 같다고 함)을 말하면 절대 수긍하지 말고 즉시 멈춘다.
- "음, 다시 한번 그림을 볼까? 각 A와 각 B가 같으려면 어떤 조건이 필요할까? 지금 조건만으로도 충분할까?"처럼 스스로 모순을 발견하게 유도한다.

4. 추론 단계의 원자화:
- 한 번에 여러 단계를 건너뛰지 않는다.
- '가정 -> 근거 -> 중간 결론'의 한 고리가 완벽하게 연결되었을 때만 다음 힌트를 제공한다.

5. 교사의 가이드(teachingGuide) 절대 준수:
- 교사가 설정한 'AI 지도 가이드'와 어긋나는 주장은 수학적으로 가능하더라도 경로 이탈을 막아야 한다.
- "우리 이번 시간에는 [교사의 가이드 방식]을 활용해볼까?"처럼 교사의 지도 경로로 복귀시킨다.`;

// GPT가 자주 주는 \( ... \), \[ ... \] 표기를
// remark-math가 안정적으로 처리하는 $...$, $$...$$로 정규화
function normalizeMathDelimiters(text) {
  if (!text) return '';
  return text
    .replace(/\\\[((?:.|\n)*?)\\\]/g, (_, expr) => `$$${expr}$$`)
    .replace(/\\\(((?:.|\n)*?)\\\)/g, (_, expr) => `$${expr}$`);
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
      teachingGuide: '',
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

  const [chatMessages, setChatMessages] = useState(() => [
    {
      id: 'welcome',
      role: 'assistant',
      kind: 'welcome',
      text: '안녕하세요! 정당화 연습을 끝까지 도와줄게요. 😊\n풀이 방식을 고른 뒤, 말하기·필기·사진 중 편한 방법으로 설명해 보세요. 질문으로 함께 생각해 나가요.',
      timestamp: nowTime(),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);

  const [canvasPages, setCanvasPages] = useState(() => [
    { id: `canvas-${Date.now()}` },
  ]);
  const canvasRefs = useRef({});
  const drawScrollRef = useRef(null);
  const canvasIdleTimerRef = useRef(null);
  const canvasVisionSeqRef = useRef(0);
  const lastCanvasSentRef = useRef('');
  const lastCanvasApiCompletedAtRef = useRef(0);
  const isDrawingRef = useRef(false);
  const activeDrawingCanvasIdRef = useRef(null);
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

  // 2구역의 최종 풀이 컨텍스트(요청사항: solutionText)
  const solutionText = useMemo(() => {
    if (inputMode === 'verbal') return verbalCombined.trim();
    if (inputMode === 'draw') {
      return '학생이 화면에 풀기(캔버스) 모드에서 필기 중입니다.';
    }
    if (inputMode === 'photo') {
      return photoDataUrl
        ? '학생이 풀이 촬영하기 모드에서 이미지 업로드를 완료했습니다.'
        : '학생이 풀이 촬영하기 모드이며 아직 이미지를 업로드하지 않았습니다.';
    }
    return verbalCombined.trim();
  }, [inputMode, verbalCombined, photoDataUrl]);

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
          teachingGuide: problem.teachingGuide || '',
          verificationProtocol: MATH_VERIFICATION_PROTOCOL,
          userText: textToSend,
          imagesBase64: [],
        });
        if (!active || verbalSeqRef.current !== seq) return;
        lastVerbalSentRef.current = textToSend;
        lastVerbalApiCompletedAtRef.current = Date.now();
        setChatMessages((prev) => [
          ...prev,
          {
            id: `gpt-v-${Date.now()}`,
            role: 'assistant',
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

  const resizeCanvasElement = useCallback((canvas) => {
    if (!canvas) return;
    let snapshot = '';
    try {
      if (canvas.width > 0 && canvas.height > 0) {
        snapshot = canvas.toDataURL('image/png', 0.92);
      }
    } catch {
      snapshot = '';
    }

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

    if (snapshot) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = snapshot;
    }
  }, []);

  const resizeAllCanvases = useCallback(() => {
    canvasPages.forEach((page) => {
      const canvas = canvasRefs.current[page.id];
      if (canvas) resizeCanvasElement(canvas);
    });
  }, [canvasPages, resizeCanvasElement]);

  useEffect(() => {
    if (inputMode !== 'draw') return;
    resizeAllCanvases();
    const onResize = () => resizeAllCanvases();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [inputMode, resizeAllCanvases]);

  const setCanvasRef = useCallback(
    (canvasId, element) => {
      if (element) {
        // 리렌더 시 ref 콜백이 재실행되어도
        // 동일 DOM이면 재초기화(내용 소실)하지 않음
        if (canvasRefs.current[canvasId] === element) return;
        canvasRefs.current[canvasId] = element;
        resizeCanvasElement(element);
      }
    },
    [resizeCanvasElement]
  );

  const collectCanvasDataUrls = useCallback(() => {
    return canvasPages
      .map((page) => canvasRefs.current[page.id])
      .filter(Boolean)
      .map((canvas) => canvas.toDataURL('image/png', 0.92));
  }, [canvasPages]);

  const scheduleCanvasVision = useCallback(() => {
    if (inputMode !== 'draw') return;
    clearTimeout(canvasIdleTimerRef.current);
    const seq = ++canvasVisionSeqRef.current;
    canvasIdleTimerRef.current = setTimeout(async () => {
      if (canvasVisionSeqRef.current !== seq) return;
      const urls = collectCanvasDataUrls();
      if (!urls.length) return;
      let signature = urls.join('||');
      if (signature === lastCanvasSentRef.current) return;

      const throttleWait = getThrottleWaitMs(
        lastCanvasApiCompletedAtRef.current,
        API_RATE.canvas.minIntervalMs
      );
      if (throttleWait > 0) {
        await new Promise((r) => setTimeout(r, throttleWait));
      }
      if (canvasVisionSeqRef.current !== seq) return;

      const latestUrls = collectCanvasDataUrls();
      if (!latestUrls.length) return;
      signature = latestUrls.join('||');
      if (signature === lastCanvasSentRef.current) return;

      setAiLoading(true);
      try {
        const reply = await fetchAIFeedback({
          problemContext: problemContextText(problem),
          teachingGuide: problem.teachingGuide || '',
          verificationProtocol: MATH_VERIFICATION_PROTOCOL,
          userText:
            '캔버스 필기 이미지를 읽고, OCR에 가깝게 텍스트로 요약한 뒤 정당화 논리에 대한 힌트(질문 중심) 피드백을 주세요.',
          imagesBase64: latestUrls,
        });
        if (canvasVisionSeqRef.current !== seq) return;
        lastCanvasSentRef.current = signature;
        lastCanvasApiCompletedAtRef.current = Date.now();
        setChatMessages((prev) => [
          ...prev,
          {
            id: `gpt-d-${Date.now()}`,
            role: 'assistant',
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
  }, [collectCanvasDataUrls, inputMode, problem]);

  const getCanvasPoint = (e, canvasId) => {
    const canvas = canvasRefs.current[canvasId];
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    if (clientX == null || clientY == null) return null;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const drawLine = (canvasId, from, to) => {
    const canvas = canvasRefs.current[canvasId];
    const ctx = canvas?.getContext('2d');
    if (!ctx || !from || !to) return;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  const handleCanvasPointerDown = (canvasId, e) => {
    e.preventDefault();
    const p = getCanvasPoint(e, canvasId);
    if (!p) return;
    isDrawingRef.current = true;
    activeDrawingCanvasIdRef.current = canvasId;
    lastPointRef.current = p;
  };

  const handleCanvasPointerMove = (canvasId, e) => {
    if (!isDrawingRef.current) return;
    if (activeDrawingCanvasIdRef.current !== canvasId) return;
    e.preventDefault();
    const p = getCanvasPoint(e, canvasId);
    if (!p || !lastPointRef.current) return;
    drawLine(canvasId, lastPointRef.current, p);
    lastPointRef.current = p;
  };

  const handleCanvasPointerUp = (canvasId) => {
    if (activeDrawingCanvasIdRef.current !== canvasId) return;
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    activeDrawingCanvasIdRef.current = null;
    lastPointRef.current = null;
    setCanvasTick((n) => n + 1);
    scheduleCanvasVision();
  };

  const clearAllCanvases = () => {
    resizeAllCanvases();
    lastCanvasSentRef.current = '';
    setCanvasTick((n) => n + 1);
  };

  const addCanvasPage = () => {
    const newPage = { id: `canvas-${Date.now()}-${Math.floor(Math.random() * 1000)}` };
    setCanvasPages((prev) => [...prev, newPage]);
    requestAnimationFrame(() => {
      if (drawScrollRef.current) {
        drawScrollRef.current.scrollTop = drawScrollRef.current.scrollHeight;
      }
    });
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
          teachingGuide: problem.teachingGuide || '',
          verificationProtocol: MATH_VERIFICATION_PROTOCOL,
          userText:
            '업로드된 풀이 사진을 OCR하고, 증명의 논리 위계를 간단히 정리한 뒤 종합 힌트 피드백(질문 중심)을 주세요.',
          imagesBase64: [dataUrl],
        });
        lastPhotoApiCompletedAtRef.current = Date.now();
        setChatMessages((prev) => [
          ...prev,
          {
            id: `gpt-p-${Date.now()}`,
            role: 'assistant',
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

  const handleSendChat = async () => {
    const content = chatInput.trim();
    if (!content || aiLoading) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      kind: 'chat-user',
      text: content,
      timestamp: nowTime(),
    };

    const nextMessages = [...chatMessages, userMessage];
    setChatMessages(nextMessages);
    setChatInput('');
    setAiLoading(true);

    try {
      const assistantText = await fetchSocraticChatReply({
        problemContext: problemContextText(problem),
        teachingGuide: problem.teachingGuide || '',
        verificationProtocol: MATH_VERIFICATION_PROTOCOL,
        solutionText,
        chatMessages: nextMessages.map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          text: m.text,
        })),
        userMessage: content,
      });

      setChatMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          kind: 'chat-assistant',
          text: assistantText,
          timestamp: nowTime(),
        },
      ]);
    } catch (err) {
      window.alert(err?.message || String(err));
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmitPdf = async () => {
    if (!pdfRootRef.current) return;
    setPdfSubmitting(true);
    try {
      const imgData = await toPng(pdfRootRef.current, {
        cacheBust: true,
      });

      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imgData;
      });

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
      const imgRatio = img.width / img.height;
      const boxRatio = maxW / maxH;
      const w = imgRatio > boxRatio ? maxW : maxH * imgRatio;
      const h = imgRatio > boxRatio ? maxW / imgRatio : maxH;

      pdf.addImage(imgData, 'PNG', margin, margin, w, h);
      pdf.save(`정당화_과제_${problem.id}.pdf`);
    } catch (err) {
      console.error('PDF 생성 오류:', err);
      window.alert(err?.message || String(err));
    } finally {
      setPdfSubmitting(false);
    }
  };

  const drawPdfDataUrls = useMemo(() => {
    if (inputMode !== 'draw') return [];
    return canvasPages
      .map((page) => canvasRefs.current[page.id])
      .filter(Boolean)
      .map((canvas) => {
        try {
          return canvas.toDataURL('image/png', 0.92);
        } catch {
          return '';
        }
      })
      .filter(Boolean);
  }, [inputMode, canvasPages, canvasTick]);

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
              방식을 선택한 뒤 풀이해 보세요. GPT-4o가 힌트 피드백을 제공합니다.
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
                  <Button variant="secondary" size="sm" onClick={clearAllCanvases}>
                    전체 지우기
                  </Button>
                </div>
                <div
                  ref={drawScrollRef}
                  className="flex-1 min-h-0 space-y-4 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/40 p-3"
                >
                  {canvasPages.map((page, idx) => (
                    <div key={page.id} className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold">풀이 공간 {idx + 1}</span>
                        <span className="h-px flex-1 bg-slate-200" />
                      </div>
                      <div className="relative h-80 rounded-lg border border-slate-200 bg-white overflow-hidden touch-none">
                        <canvas
                          ref={(el) => setCanvasRef(page.id, el)}
                          className="absolute inset-0 h-full w-full cursor-crosshair"
                          onPointerDown={(e) => handleCanvasPointerDown(page.id, e)}
                          onPointerMove={(e) => handleCanvasPointerMove(page.id, e)}
                          onPointerUp={() => handleCanvasPointerUp(page.id)}
                          onPointerLeave={() => handleCanvasPointerUp(page.id)}
                          onPointerCancel={() => handleCanvasPointerUp(page.id)}
                        />
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addCanvasPage}
                    className="w-full rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/40 px-4 py-4 text-sm font-semibold text-blue-700 hover:bg-blue-100/60"
                  >
                    + 풀이 공간 추가하기
                  </button>
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
              질문 중심 힌트 · LaTeX 수식 포함 응답
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {aiLoading && (
              <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                <Loader2 className="h-4 w-4 animate-spin" />
                AI가 분석 중이에요…
              </div>
            )}
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div className="max-w-[95%] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap break-words">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {normalizeMathDelimiters(msg.text)}
                    </ReactMarkdown>
                  </div>
                  <span className="mt-2 block text-xs text-slate-400">
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-white p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChat();
                  }
                }}
                rows={2}
                placeholder="AI 튜터에게 질문하거나 답해보세요..."
                className="flex-1 resize-none rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              />
              <button
                type="button"
                onClick={handleSendChat}
                disabled={!chatInput.trim() || aiLoading}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-blue-600 px-4 text-white disabled:cursor-not-allowed disabled:opacity-50 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <Send className="h-4 w-4 mr-1" />
                전송
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* 과제 제출 + PDF용 숨김 렌더 */}
      <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-5xl justify-end">
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
            {drawPdfDataUrls.length > 0 ? (
              <div className="space-y-3">
                {drawPdfDataUrls.map((url, idx) => (
                  <div key={`pdf-draw-${idx}`}>
                    <p className="mb-1 text-xs text-slate-500">풀이 공간 {idx + 1}</p>
                    <img
                      src={url}
                      alt={`필기 ${idx + 1}`}
                      className="max-h-80 border border-slate-200"
                    />
                  </div>
                ))}
              </div>
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
          {chatMessages.map((m) => (
            <li key={m.id} className="whitespace-pre-wrap">
              {m.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
