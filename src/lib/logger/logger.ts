import winston from "winston";
import { devTransport, prodConsoleTransport, getFileTransport } from "./transports";
import { serverEnv } from "@/lib/env";

const isDev = serverEnv.NODE_ENV !== "production";

const logLevel = process.env.LOG_LEVEL ?? (isDev ? "debug" : "info");

function buildTransports(): winston.transport[] {
  if (isDev) return [devTransport];
  const list: winston.transport[] = [prodConsoleTransport];
  const fileTransport = getFileTransport();
  if (fileTransport) list.push(fileTransport);
  return list;
}

export const logger = winston.createLogger({
  level: logLevel,
  transports: buildTransports(),
});
