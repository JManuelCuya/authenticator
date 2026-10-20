const session = require('express-session');
const config = require('../config');

module.exports = session({
  name: 'app.sid',
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isHttps,
    maxAge: 8 * 60 * 60 * 1000,
  },
});
