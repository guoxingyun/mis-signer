import * as express from 'express';
import * as cors from 'cors';
import * as morgan from 'morgan';
import * as bodyParser from 'body-parser';

import wallet from './wallet';
import adex from './adex';
import admin from './admin';
import express_exchange from './express';
import mist_config from './cfg';
import {responseTime} from './middleware/ResponseTime';
import {customHeader} from './middleware/CustomHeader';
import { ErrorHandle } from './middleware/ErrorHandle'

const app = express();

// 3rd party middleware
// logger
app.use(morgan('dev'));
app.use( cors({ exposedHeaders: ['Link'] }));
app.use( bodyParser.json({limit: '100kb' }));

// internal middleware
app.all('*', customHeader());
app.use(responseTime());

// api router
app.use('/wallet', wallet());
app.use('/adex', adex());
app.use('/express', express_exchange());
app.use('/admin', admin());

// 处理异常捕获, 需要在路由设置后设置有效
app.use(ErrorHandle)

const serverPort = process.env.PORT || mist_config.mist_server_port;
app.listen(serverPort, () => {
  console.log(`Started on port: ${serverPort}`);
});

// application specific logging, throwing an error, or other logic here
process.on('unhandledRejection', (reason, p) => {
  console.log('[Mist Signer] Unhandled Rejection at: Promise , reason:', reason);
});

export default app;
