#!/usr/bin/env node
/** Entry CLI: `node tools/citybake --area stadion|pusat|all` (lihat cli.js). */
import process from 'node:process';
import { main } from './cli.js';

process.exitCode = await main(process.argv.slice(2));
