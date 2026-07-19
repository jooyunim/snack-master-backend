import fs from 'fs';
import path from 'path';
import winston from 'winston';

const isProd = process.env.NODE_ENV === 'production';

const logDir = path.join(process.cwd(), 'logs');

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// HTTP 상태 코드에 따라 색 설정 (콘솔용)
const colorizeStatus = (msg: string) => {
  return msg.replace(/\b(\d{3})\b/, (m, code) => {
    const n = Number(code);
    if (n >= 500) return `\x1b[31m${code}\x1b[0m`; // 빨강
    if (n >= 400) return `\x1b[33m${code}\x1b[0m`; // 노랑
    if (n >= 300) return `\x1b[36m${code}\x1b[0m`; // 청록
    if (n >= 200) return `\x1b[32m${code}\x1b[0m`; // 초록
    return code;
  });
};

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    const lvlColor =
      level === 'error'
        ? '\x1b[31m'
        : level === 'http'
          ? '\x1b[35m'
          : '\x1b[37m';
    const text = String(stack || message);
    return `${timestamp} ${lvlColor}${level}\x1b[0m: ${colorizeStatus(text)}`;
  })
);

// 파일용: 색상 없는 깔끔한 JSON
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.uncolorize(),
  winston.format.json()
);

const transports: winston.transport[] = [
  new winston.transports.Console({ format: consoleFormat }),
];

// 로컬에서만 파일로 저장 — Render 등은 파일이 휘발성이라 콘솔만 사용
if (!isProd) {
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: fileFormat,
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: fileFormat,
    })
  );
}

const logger = winston.createLogger({
  level: isProd ? 'http' : 'debug',
  transports,
});

export default logger;
