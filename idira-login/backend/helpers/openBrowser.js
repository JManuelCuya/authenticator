// En local abre el navegador automáticamente; en el VPS (https / dominio) no hace nada
const { exec } = require('child_process');

module.exports = (url) => {
  if (!/^http:\/\/(localhost|127\.0\.0\.1)/.test(url)) return;
  const cmd = { win32: `start "" "${url}"`, darwin: `open "${url}"` }[process.platform] || `xdg-open "${url}"`;
  exec(cmd, () => {});
};
