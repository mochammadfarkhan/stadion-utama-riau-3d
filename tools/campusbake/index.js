#!/usr/bin/env node
/** Entry CLI: `npm run bake:campus -- <boundary|terrain|ground|buildings|all> [--offline]` (lihat cli.js). */
import process from 'node:process';
import { main } from './cli.js';

process.exitCode = await main(process.argv.slice(2));
