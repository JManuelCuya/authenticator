// Lógica del login con Idira. No conoce Express: recibe el "flow" (estado del login en curso,
// guardado en la sesión), lo actualiza y devuelve un resultado con el siguiente paso:
//   success | mfa (elegir factor) | code (pedir código) | wait (esperar push) | error
const idira = require('../../integrations/idira.client');
const { mechanismLabel, isOutOfBand } = require('../../helpers/mechanisms');

const currentMechanisms = (flow) => (flow.challenges[flow.index] || {}).Mechanisms || [];

// Traduce la respuesta de AdvanceAuthentication al siguiente paso
function interpret(flow, result) {
  switch (result.Summary) {
    case 'LoginSuccess':
      return {
        status: 'success',
        user: {
          usuario: result.User,
          nombre: result.DisplayName,
          correo: result.EmailAddress,
          id: result.UserId,
          validado: new Date().toISOString(),
        },
      };
    case 'StartNextChallenge':
      flow.index += 1;
      flow.mech = null;
      return { status: 'mfa' };
    case 'NewPackage':
      flow.challenges = result.Challenges || [];
      flow.index = 0;
      flow.mech = null;
      return { status: 'mfa' };
    case 'OobPending':
      return { status: 'wait' };
    default:
      return { status: 'error', message: result.Message || 'Idira rechazó la autenticación.' };
  }
}

// Paso 1: usuario y contraseña. Si el primer desafío es la contraseña se responde con la ingresada.
async function login(username, password) {
  const { host, sessionId, challenges } = await idira.startAuthentication(username.trim());
  const flow = { host, sessionId, challenges, index: 0, mech: null };

  const up = currentMechanisms(flow).find((m) => m.Name === 'UP');
  if (!up) return { flow, outcome: { status: 'mfa' } };

  const result = await idira.advanceAuthentication(host, sessionId, up.MechanismId, 'Answer', password);
  return { flow, outcome: interpret(flow, result) };
}

// Factores que Idira ofrece en el desafío actual
function listMechanisms(flow) {
  return currentMechanisms(flow).map((m) => ({ id: m.MechanismId, label: mechanismLabel(m), primary: m.Name === 'UP' }));
}

async function chooseMechanism(flow, mechanismId) {
  const mech = currentMechanisms(flow).find((m) => m.MechanismId === mechanismId);
  if (!mech) return { status: 'mfa' };
  flow.mech = { id: mech.MechanismId, label: mechanismLabel(mech), answerType: mech.AnswerType };

  if (!isOutOfBand(mech.AnswerType)) return { status: 'code' };

  const result = await idira.advanceAuthentication(flow.host, flow.sessionId, mech.MechanismId, 'StartOOB');
  if (result.Summary !== 'OobPending') return interpret(flow, result);
  // StartTextOob: llega un código (correo/SMS) que también puede aprobarse por enlace
  return { status: mech.AnswerType === 'StartTextOob' ? 'code' : 'wait' };
}

async function answer(flow, code) {
  const result = await idira.advanceAuthentication(flow.host, flow.sessionId, flow.mech.id, 'Answer', code);
  return interpret(flow, result);
}

async function poll(flow) {
  const result = await idira.advanceAuthentication(flow.host, flow.sessionId, flow.mech.id, 'Poll');
  return interpret(flow, result);
}

module.exports = { login, listMechanisms, chooseMechanism, answer, poll };
