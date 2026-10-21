// Lee el certificado de firma del IdP. Acepta PEM (-----BEGIN CERTIFICATE-----), base64 plano
// o DER binario (el .cer que a veces descargan los portales).
const fs = require('fs');

module.exports = function readCertificate(file) {
  const buf = fs.readFileSync(file);
  const text = buf.toString('utf8');
  if (text.includes('BEGIN CERTIFICATE')) return text;
  if (/^[A-Za-z0-9+/=\s]+$/.test(text)) return text.replace(/\s+/g, '');
  return buf.toString('base64');
};
