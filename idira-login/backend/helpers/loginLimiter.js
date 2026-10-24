// Límite de intentos fallidos de login (en memoria): tras MAX fallos en la ventana, bloquea la
// combinación IP + usuario durante la misma ventana.
const MAX = 5;
const WINDOW_MS = 15 * 60 * 1000;

const fails = new Map();

const key = (ip, usuario) => `${ip}|${String(usuario).trim().toLowerCase()}`;

function blockedMinutes(ip, usuario) {
  const entry = fails.get(key(ip, usuario));
  if (!entry || entry.count < MAX) return 0;
  const left = entry.since + WINDOW_MS - Date.now();
  if (left <= 0) {
    fails.delete(key(ip, usuario));
    return 0;
  }
  return Math.ceil(left / 60000);
}

function registerFail(ip, usuario) {
  const k = key(ip, usuario);
  const entry = fails.get(k);
  if (!entry || Date.now() - entry.since > WINDOW_MS) fails.set(k, { count: 1, since: Date.now() });
  else entry.count += 1;
}

const reset = (ip, usuario) => fails.delete(key(ip, usuario));

module.exports = { blockedMinutes, registerFail, reset };
