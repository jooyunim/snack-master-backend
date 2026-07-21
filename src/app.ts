import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import logger from './config/logger';
import morgan from 'morgan';

import { HttpError } from './middlewares/HttpError';
import errorMiddleware from './middlewares/error.middleware';
import authRouter from './modules/auth/auth.router';

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// HTTP 요청 로그를 Winston으로 전달
const morganFormat =
  process.env.NODE_ENV === 'production' ? 'combined' : 'tiny';
app.use(
  morgan(morganFormat, {
    stream: { write: (message) => logger.http(message.trim()) },
  })
);

app.use(express.json());
app.use(cookieParser());

// 라우터 등록
app.use('/auth', authRouter);

app.get('/', (req, res) => {
  res.json({ message: '안녕하세요' });
});

app.use((req, res, next) => {
  next(new HttpError(404, '요청하신 경로를 찾을 수 없습니다.'));
});

app.use(errorMiddleware);

export default app;
