// Nombres legibles de los mecanismos de autenticación que Idira puede pedir
const LABELS = {
  UP: 'Contraseña',
  OTP: 'Notificación en la app CyberArk/Idira',
  OATH: 'Código de app autenticadora',
  SMS: 'Código por SMS',
  EMAIL: 'Código por correo',
  PF: 'Llamada telefónica',
  SQ: 'Pregunta de seguridad',
  RADIUS: 'Código RADIUS',
};

const mechanismLabel = (m) => m.PromptSelectMech || LABELS[m.Name] || m.Name;

// Push y enlaces: Idira primero debe enviarlos (StartOOB)
const isOutOfBand = (answerType) => answerType === 'StartOob' || answerType === 'StartTextOob';

module.exports = { mechanismLabel, isOutOfBand };
