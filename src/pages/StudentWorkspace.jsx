import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  PenTool,
  Camera,
  FileText,
  Mic,
  SquareStop,
} from 'lucide-react';
import Button from '../components/Button';
import {
  getProblemById,
  solutionMethods,
} from '../data/mockData';

function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}

function StudentWorkspace() {
  const { problemId } = useParams();
  const navigate = useNavigate();
  const problem = getProblemById(problemId);

  const [draft, setDraft] = useState('');
  const [chatHistory, setChatHistory] = useState(() => {
    const welcomeTimestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const welcomeMessage = {
      id: 'welcome',
      role: 'ai',
      kind: 'welcome',
      text: '안녕하세요! 정당화 연습을 끝까지 도와줄게요. 😊\n문제를 설명해보면, 실시간 힌트로 한 단계씩 함께 갈 수 있어요.',
      hasImage: false,
      timestamp: welcomeTimestamp,
    };

    // 기본 인사만 먼저 보여주고, 이후는 textarea 입력 조건에 따라 동적으로 추가합니다.
    return [welcomeMessage];
  });
  const [hintAnswers, setHintAnswers] = useState({});

  // Web Speech API: 말로 설명하기(STT)
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);

  // 중학생 타자 속도를 고려한 실시간 힌트용 디바운스
  const debouncedDraft = useDebouncedValue(draft, 500);

  const diagonalTriggeredRef = useRef(false);
  const positiveTriggeredRef = useRef(false);

  const nowTime = () => {
    return new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const studentTextHasDiagonalAndSame = (text) => {
    const normalized = text.trim();
    const hasDiagonal = normalized.includes('대각선');
    const samePattern = /같다|같아요|같은|같음|같을|같지/;
    return hasDiagonal && samePattern.test(normalized);
  };

  const studentTextHasPositiveKeyword = (text) => {
    const normalized = text.trim();
    return normalized.includes('엇각') || normalized.includes('합동');
  };

  const handleSavePdf = () => {
    window.alert(
      '학생의 최종 풀이 과정과 AI 피드백 기록이 PDF로 저장됩니다.'
    );
  };

  // SpeechRecognition 지원 여부 확인
  const getSpeechRecognitionCtor = () => {
    return window.SpeechRecognition || window.webkitSpeechRecognition;
  };

  const startRecording = () => {
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
        if (result?.isFinal && transcript) {
          finalTranscript += transcript;
        }
      }

      const text = finalTranscript.trim();
      if (!text) return;

      // 최종 확정 텍스트를 textarea(draft) 뒤에 이어붙여서
      // 기존 debounce 실시간 분석 로직이 그대로 작동하게 함.
      setDraft((prev) => {
        if (!prev) return text;
        const needsSpace = prev.length > 0 && !/\s$/.test(prev);
        return prev + (needsSpace ? ' ' : '') + text;
      });
    };

    recognition.onerror = () => {
      // 프로토타입: 에러 내용을 자세히 다루지 않고, 녹음 상태만 해제
      setIsRecording(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };

    recognition.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
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
  };

  // 컴포넌트 언마운트 시 녹음 종료
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
    const text = debouncedDraft.trim();
    if (!text) {
      diagonalTriggeredRef.current = false;
      positiveTriggeredRef.current = false;
      return;
    }

    const diagonalCondition = studentTextHasDiagonalAndSame(text);
    const positiveCondition = studentTextHasPositiveKeyword(text);

    const newMessages = [];
    const createdAtText = nowTime();
    const baseId = `rt-${Date.now()}`;

    // (3) 대각선 + 같다는 즉시 힌트: 반례 -> 힌트
    if (diagonalCondition && !diagonalTriggeredRef.current) {
      newMessages.push({
        id: `${baseId}-counterexample`,
        role: 'ai',
        kind: 'counterexample',
        text: '잠깐! 네가 말한 조건이면 이런 길쭉한 모양도 가능해. 그래도 대각선 길이가 같을까?',
        hasImage: true,
        timestamp: createdAtText,
      });

      newMessages.push({
        id: `${baseId}-hint`,
        role: 'ai',
        kind: 'hint',
        text: '대각선의 길이가 항상 같은 사각형은',
        inputLabel: '힌트 답 입력',
        inputPlaceholder: '예: 평행사변형',
        suffix: '입니다.',
        hasImage: false,
        timestamp: createdAtText,
      });
    }

    // (4) 긍정적 강화: 엇각 / 합동 키워드
    if (positiveCondition && !positiveTriggeredRef.current) {
      newMessages.push({
        id: `${baseId}-positive`,
        role: 'ai',
        kind: 'positive',
        text: '훌륭해요! 엇각의 성질을 잘 찾았네요.',
        hasImage: false,
        timestamp: createdAtText,
      });
    }

    if (newMessages.length) {
      setChatHistory((prev) => [...prev, ...newMessages]);
    }

    diagonalTriggeredRef.current = diagonalCondition;
    positiveTriggeredRef.current = positiveCondition;
  }, [debouncedDraft]);

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

      {/* 가로 3분할 */}
      <div className="grid flex-1 min-h-0 grid-cols-3">
        {/* 1) 왼쪽 구역: 문제 확인 및 도구 */}
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
            <div className="mt-4 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center aspect-video text-slate-400">
              <span className="text-sm">도형 이미지 영역 (Placeholder)</span>
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-slate-50 p-4">
            <button
              type="button"
              onClick={handleSavePdf}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <FileText className="h-5 w-5" />
              <span>[ 📄 PDF로 저장하기 (과제 제출용) ]</span>
            </button>
          </div>
        </section>

        {/* 2) 중앙 구역: 나의 풀이 공간 (메인) */}
        <section className="flex min-h-0 flex-col border-r border-slate-200 bg-slate-50 overflow-hidden">
          <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <span aria-hidden>✍️</span>
              나의 풀이
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              입력하는 동안 실시간 힌트가 제공돼요. (디바운스 분석)
            </p>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            {/* 멀티모달 입력 버튼 3개 */}
            <div className="flex flex-wrap gap-3 mb-4">
              {solutionMethods.map((method) => {
                if (method.id === 'verbal') {
                  return (
                    <Button
                      key={method.id}
                      variant="primary"
                      size="md"
                      disabled={!method.enabled}
                      leftIcon={isRecording ? SquareStop : Mic}
                      onClick={() => {
                        if (isRecording) stopRecording();
                        else startRecording();
                      }}
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
                  );
                }

                const Icon =
                  method.id === 'draw' ? PenTool : Camera;

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

            {/* 넓은 풀이 입력 영역 */}
            <div className="flex h-[520px] min-h-0 flex-col rounded-xl border border-slate-200 bg-white/70 p-3 shadow-sm">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="판서하듯이 자유롭게 써보세요... 예: 두 대각선의 길이가 같아요"
                className={`flex-1 min-h-0 resize-none rounded-lg bg-slate-50/70 px-3 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 ${
                  isRecording
                    ? 'border border-blue-500 ring-2 ring-blue-400/50 animate-pulse'
                    : 'border border-slate-300 focus:ring-blue-500/20'
                }`}
              />
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500 px-1">
                <span>실시간 분석은 입력이 멈춘 뒤 500ms 후에 반영돼요.</span>
                <span>{draft.length}자</span>
              </div>
            </div>
          </div>
        </section>

        {/* 3) 오른쪽 구역: AI 가이드 (순수 피드백 전용) */}
        <section className="flex min-h-0 flex-col bg-slate-50 overflow-hidden">
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
            {chatHistory.map((msg) => (
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
                  {msg.kind === 'hint' ? (
                    <>
                      <p className="text-sm whitespace-pre-wrap">
                        {msg.text}{' '}
                        <input
                          aria-label={msg.inputLabel || '힌트 답 입력'}
                          value={hintAnswers[msg.id] ?? ''}
                          onChange={(e) =>
                            setHintAnswers((prev) => ({
                              ...prev,
                              [msg.id]: e.target.value,
                            }))
                          }
                          placeholder={msg.inputPlaceholder}
                          className="mx-1 inline-block w-40 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                        {msg.suffix}
                      </p>
                      <p className="mt-2 text-xs opacity-70">
                        입력은 프로토타입 더미 동작입니다.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                  )}

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
