import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  PenTool,
  Eraser,
  Hand,
  Camera,
  Mic,
  SquareStop,
  Send,
  Loader2,
  ClipboardList,
} from 'lucide-react';
import 'katex/dist/katex.min.css';

import Button from '../components/Button';
import GeometrySymbolInput from '../components/GeometrySymbolInput';
import MathMarkdown from '../components/MathMarkdown';
import ScoreBreakdownSection from '../components/ScoreBreakdownSection';
import { captureDomToPdf } from '../lib/captureDomToPdf';
import { normalizeSpeechTranscript } from '../lib/speechTranscript';
import { getSolutionMethodsFromConfig } from '../data/mockData';
import {
  fetchAIFeedback,
  fetchSocraticChatReply,
} from '../services/openaiFeedback';
import { API_RATE, getThrottleWaitMs } from '../lib/apiCallRateLimit';
import { useProblems } from '../context/ProblemsContext';
import {
  hasConfiguredGradingSteps,
  resolveScoreBreakdown,
  saveScoreSnapshot,
} from '../lib/stepScore';
import {
  buildStudentWorkDescriptor,
  canvasHasNonWhiteDrawing,
} from '../lib/studentWorkContext';

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
- 결론은 근거를 통해 도출되어야 하고 마지막에 나와야 한다.
- 학생이 제시하지 않은 근거는 튜터가 추론해서 제시하지 않는다.   

3. 오류 지적 방식:
- 학생이 틀린 사실(같지 않은 각을 같다고 함)을 말하면 절대 수긍하지 말고 즉시 멈춘다.
- "음, 다시 한번 그림을 볼까? 각 A와 각 B가 같으려면 어떤 조건이 필요할까? 지금 조건만으로도 충분할까?"처럼 스스로 모순을 발견하게 유도한다.

4. 추론 단계의 원자화:
- 한 번에 여러 단계를 건너뛰지 않는다.
- '가정 -> 근거 -> 중간 결론'의 한 고리가 완벽하게 연결되었을 때만 다음 힌트를 제공한다.

5. 교사의 가이드(teachingGuide) 절대 준수:
- 교사가 설정한 'AI 지도 가이드'와 어긋나는 주장은 수학적으로 가능하더라도 경로 이탈을 막아야 한다.
- "우리 이번 시간에는 [교사의 가이드 방식]을 활용해볼까?"처럼 교사의 지도 경로로 복귀시킨다.`;

const INPUT_MODE_SHORT_LABEL = {
  verbal: '말하기',
  draw: '판서',
  photo: '촬영',
};

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

  const hasGradingSteps = useMemo(
    () => hasConfiguredGradingSteps(problem.steps),
    [problem.steps]
  );

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
  /** 태블릿 등에서 onresult가 같은 final 구간을 반복 보내는 것 방지 */
  const speechProcessedIndexRef = useRef(0);

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
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const cameraVideoRef = useRef(null);
  const cameraCanvasRef = useRef(null);
  const cameraStreamRef = useRef(null);

  const pdfRootRef = useRef(null);
  const [pdfSubmitting, setPdfSubmitting] = useState(false);
  const [pdfScoreResult, setPdfScoreResult] = useState(null);
  const [canvasTick, setCanvasTick] = useState(0);
  const [canvasTool, setCanvasTool] = useState('pen');
  const lastPhotoApiCompletedAtRef = useRef(0);

  const verbalCombined = useMemo(() => draft.trim(), [draft]);

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

    speechProcessedIndexRef.current = 0;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'ko-KR';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      let finalTranscript = '';
      // event.resultIndex만 쓰면 모바일 Chrome에서 이미 처리한 final이 다시 들어올 수 있음
      for (
        let i = speechProcessedIndexRef.current;
        i < event.results.length;
        i += 1
      ) {
        const result = event.results[i];
        if (!result?.isFinal) break;
        const transcript = result[0]?.transcript;
        if (transcript) finalTranscript += transcript;
        speechProcessedIndexRef.current = i + 1;
      }
      const t = normalizeSpeechTranscript(finalTranscript.trim());
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

  const resizeCanvasElement = useCallback((canvas, preserveDrawing = true) => {
    if (!canvas) return;
    let snapshot = '';
    if (preserveDrawing) {
      try {
        if (canvas.width > 0 && canvas.height > 0) {
          snapshot = canvas.toDataURL('image/png', 0.92);
        }
      } catch {
        snapshot = '';
      }
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

      const canvasHasInk = canvasPages.some((page) => {
        const c = canvasRefs.current[page.id];
        return canvasHasNonWhiteDrawing(c);
      });
      if (!canvasHasInk) return;

      setAiLoading(true);
      try {
        const reply = await fetchAIFeedback({
          problemContext: problemContextText(problem),
          teachingGuide: problem.teachingGuide || '',
          verificationProtocol: MATH_VERIFICATION_PROTOCOL,
          userText:
            '(캔버스 필기 이미지 첨부 — 학생이 실제로 그린 내용만 OCR·요약)',
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
  }, [canvasPages, collectCanvasDataUrls, inputMode, problem]);

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
    const isEraser = canvasTool === 'eraser';
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    if (isEraser) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 18;
    } else {
      ctx.strokeStyle = '#1d4ed8';
      ctx.lineWidth = 2.5;
    }
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
  };

  const handleCanvasPointerDown = (canvasId, e) => {
    if (canvasTool === 'scroll') return;
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

  const clearAllCanvases = useCallback(() => {
    canvasPages.forEach((page) => {
      const canvas = canvasRefs.current[page.id];
      if (canvas) resizeCanvasElement(canvas, false);
    });
    lastCanvasSentRef.current = '';
    setCanvasTick((n) => n + 1);
  }, [canvasPages, resizeCanvasElement]);

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
      await processPhotoDataUrl(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const processPhotoDataUrl = useCallback(
    async (dataUrl) => {
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
            '(풀이 사진 첨부 — 사진에 실제로 보이는 학생 필기·풀이만 OCR·요약)',
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
    },
    [problem]
  );

  const stopCameraStream = useCallback(() => {
    const stream = cameraStreamRef.current;
    if (!stream) return;
    stream.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
  }, []);

  const handleOpenCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('이 브라우저에서는 카메라 촬영을 지원하지 않습니다.');
      setCameraOpen(false);
      return;
    }
    setCameraError('');
    try {
      stopCameraStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      cameraStreamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        const video = cameraVideoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.play().catch(() => {});
      });
    } catch (err) {
      setCameraOpen(false);
      setCameraError(
        err?.message || '카메라를 열 수 없습니다. 권한을 확인해 주세요.'
      );
    }
  }, [stopCameraStream]);

  const handleCloseCamera = useCallback(() => {
    setCameraOpen(false);
    stopCameraStream();
  }, [stopCameraStream]);

  const handleCaptureFromCamera = useCallback(async () => {
    const video = cameraVideoRef.current;
    const canvas = cameraCanvasRef.current;
    if (!video || !canvas) return;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    handleCloseCamera();
    await processPhotoDataUrl(dataUrl);
  }, [handleCloseCamera, processPhotoDataUrl]);

  useEffect(() => {
    if (inputMode === 'photo') return undefined;
    if (!cameraOpen) return undefined;
    setCameraOpen(false);
    stopCameraStream();
    return undefined;
  }, [cameraOpen, inputMode, stopCameraStream]);

  useEffect(() => () => stopCameraStream(), [stopCameraStream]);

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

    let canvasHasInk = false;
    const attachmentImagesBase64 = [];
    if (inputMode === 'draw') {
      for (const page of canvasPages) {
        const c = canvasRefs.current[page.id];
        if (!canvasHasNonWhiteDrawing(c)) continue;
        canvasHasInk = true;
        try {
          attachmentImagesBase64.push(c.toDataURL('image/png', 0.92));
        } catch {
          /* noop */
        }
      }
    }

    const studentWorkContext = buildStudentWorkDescriptor({
      inputMode,
      draft,
      mathLatex: '',
      chatMessages: nextMessages,
      photoDataUrl,
      canvasHasInk,
      canvasPageCount: canvasPages.length,
    });

    try {
      const assistantText = await fetchSocraticChatReply({
        problemContext: problemContextText(problem),
        teachingGuide: problem.teachingGuide || '',
        verificationProtocol: MATH_VERIFICATION_PROTOCOL,
        studentWorkContext,
        attachmentImagesBase64:
          inputMode === 'draw' ? attachmentImagesBase64 : [],
        chatMessages: chatMessages.map((m) => ({
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

  const handleOpenScorePreview = () => {
    let base = import.meta.env.BASE_URL || '/';
    if (!base.endsWith('/')) base += '/';
    saveScoreSnapshot(problem.id, {
      inputMode,
      draft,
      mathLatex: '',
      chatMessages: chatMessages.map((m) => ({
        id: m.id,
        role: m.role,
        text: m.text,
        kind: m.kind,
      })),
    });
    const url = `${window.location.origin}${base}workspace/${problem.id}/score?popup=1`;
    const w = 440;
    const h = Math.min(780, window.screen.availHeight - 48);
    const sx = window.screenX ?? window.screenLeft ?? 0;
    const sy = window.screenY ?? window.screenTop ?? 0;
    const left = Math.max(8, sx + (window.outerWidth || 0) - w - 16);
    const top = Math.max(32, sy + 24);
    const features = [
      `width=${w}`,
      `height=${h}`,
      `left=${left}`,
      `top=${top}`,
      'scrollbars=yes',
      'resizable=yes',
    ].join(',');
    window.open(url, `score-${problem.id}-${Date.now()}`, features);
  };

  const handleSubmitPdf = async () => {
    if (!pdfRootRef.current) return;
    setPdfSubmitting(true);
    try {
      const inkPageCount = canvasPages.filter((page) => {
        const c = canvasRefs.current[page.id];
        return c && canvasHasNonWhiteDrawing(c);
      }).length;

      const scoreResult = await resolveScoreBreakdown(problem, {
        inputMode,
        draft,
        mathLatex: '',
        chatMessages: chatMessages.map((m) => ({
          id: m.id,
          role: m.role,
          text: m.text,
          kind: m.kind,
        })),
        includeAllModes: true,
        canvasHasInk: inkPageCount > 0,
        canvasPageCount: inkPageCount,
        photoDataUrl,
      });
      setPdfScoreResult(scoreResult);
      await new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });

      await captureDomToPdf(
        pdfRootRef.current,
        `정당화_과제_${problem.id}.pdf`
      );
    } catch (err) {
      console.error('PDF 생성 오류:', err);
      window.alert(err?.message || String(err));
    } finally {
      setPdfSubmitting(false);
    }
  };

  const pdfStudentWork = useMemo(() => {
    const drawPages = canvasPages
      .map((page, idx) => {
        const canvas = canvasRefs.current[page.id];
        if (!canvas || !canvasHasNonWhiteDrawing(canvas)) return null;
        try {
          return { index: idx + 1, url: canvas.toDataURL('image/png', 0.92) };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const hasVerbal = Boolean(draft.trim());
    const hasDraw = drawPages.length > 0;
    const hasPhoto = Boolean(photoDataUrl);

    const usedModeLabels = [];
    if (hasVerbal) usedModeLabels.push('말로 설명하기');
    if (hasDraw) usedModeLabels.push('화면에 풀기');
    if (hasPhoto) usedModeLabels.push('풀이 촬영');

    return {
      drawPages,
      hasVerbal,
      hasDraw,
      hasPhoto,
      hasAny: hasVerbal || hasDraw || hasPhoto,
      usedModeLabels,
    };
  }, [draft, canvasPages, canvasTick, photoDataUrl]);

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <header className="flex shrink-0 items-center border-b border-slate-200 bg-white px-4 py-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="홈으로"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm font-medium">목록으로</span>
        </button>
      </header>

      <div className="grid flex-1 min-h-0 grid-cols-1 md:grid-cols-[minmax(0,0.88fr)_minmax(0,1.06fr)_minmax(0,1.06fr)] lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.09fr)_minmax(0,1.09fr)]">
        {/* 좌: 문제 */}
        <section className="flex min-h-0 flex-col border-r border-slate-200 bg-white overflow-hidden md:max-h-full">
          <div className="flex-1 overflow-y-auto p-4 md:p-5 lg:p-6">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 md:text-xl">
              <span aria-hidden>{problem.emoji}</span>
              {problem.title}
            </h2>
            <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-slate-700 border border-blue-100 md:mt-4 md:p-4">
              <strong className="text-blue-800">문제 명제:</strong>
              <span className="mt-2 block">
                <MathMarkdown>{problem.proposition || ''}</MathMarkdown>
              </span>
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

          <div
            className={`flex-1 min-h-0 flex flex-col ${
              inputMode === 'draw' ? 'overflow-hidden' : 'overflow-y-auto'
            }`}
          >
            <div
              className={
                inputMode === 'draw'
                  ? 'flex flex-1 min-h-0 flex-col px-3 py-3 sm:px-4'
                  : 'p-3 sm:p-4'
              }
            >
            <div className="mb-3 flex shrink-0 flex-nowrap gap-1 sm:gap-1.5">
              {solutionMethods.map((method) => {
                const active = inputMode === method.id;
                const Icon =
                  method.id === 'verbal'
                    ? Mic
                    : method.id === 'draw'
                      ? PenTool
                      : Camera;
                const shortLabel =
                  INPUT_MODE_SHORT_LABEL[method.id] ?? method.label;
                return (
                  <button
                    key={method.id}
                    type="button"
                    disabled={!method.enabled}
                    onClick={() => method.enabled && setInputMode(method.id)}
                    title={method.label}
                    className={[
                      'inline-flex min-w-0 flex-1 items-center justify-center gap-1 rounded-lg border px-1.5 py-1.5 text-[10px] font-semibold leading-tight transition-colors sm:flex-none sm:gap-1.5 sm:rounded-xl sm:px-2.5 sm:py-2 sm:text-xs',
                      !method.enabled
                        ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed line-through'
                        : active
                          ? 'border-blue-500 bg-blue-600 text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <Icon className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
                    <span className="truncate">{shortLabel}</span>
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
                      : '녹음 시작'}
                    {isRecording && (
                      <span
                        aria-hidden
                        className="ml-2 inline-flex h-2 w-2 animate-pulse rounded-full bg-red-500"
                      />
                    )}
                  </Button>
                  <span className="text-xs text-slate-500">
                    음성은 아래 설명 칸에 이어 붙습니다. 삼각형 ABC처럼
                    나온 부분을 고른 뒤 △ 버튼으로 바꿀 수 있어요.
                  </span>
                </div>

                <GeometrySymbolInput
                  value={draft}
                  onChange={setDraft}
                  label="정당화 설명"
                  highlightRecording={isRecording}
                  placeholder="말로 설명한 내용이 여기에 나타납니다. 직접 고치거나 △·∠·≡ 버튼으로 기호를 넣어 보세요."
                  hint="글자를 드래그해 선택한 뒤 기호 버튼을 누면 선택한 부분이 기호로 바뀝니다. (예: 삼각형 → △)"
                />
              </div>
            )}

            {inputMode === 'draw' && (
              <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:p-3">
                <div className="mb-2 shrink-0 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium text-slate-700 sm:text-sm">
                    디지털 판서 (Canvas)
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <div
                      className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
                      role="group"
                      aria-label="판서 도구"
                    >
                      <button
                        type="button"
                        onClick={() => setCanvasTool('pen')}
                        aria-pressed={canvasTool === 'pen'}
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors sm:gap-1.5 sm:px-2.5 sm:text-xs ${
                          canvasTool === 'pen'
                            ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <PenTool className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        펜
                      </button>
                      <button
                        type="button"
                        onClick={() => setCanvasTool('eraser')}
                        aria-pressed={canvasTool === 'eraser'}
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors sm:gap-1.5 sm:px-2.5 sm:text-xs ${
                          canvasTool === 'eraser'
                            ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <Eraser className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        지우개
                      </button>
                      <button
                        type="button"
                        onClick={() => setCanvasTool('scroll')}
                        aria-pressed={canvasTool === 'scroll'}
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors sm:gap-1.5 sm:px-2.5 sm:text-xs ${
                          canvasTool === 'scroll'
                            ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <Hand className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        스크롤
                      </button>
                    </div>
                    <Button variant="secondary" size="sm" onClick={clearAllCanvases}>
                      전체 지우기
                    </Button>
                  </div>
                </div>
                {canvasTool === 'scroll' ? (
                  <p className="mb-2 shrink-0 text-[11px] text-blue-700 sm:text-xs">
                    스크롤 모드: 손가락으로 아래·위로 밀어 풀이 공간을 이동할 수
                    있어요. 필기할 때는 펜을 선택하세요.
                  </p>
                ) : null}
                <div
                  ref={drawScrollRef}
                  className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-slate-50/40 p-2 sm:space-y-4 sm:p-3"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  {canvasPages.map((page, idx) => (
                    <div key={page.id} className="space-y-1.5 sm:space-y-2">
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 sm:text-xs">
                        <span className="font-semibold">풀이 공간 {idx + 1}</span>
                        <span className="h-px flex-1 bg-slate-200" />
                      </div>
                      <div
                        className={`relative rounded-lg border border-slate-200 bg-white overflow-hidden ${
                          canvasPages.length === 1
                            ? 'h-[min(560px,calc(100dvh-220px))] min-h-60'
                            : 'h-60 sm:h-72 md:h-80 lg:h-96'
                        } ${canvasTool === 'scroll' ? '' : 'touch-none'}`}
                      >
                        <canvas
                          ref={(el) => setCanvasRef(page.id, el)}
                          className={`absolute inset-0 h-full w-full ${
                            canvasTool === 'scroll'
                              ? 'pointer-events-none'
                              : canvasTool === 'eraser'
                                ? 'cursor-cell touch-none'
                                : 'cursor-crosshair touch-none'
                          }`}
                          onPointerDown={(e) => handleCanvasPointerDown(page.id, e)}
                          onPointerMove={(e) => handleCanvasPointerMove(page.id, e)}
                          onPointerUp={() => handleCanvasPointerUp(page.id)}
                          onPointerLeave={() => handleCanvasPointerUp(page.id)}
                          onPointerCancel={() => handleCanvasPointerUp(page.id)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addCanvasPage}
                  className="mt-2 shrink-0 w-full rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/40 px-3 py-2 text-[11px] font-semibold text-blue-700 hover:bg-blue-100/60 sm:px-4 sm:text-xs"
                >
                  + 풀이 공간 추가하기
                </button>
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
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    size="md"
                    leftIcon={Camera}
                    onClick={handleOpenCamera}
                  >
                    사진 찍기
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    leftIcon={Camera}
                    onClick={() => photoInputRef.current?.click()}
                  >
                    기기 이미지 업로드
                  </Button>
                </div>
                {cameraError ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    {cameraError}
                  </p>
                ) : null}
                {cameraOpen ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <video
                      ref={cameraVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="h-64 w-full rounded-md bg-black object-contain"
                    />
                    <canvas ref={cameraCanvasRef} className="hidden" />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button variant="primary" size="sm" onClick={handleCaptureFromCamera}>
                        촬영
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handleCloseCamera}>
                        닫기
                      </Button>
                    </div>
                  </div>
                ) : null}
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
                  업로드 즉시 OCR·논리 분석 피드백이 오른쪽에 표시됩니다.
                </p>
              </div>
            )}
            </div>
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
                  <MathMarkdown>{msg.text}</MathMarkdown>
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
      <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-2">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-end gap-2">
          <Button
            variant="primary"
            size="md"
            leftIcon={ClipboardList}
            disabled={!hasGradingSteps}
            title={
              hasGradingSteps
                ? undefined
                : '관리자가 단계별 배점(Step)을 설정한 뒤 사용할 수 있습니다.'
            }
            onClick={handleOpenScorePreview}
            className={
              !hasGradingSteps
                ? 'disabled:!opacity-100 disabled:!bg-slate-300 disabled:!text-slate-600 disabled:hover:!bg-slate-300 !py-2'
                : '!py-2'
            }
          >
            점수 확인
          </Button>
          <Button
            variant="primary"
            size="md"
            leftIcon={pdfSubmitting ? Loader2 : Send}
            disabled={pdfSubmitting}
            onClick={handleSubmitPdf}
            className={pdfSubmitting ? 'opacity-80 !py-2' : '!py-2'}
          >
            {pdfSubmitting ? '채점·PDF 생성 중…' : '과제 제출 (PDF 다운로드)'}
          </Button>
        </div>
      </footer>

      {/* PDF 캡처용 (화면 밖, html2canvas 대상) */}
      <div
        ref={pdfRootRef}
        className="pointer-events-none fixed left-0 top-0 z-[-1] w-[794px] bg-white p-6 text-slate-900 [&_.katex]:text-inherit"
        aria-hidden
      >
        <h1 className="text-xl font-bold text-blue-900">
          2학년 도형의 성질 정당화 연습 — 과제 제출본
        </h1>
        <p className="mt-2 text-sm font-semibold">{problem.title}</p>
        <MathMarkdown className="mt-1 text-sm leading-relaxed">
          {problem.proposition}
        </MathMarkdown>

        <h2 className="mt-6 text-base font-bold border-b border-slate-300 pb-1">
          학생 풀이
        </h2>
        <p className="mt-2 text-xs text-slate-500">
          사용한 풀이 방식:{' '}
          {pdfStudentWork.usedModeLabels.length > 0
            ? pdfStudentWork.usedModeLabels.join(', ')
            : '(없음)'}
        </p>

        {pdfStudentWork.hasVerbal && (
          <div className="mt-4 text-sm">
            <h3 className="font-semibold text-slate-800">① 말로 설명하기</h3>
            <MathMarkdown
              className="mt-1 rounded border border-slate-200 bg-slate-50 p-2 text-sm"
              emptyLabel="(없음)"
            >
              {draft}
            </MathMarkdown>
          </div>
        )}

        {pdfStudentWork.hasDraw && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-slate-800">② 화면에 풀기</h3>
            <div className="mt-2 space-y-3">
              {pdfStudentWork.drawPages.map((page) => (
                <div key={`pdf-draw-${page.index}`}>
                  <p className="mb-1 text-xs text-slate-500">
                    풀이 공간 {page.index}
                  </p>
                  <img
                    src={page.url}
                    alt={`필기 ${page.index}`}
                    className="max-h-80 border border-slate-200"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {pdfStudentWork.hasPhoto && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-slate-800">③ 풀이 촬영</h3>
            <img
              src={photoDataUrl}
              alt="풀이 사진"
              className="mt-2 max-h-80 border border-slate-200"
            />
          </div>
        )}

        {!pdfStudentWork.hasAny && (
          <p className="mt-2 text-sm text-slate-500">(기록된 풀이 없음)</p>
        )}

        <h2 className="mt-6 text-base font-bold border-b border-slate-300 pb-1">
          AI 피드백 기록
        </h2>
        <ol className="mt-2 list-decimal space-y-3 pl-5 text-sm">
          {chatMessages.map((m) => (
            <li key={m.id}>
              <MathMarkdown>{m.text}</MathMarkdown>
            </li>
          ))}
        </ol>

        <h2 className="mt-6 text-base font-bold border-b border-slate-300 pb-1">
          단계별 채점 결과
        </h2>
        {pdfScoreResult ? (
          <ScoreBreakdownSection
            variant="print"
            stepsConfigured={pdfScoreResult.stepsConfigured}
            breakdown={pdfScoreResult.breakdown}
            scoreNote={pdfScoreResult.scoreNote}
          />
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            (과제 제출 시 채점 결과가 포함됩니다)
          </p>
        )}
      </div>
    </div>
  );
}
