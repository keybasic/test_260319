import { useNavigate } from 'react-router-dom';
import { LogIn, UserCog } from 'lucide-react';
import Button from './Button';

/**
 * 홈 화면 헤더: 학생 로그인, 관리자 로그인 버튼
 */
function Header() {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className="text-2xl" aria-hidden>📐</span>
        <span className="text-xl font-bold text-slate-800">
          2학년 도형의 성질 정당화 연습
        </span>
      </div>
      <nav className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          leftIcon={LogIn}
          onClick={() => navigate('/workspace/prob-001')}
        >
          학생 로그인
        </Button>
        <Button
          variant="primary"
          size="sm"
          leftIcon={UserCog}
          onClick={() => navigate('/admin')}
        >
          관리자 로그인
        </Button>
      </nav>
    </header>
  );
}

export default Header;
