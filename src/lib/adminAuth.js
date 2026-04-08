const ADMIN_AUTH_KEY = 'geo-guide-admin-auth';
const ADMIN_PASSWORD_KEY = 'geo-guide-admin-password';

export function isAdminAuthenticated() {
  return sessionStorage.getItem(ADMIN_AUTH_KEY) === '1';
}

export function setAdminAuthenticated(value) {
  if (value) {
    sessionStorage.setItem(ADMIN_AUTH_KEY, '1');
  } else {
    sessionStorage.removeItem(ADMIN_AUTH_KEY);
  }
}

export function getExpectedAdminPassword() {
  const local = localStorage.getItem(ADMIN_PASSWORD_KEY);
  if (local && local.trim()) return local.trim();
  return (import.meta.env.VITE_ADMIN_PASSWORD || 'admin1234').trim();
}

export function setAdminPassword(nextPassword) {
  const normalized = String(nextPassword || '').trim();
  if (!normalized) return false;
  localStorage.setItem(ADMIN_PASSWORD_KEY, normalized);
  return true;
}

