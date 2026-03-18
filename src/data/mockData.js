/**
 * Geo-Guide AI Mock Data
 * 교육용 기하 도형 정당화 연습 앱 더미 데이터
 */

// 홈 화면용 문제 카드 목록
export const problemCards = [
  {
    id: 'prob-001',
    title: '평행사변형 대각선의 성질',
    emoji: '◇',
    description: '평행사변형의 두 대각선은 서로 다른 것을 이등분한다.',
    difficulty: '중급',
    topic: '평행사변형',
  },
  {
    id: 'prob-002',
    title: '이등변삼각형 밑각의 성질',
    emoji: '△',
    description: '이등변삼각형에서 밑변에 대한 두 각은 서로 같다.',
    difficulty: '기본',
    topic: '이등변삼각형',
  },
  {
    id: 'prob-003',
    title: '직각삼각형의 합동 조건',
    emoji: '▷',
    description: '빗변의 길이와 한 예각의 크기가 같은 두 직각삼각형은 합동이다.',
    difficulty: '중급',
    topic: '삼각형의 합동',
  },
  {
    id: 'prob-004',
    title: '원의 접선과 반지름',
    emoji: '○',
    description: '원의 접선은 접점에서 그은 반지름과 수직이다.',
    difficulty: '기본',
    topic: '원의 성질',
  },
  {
    id: 'prob-005',
    title: '삼각형의 외심',
    emoji: '⊙',
    description: '삼각형의 세 변의 수직이등분선은 한 점에서 만난다.',
    difficulty: '심화',
    topic: '삼각형의 외심과 내심',
  },
  {
    id: 'prob-006',
    title: '닮은 도형의 넓이 비',
    emoji: '∽',
    description: '닮음비가 m:n인 두 도형의 넓이의 비는 m²:n²이다.',
    difficulty: '중급',
    topic: '도형의 닮음',
  },
];

// 문제별 명제 텍스트 (ID → 상세)
const problemDetails = {
  'prob-001': {
    proposition:
      '평행사변형 ABCD에서 대각선 AC와 BD가 만나는 점을 O라 할 때, AO = CO, BO = DO임을 설명하시오.',
    imageAlt: '평행사변형 대각선 도형',
  },
  'prob-002': {
    proposition:
      '△ABC가 AB = AC인 이등변삼각형일 때, ∠B = ∠C임을 설명하시오.',
    imageAlt: '이등변삼각형 ABC 도형',
  },
  'prob-003': {
    proposition:
      '빗변의 길이와 한 예각의 크기가 같은 두 직각삼각형이 합동임을 설명하시오.',
    imageAlt: '직각삼각형 합동 도형',
  },
  'prob-004': {
    proposition: '원 O의 접선이 접점 A에서 반지름 OA와 수직임을 설명하시오.',
    imageAlt: '원의 접선과 반지름 도형',
  },
  'prob-005': {
    proposition:
      '삼각형의 세 변의 수직이등분선이 한 점에서 만남을 설명하시오.',
    imageAlt: '삼각형 외심 도형',
  },
  'prob-006': {
    proposition:
      '닮음비가 m:n인 두 삼각형의 넓이 비가 m²:n²임을 설명하시오.',
    imageAlt: '닮은 도형 넓이 비 도형',
  },
};

const defaultDetail = problemDetails['prob-002'];

/** 문제 ID로 카드 정보 + 명제 상세 반환 */
export function getProblemById(id) {
  const card = problemCards.find((c) => c.id === id);
  const detail = problemDetails[id] || defaultDetail;
  if (!card) {
    return {
      id: id || 'prob-002',
      title: '이등변삼각형 밑각의 성질',
      emoji: '△',
      proposition: defaultDetail.proposition,
      imageAlt: defaultDetail.imageAlt,
    };
  }
  return {
    ...card,
    proposition: detail.proposition,
    imageAlt: detail.imageAlt,
  };
}

// 학생 풀이 화면용 단일 문제 상세 (기본값, getProblemById 사용 권장)
export const currentProblem = {
  id: 'prob-002',
  title: '이등변삼각형 밑각의 성질',
  emoji: '△',
  proposition: '△ABC가 AB = AC인 이등변삼각형일 때, ∠B = ∠C임을 설명하시오.',
  imageAlt: '이등변삼각형 ABC 도형',
};

// AI 튜터 채팅 메시지 (더미)
export const aiChatMessages = [
  {
    id: 'msg-1',
    role: 'ai',
    text: '이등변삼각형의 밑각이 같다는 것을 설명하려면 어떤 보조선이 필요할까요? 🤔',
    timestamp: '10:32',
  },
  {
    id: 'msg-2',
    role: 'ai',
    text: '괜찮은 생각이에요! 꼭짓점 A에서 밑변 BC에 수선을 내려보면 어떨까요?',
    timestamp: '10:34',
  },
  {
    id: 'msg-3',
    role: 'ai',
    text: '아래 반례를 보면서, "두 변의 길이만 같다"고 해서 항상 밑각이 같은 것은 아닌 경우를 생각해 보세요.',
    hasImage: true,
    timestamp: '10:35',
  },
];

// 풀이법 옵션 (학생 워크스페이스)
export const solutionMethods = [
  { id: 'verbal', label: '말로 설명하기', emoji: '💬', enabled: true },
  { id: 'draw', label: '화면에 풀기', emoji: '✏️', enabled: true },
  { id: 'photo', label: '풀이 촬영하기', emoji: '📷', enabled: false },
];

// 관리자 대시보드용 통계 (더미)
export const adminStats = {
  totalProblems: 6,
  totalAttempts: 142,
  avgCompletionRate: 78,
};
