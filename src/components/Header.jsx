import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCog } from 'lucide-react';
import Button from './Button';
import { getExpectedAdminPassword, setAdminAuthenticated } from '../lib/adminAuth';

/**
 * 홈 화면 헤더: 관리자 로그인 버튼
 */
function Header() {
  const navigate = useNavigate();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  const handleAdminLoginSubmit = () => {
    const expected = getExpectedAdminPassword();
    if (passwordInput.trim() !== expected) {
      window.alert('비밀번호가 올바르지 않습니다.');
      setAdminAuthenticated(false);
      setPasswordInput('');
      return;
    }

    setAdminAuthenticated(true);
    setPasswordInput('');
    setShowPasswordModal(false);
    navigate('/admin');
  };

  const handleOpenModal = () => {
    setPasswordInput('');
    setShowPasswordModal(true);
  };

  return (
    <>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden>📐</span>
          <span className="text-xl font-bold text-slate-800">
            2학년 도형의 성질 정당화 연습
          </span>
        </div>
        <nav className="flex items-center gap-3">
          <Button
            variant="primary"
            size="sm"
            leftIcon={UserCog}
            onClick={handleOpenModal}
          >
            관리자 로그인
          </Button>
        </nav>
      </header>

      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-800">
              관리자 비밀번호 확인
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              비밀번호를 입력하면 관리자 화면으로 이동합니다.
            </p>

            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdminLoginSubmit();
                if (e.key === 'Escape') {
                  setShowPasswordModal(false);
                  setPasswordInput('');
                }
              }}
              autoFocus
              placeholder="비밀번호 입력"
              className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordInput('');
                }}
                className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleAdminLoginSubmit}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Header;
