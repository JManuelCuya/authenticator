// Arma la app Express: vistas, estáticos, middlewares y módulos
const express = require('express');
const config = require('./config');
const session = require('./middlewares/session');
const viewLocals = require('./middlewares/viewLocals');
const { notFound, errorHandler } = require('./middlewares/errorHandler');
const authRoutes = require('./modules/auth/auth.routes');
const samlRoutes = require('./modules/saml/saml.routes');
const localAuthRoutes = require('./modules/local-auth/local-auth.routes');
const migrationRoutes = require('./modules/migration/migration.routes');
const homeRoutes = require('./modules/home/home.routes');

const app = express();

app.set('trust proxy', 1); // detrás de Nginx
app.set('view engine', 'ejs');
app.set('views', config.paths.views);

app.use(express.static(config.paths.public));
app.use(express.urlencoded({ extended: false }));
app.use(session);
app.use(viewLocals);

app.use('/auth/saml', samlRoutes);
app.use('/auth/local', localAuthRoutes);
app.use('/auth', authRoutes);
app.use('/admin/migracion', migrationRoutes);
app.use('/', homeRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
