const AUTH_CONFIG = {
  expectedUser: 'ymargaria@grupoorono.com.ar',
  passwordHash: '17be33037dca00291e22adeca12afaaa66dad61090ae094a27f26950ac8d3426',
  sessionKey: 'uic_auth',
  tokenValue: 'authenticated'
};

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function login(user, password) {
  if (user.trim().toLowerCase() !== AUTH_CONFIG.expectedUser) return false;
  const hash = await hashPassword(password);
  if (hash === AUTH_CONFIG.passwordHash) {
    sessionStorage.setItem(AUTH_CONFIG.sessionKey, AUTH_CONFIG.tokenValue);
    return true;
  }
  return false;
}

function isAuthenticated() {
  return sessionStorage.getItem(AUTH_CONFIG.sessionKey) === AUTH_CONFIG.tokenValue;
}

function logout() {
  sessionStorage.removeItem(AUTH_CONFIG.sessionKey);
  window.location.href = 'index.html';
}

function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}
