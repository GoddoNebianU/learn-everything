import { transports, format } from "winston";
import fs from "node:fs";
import path from "node:path";

const { combine, timestamp, printf, colorize, json } = format;

const customFormat = printf(({ level, message, timestamp, ...metadata }) => {
  const cleanMeta = Object.fromEntries(
    Object.entries(metadata).filter(([key]) => typeof key === "string")
  );
  const metaStr = Object.keys(cleanMeta).length ? JSON.stringify(cleanMeta) : "";
  return `${timestamp} [${level}]: ${message} ${metaStr}`;
});

export const devTransport = new transports.Console({
  format: combine(colorize(), timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), customFormat),
});

export const prodConsoleTransport = new transports.Console({
  format: combine(timestamp(), json()),
});

function createFileTransport(): transports.FileTransportInstance | null {
  try {
    const logDir = process.env.LOG_FILE_DIR || path.join(process.cwd(), "logs");
    fs.mkdirSync(logDir, { recursive: true });
    return new transports.File({
      filename: path.join(logDir, "app.log"),
      format: combine(timestamp(), json()),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    });
  } catch {
    return null;
  }
}

let _fileTransport: transports.FileTransportInstance | null | undefined;

export function getFileTransport(): transports.FileTransportInstance | null {
  if (_fileTransport === undefined) {
    _fileTransport = createFileTransport();
  }
  return _fileTransport;
}
