import chalk from 'chalk';
import * as fs from 'fs';
import { SPLAT } from 'triple-beam';
import * as util from 'util';
import * as winston from 'winston';
require('winston-daily-rotate-file');

const createLogger: CreateLogger = function ({
  logPath,
}) {
  (function logPathShouldBePresent() {
    if (!fs.existsSync(logPath)){
      fs.mkdirSync(logPath);
    }
  })();
  
  const consoleLogger = new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.colorize(),
      printf,
    ),
    level: 'debug',
  });
  
  const dailyRotateFileLogger = new winston.transports['DailyRotateFile']({
    datePattern: 'YYYY-MM-DD',
    dirname: logPath,
    filename: 'app-%DATE%.log',
    format: winston.format.combine(
      ignoreConsoleOnly(),
      winston.format.timestamp(),
      winston.format.json(),
    ),
    level: 'error',
    prepend: false,
  });
  
  const winstonLogger = winston.createLogger({
    transports: [
      consoleLogger,
      dailyRotateFileLogger,
    ],
  });

  const enhancedLogger = withWith(winstonLogger);
  printLevels(enhancedLogger);
  return enhancedLogger;
};

const printf = winston.format.printf(({
  colorFunction,
  level,
  tag = 'default',
  timestamp,
  message,
  [SPLAT]: splat = [],
}) => {
  try {
    let translatedMessage = '';
    if (isArray(message)) {
      const [ format, ...params ] = message;
      translatedMessage = util.format(format, ...params);
    } else {
      translatedMessage = util.format(message, ...splat);
    }

    const coloredTag = colorFunction ? colorFunction(tag) : tag;
    return `${timestamp} ${level}: [${coloredTag}] ${translatedMessage}`;
  } catch (err) {
    console.error(err);
    return `${timestamp} ${level}: [ERROR_ON_LOGGING] ${message}`;
  }
});

const ignoreConsoleOnly = winston.format((info, opts) => {
  return info.consoleOnly ? false : info;
});

function withWith(logger) {
  if (logger.with !== undefined) {
    console.warn('[node-logger] winston.with is overwritten by custom with(). Contact the author to either rename the props or remove it.' );
  }

  Object.defineProperty(logger, 'with', {
    enumerable: true,
    value: function ({
      colorFunction,
      tag,
    }) {
      console.log('[node-logger] logger is regsitered with tag: %s, having colorFunction: %s', tag, !!colorFunction);

      const that = this;
      const obj = {};
      
      Object.keys(that.levels)
        .forEach((level) => {
          obj[level] = function (format, ...params) {
            that[level]({
              colorFunction,
              message: [ format, ...params ],
              tag,
            });
          };
        });
      return obj;
    },
  });
  return logger;
}

export {
  createLogger,
};

function isArray(src: any) {
  return src.constructor === Array;  
}

function printLevels(logger: winston.Logger) {
  const levels = Object.keys(logger.levels).join(' ');
  console.log('[node-logger] default levels: %s', levels);
}

interface CreateLogger {
  (props: {
    logPath: string;
  }): winston.Logger & EnhancedLogger;
}

interface EnhancedLogger {
  with (arg: {
    colorFunction: Function;
    tag: string;
  }): winston.Logger;
}
