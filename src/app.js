'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');

const config = require('./config');
const requestId = require('./middleware/requestId');
const requestLogger = require('./middleware/requestLogger');
const { globalLimiter } = require('./middleware/rateLimiter');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const { mountSwagger } = require('./docs/swagger');
const routes = require('./modules');

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(requestId);
app.use(requestLogger);
app.use(helmet());
app.use(cors({ origin: config.security.corsOrigins, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '1mb', verify: (req, res, buf) => { req.rawBody = buf.toString('utf8'); } }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(globalLimiter);

mountSwagger(app);
app.use(config.apiPrefix, routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
