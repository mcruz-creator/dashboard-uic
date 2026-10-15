const AUTH_CONFIG = {
  // SHA-256 hash of the password — generate with:
  // echo -n "password" | shasum -a 256
  // or: crypto.subtle.digest('SHA-256', new TextEncoder().encode('password'))
  passwordHash: 'PLACEHOLDER_HASH_HERE',
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

async function login(password) {
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
