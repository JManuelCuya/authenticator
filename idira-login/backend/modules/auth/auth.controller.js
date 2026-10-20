// Controlador: traduce HTTP <-> servicio. Lee el formulario, llama al servicio y decide qué vista
// o redirección responder según el resultado.
const authService = require('./auth.service');

const NEXT_STEP = { mfa: '/auth/mfa', code: '/auth/mfa/codigo', wait: '/auth/mfa/esperar' };

function respond(req, res, next, outcome) {
  if (outcome.status === 'success') {
    // Sesión nueva tras autenticar (evita session fixation)
    return req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = outcome.user;
      res.redirect('/');
    });
  }
  if (NEXT_STEP[outcome.status]) return res.redirect(NEXT_STEP[outcome.status]);

  req.session.flow = null;
  res.status(401).render('auth/login', { error: outcome.message, username: '' });
}

const showLogin = (req, res) => res.render('auth/login', { error: '', username: '' });

async function login(req, res, next) {
  const { username = '', password = '' } = req.body;
  if (!res.locals.idira.configured) return res.render('auth/login', { error: '', username });

  const { flow, outcome } = await authService.login(username, password);
  req.session.flow = flow;
  respond(req, res, next, outcome);
}

const showMfa = (req, res) =>
  res.render('auth/mfa-select', { mechanisms: authService.listMechanisms(req.session.flow) });

async function chooseMechanism(req, res, next) {
  const outcome = await authService.chooseMechanism(req.session.flow, req.body.id);
  respond(req, res, next, outcome);
}

const showCode = (req, res) => res.render('auth/mfa-code', { mech: req.session.flow.mech });

async function submitCode(req, res, next) {
  const outcome = await authService.answer(req.session.flow, req.body.code || '');
  respond(req, res, next, outcome);
}

const showWait = (req, res) => res.render('auth/mfa-wait', { mech: req.session.flow.mech });

async function poll(req, res, next) {
  const outcome = await authService.poll(req.session.flow);
  respond(req, res, next, outcome);
}

function logout(req, res) {
  req.session.destroy(() => {
    res.clearCookie('app.sid');
    res.redirect('/auth/login');
  });
}

module.exports = { showLogin, login, showMfa, chooseMechanism, showCode, submitCode, showWait, poll, logout };
