import type { Server } from 'node:http';
import { createApp } from './app.js';
import { ConfigError, loadConfig } from './config/env.js';
import { createLogger } from './lib/logger.js';
import { createPrismaClient } from './lib/prisma.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

function start(): void {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    // Names of invalid variables only; values are never printed.
    console.error(error instanceof ConfigError ? error.message : 'Failed to load configuration.');
    process.exit(1);
  }

  const logger = createLogger(config);
  const prisma = createPrismaClient(config.databaseUrl);
  const app = createApp({ config, prisma, logger });

  // Migrations are never run here; they are applied manually before deploying (ADR-0011).
  const server: Server = app.listen(config.port, () => {
    logger.info({ port: config.port, env: config.nodeEnv }, 'API listening');
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down');

    const forceExit = setTimeout(() => {
      logger.error('shutdown timed out, exiting');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    // Stop accepting connections and wait for in-flight requests, then close the database pool.
    server.close(() => {
      prisma
        .$disconnect()
        .catch((error: unknown) => logger.error({ err: error }, 'error while disconnecting from the database'))
        .finally(() => {
          logger.info('shutdown complete');
          logger.flush();
          process.exit(0);
        });
    });
    server.closeIdleConnections();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();
