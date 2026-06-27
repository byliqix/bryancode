#!/usr/bin/env node

import dotenv from 'dotenv';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { state } from './state.js';
import { COMMANDS } from './cli.js';
import { streamResponse } from './ai.js';
import { saveReport } from './report.js';
import { hr, clearScreen, printBanner, formatStatus } from './ui.js';

dotenv.config();

async function main() {
  if (!process.env.GROQ_API_KEY) {
    console.log(chalk.yellow('ℹ GROQ_API_KEY tidak ditemukan — hanya bisa pake Ollama (lokal)\n'));
  }

  clearScreen();
  printBanner();

  while (true) {
    console.log(formatStatus());

    const { prompt } = await inquirer.prompt([{
      type: 'input',
      name: 'prompt',
      message: chalk.bold.red('  ❯ '),
      prefix: '',
    }]);

    const input = prompt.trim();
    if (!input) continue;

    if (['exit', 'quit', 'keluar', '/exit'].includes(input.toLowerCase())) {
      if (state.conversationHistory.length > 0) {
        try {
          const f = saveReport();
          console.log(chalk.dim(`\n  Report auto-saved → ${f}`));
        } catch {}
      }
      hr('═', chalk.red);
      console.log(chalk.bold.red('  ☠ BryanCode signing off. Stay legal. ✌\n'));
      hr('═', chalk.red);
      process.exit(0);
    }

    if (input.startsWith('/')) {
      const parts = input.split(' ');
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1).join(' ') || null;
      const handler = COMMANDS[cmd];

      if (handler) {
        await handler(args);
      } else {
        console.log(chalk.red(`\n  ✗ Unknown command: ${cmd}  (try /help)\n`));
      }
      continue;
    }

    try {
      await streamResponse(input);
    } catch (err) {
      hr('─', chalk.red);
      console.log(chalk.red(`  ✗ ${err.message}`));
      if (err.status === 401) console.log(chalk.yellow('  → Check GROQ_API_KEY in .env\n'));
      if (err.status === 429) console.log(chalk.yellow('  → Rate limited. Wait a moment.\n'));
      hr('─', chalk.red);
    }
  }
}

main();
