#!/usr/bin/env node
import { startServer } from '../server';

startServer().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
