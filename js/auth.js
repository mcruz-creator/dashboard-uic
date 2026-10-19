const AUTH_USERS = [
  { email: 'ymargaria@grupoorono.com.ar', hash: '17be33037dca00291e22adeca12afaaa66dad61090ae094a27f26950ac8d3426' },
  { email: 'mcruz@grupoorono.com.ar', hash: '4e72b4c644a931a2f3a66bd7ebd6cc799eb6fb9e1afc9fc0ead61d0bd8fd8f6e' }
];

const AUTH_CONFIG = {
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
  const email = user.trim().toLowerCase();
  const found = AUTH_USERS.find(u => u.email === email);
  if (!found) return false;
  const hash = await hashPassword(password);
  if (hash === found.hash) {
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
