import chalk from 'chalk';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import { CONFIG, PROVIDERS, GROQ_MODELS, OLLAMA_MODELS, CHEATSHEETS, getActiveModels, getOllamaConfig } from './config.js';
import { state } from './state.js';
import { streamResponse } from './ai.js';
import { checkOllama } from './ai.js';
import { saveReport, savePDF } from './report.js';
import { hr, clearScreen, printBanner, modelShortName, elapsedTime } from './ui.js';
import { autoExploit } from './exploit.js';
import { analyzeBurp } from './burp.js';

export const COMMANDS = {
  '/help'() {
    hr('─', chalk.red);
    console.log(chalk.bold.red('  ☠ BryanCode PenTest — Commands\n'));
    const cmds = [
      ['/target <ip>',    'Set current target (added to AI context)'],
      ['/cheat <cat>',    'Cheatsheet: recon | web | exploit | privesc | passwords'],
      ['/provider',       'Switch AI provider (Groq/Ollama)'],
      ['/model',          'Switch AI model'],
      ['/run <cmd>',      'Run a shell command & send output to AI for analysis'],
      ['/autoexploit',    'Auto scan + exploit plan (nmap → fuzz → searchsploit → AI)'],
      ['/img <url/file>', 'Send image for AI analysis (URL or local path)'],
      ['/burp <file>',    'Import Burp XML scan results for AI analysis'],
      ['/report [file]',  'Save session as Markdown/HTML report'],
      ['/pdf',            'Generate HTML report (buka browser → Ctrl+P → PDF)'],
      ['/history',        'Show conversation history'],
      ['/reset',          'Reset conversation context'],
      ['/clear',          'Clear screen + reset'],
      ['/stats',          'Session statistics'],
      ['/exit',           'Quit'],
    ];
    cmds.forEach(([cmd, desc]) => {
      console.log(`  ${chalk.red(cmd.padEnd(20))} ${chalk.dim(desc)}`);
    });
    hr('─', chalk.red);
  },

  '/target'(args) {
    if (!args) {
      console.log(chalk.dim(`\n  Current target: ${state.target || chalk.red('none')}\n`));
      return;
    }
    state.target = args.trim();
    console.log(chalk.green(`\n  ✓ Target set → ${chalk.bold.red(state.target)}\n`));
    state.conversationHistory.push({
      role: 'user', content: `[Target updated: ${state.target}]`
    });
    state.conversationHistory.push({
      role: 'assistant',
      content: `Understood. Target is now ${state.target}. I'll keep this in context for all subsequent commands and analysis.`
    });
  },

  '/cheat'(args) {
    const cat = args?.trim().toLowerCase();
    const sheet = CHEATSHEETS[cat];
    if (!sheet) {
      console.log(chalk.dim(`\n  Categories: ${Object.keys(CHEATSHEETS).join(' | ')}\n`));
      return;
    }
    hr('─', chalk.red);
    console.log(chalk.bold.red(`  ☠ Cheatsheet: ${cat.toUpperCase()}\n`));
    const tgt = state.target || '<target>';
    sheet.forEach(([label, cmd]) => {
      const filled = cmd.replace(/<target>/g, tgt);
      console.log(`  ${chalk.cyan(label.padEnd(18))} ${chalk.hex('#ff9944')(filled)}`);
    });
    hr('─', chalk.red);
  },

  async '/run'(args) {
    if (!args) {
      console.log(chalk.red('\n  Usage: /run <shell command>\n'));
      return;
    }
    console.log(chalk.dim(`\n  ⚡ Running: ${args}\n`));
    hr('─', chalk.dim);
    let output = '';
    try {
      output = execSync(args, { timeout: 30000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
      process.stdout.write(chalk.dim(output));
    } catch (e) {
      output = e.stdout || e.stderr || e.message;
      process.stdout.write(chalk.dim(output));
    }
    hr('─', chalk.dim);
    console.log(chalk.yellow('\n  → Sending output to AI for analysis...\n'));
    await streamResponse(
      `I ran: \`${args}\`\n\nOutput:\n\`\`\`\n${output.slice(0, 4000)}\n\`\`\`\n\nAnalyze this output. Identify key findings, open ports, vulnerabilities, or attack vectors. Recommend concrete next steps.`
    );
  },

  '/report'(args) {
    try {
      const file = saveReport(args);
      console.log(chalk.green(`\n  ✓ Report saved → ${file}\n`));
    } catch (e) {
      console.log(chalk.red(`\n  ✗ Failed: ${e.message}\n`));
    }
  },

  '/pdf'() {
    try {
      const { htmlFile, pdfFile } = savePDF();
      console.log(chalk.green(`\n  ✓ HTML report → ${htmlFile}\n`));
      console.log(chalk.dim(`  ℹ Buka file HTML di browser, tekan Ctrl+P, simpan sebagai PDF:\n`));
      console.log(chalk.cyan(`    ${pdfFile}\n`));
    } catch (e) {
      console.log(chalk.red(`\n  ✗ Failed: ${e.message}\n`));
    }
  },

  async '/autoexploit'(args) {
    const target = args || state.target;
    await autoExploit(target);
  },

  async '/img'(args) {
    if (!args) {
      console.log(chalk.red('\n  Usage: /img <url> or /img <path> [question]\n'));
      return;
    }
    await streamResponse(args);
  },

  async '/burp'(args) {
    await analyzeBurp(args);
  },

  async '/provider'() {
    hr('─', chalk.red);
    console.log(chalk.bold.red('  Select Provider:\n'));
    Object.entries(PROVIDERS).forEach(([key, p]) => {
      const active = p.id === state.provider ? chalk.green(' ← active') : '';
      console.log(`  ${chalk.red(key + '.')} ${p.label}${active}`);
    });
    console.log();
    const { choice } = await inquirer.prompt([{
      type: 'input', name: 'choice',
      message: chalk.red('  Provider [1-2]: '),
    }]);
    const selected = PROVIDERS[choice.trim()];
    if (selected && selected.id !== state.provider) {
      if (selected.id === 'ollama') {
        const cfg = getOllamaConfig();
        const isRemote = !cfg.baseURL.includes('localhost') && !cfg.baseURL.includes('127.0.0.1');

        const status = await checkOllama();
        if (!status.running) {
          console.log(chalk.red(`\n  ✗ Cannot reach ${cfg.baseURL}. Check your connection & API key.\n`));
          hr('─', chalk.red);
          return;
        }
        if (status.models.length === 0) {
          console.log(chalk.yellow('\n  ⚠ No models available on this endpoint.\n'));
          hr('─', chalk.red);
          return;
        }

        state.currentModel = cfg.defaultModel;
        if (!status.models.includes(cfg.defaultModel)) {
          state.currentModel = status.models[0];
        }

        console.log(chalk.green(`\n  ✓ ${isRemote ? 'Remote' : 'Local'} Ollama — ${status.models.length} models available`));
        console.log(chalk.dim(`    Active model: ${state.currentModel}\n`));
      }
      state.provider = selected.id;
      state.conversationHistory = [];
      console.log(chalk.green(`  ✓ Switched to ${selected.id}\n`));
    } else if (selected) {
      console.log(chalk.dim('\n  Already active\n'));
    } else {
      console.log(chalk.red('  ✗ Invalid\n'));
    }
    hr('─', chalk.red);
  },

  async '/model'() {
    let models = getActiveModels(state.provider);

    if (state.provider === 'ollama') {
      hr('─', chalk.dim);
      console.log(chalk.dim('  ⟳ Fetching available models...\n'));
      const status = await checkOllama();
      if (status.running && status.models.length > 0) {
        models = {};
        let idx = 0;
        status.models.forEach(m => {
          if (state.paidModels.has(m)) return;
          idx++;
          models[String(idx)] = { id: m, label: m };
        });
        if (idx < status.models.length) {
          console.log(chalk.yellow(`  ⚠ ${status.models.length - idx} model(s) butuh subscription (disembunyikan)\n`));
        }
      }
    }

    if (Object.keys(models).length === 0) {
      console.log(chalk.red('\n  ✗ No free models available\n'));
      hr('─', chalk.red);
      return;
    }

    hr('─', chalk.red);
    console.log(chalk.bold.red(`  Select Model (${state.provider}):\n`));
    Object.entries(models).forEach(([key, m]) => {
      const active = m.id === state.currentModel ? chalk.green(' ← active') : '';
      console.log(`  ${chalk.red(key + '.')} ${m.label}${active}`);
    });
    console.log();
    const count = Object.keys(models).length;
    const { choice } = await inquirer.prompt([{
      type: 'input', name: 'choice',
      message: chalk.red(`  Model [1-${count}]: `),
    }]);
    const selected = models[choice.trim()];
    if (selected) {
      state.currentModel = selected.id;
      state.conversationHistory = [];
      console.log(chalk.green(`\n  ✓ Switched to ${selected.label.trim()}\n`));
    } else {
      console.log(chalk.red('  ✗ Invalid\n'));
    }
    hr('─', chalk.red);
  },

  '/history'() {
    if (state.conversationHistory.length === 0) {
      console.log(chalk.dim('\n  No history\n'));
      return;
    }
    hr('─', chalk.dim);
    state.conversationHistory.forEach((msg, i) => {
      const icon = msg.role === 'user' ? chalk.cyan('  You') : chalk.red('  AI ');
      const preview = msg.content.slice(0, 100).replace(/\n/g, ' ');
      console.log(`${icon} ${chalk.dim(`[${i + 1}]`)} ${preview}${msg.content.length > 100 ? chalk.dim('…') : ''}`);
    });
    hr('─', chalk.dim);
  },

  '/reset'() {
    state.conversationHistory = [];
    console.log(chalk.yellow('\n  ✓ Context reset\n'));
  },

  '/clear'() {
    state.conversationHistory = [];
    clearScreen();
    printBanner();
  },

  '/stats'() {
    hr('─', chalk.red);
    console.log(chalk.bold.red('  Session Stats\n'));
    console.log(`  ${'Provider'.padEnd(16)} ${chalk.hex(state.provider === 'ollama' ? '#6bcfff' : '#ff6b6b')(state.provider)}`);
    console.log(`  ${'Model'.padEnd(16)} ${chalk.cyan(modelShortName(state.currentModel))}`);
    console.log(`  ${'Target'.padEnd(16)} ${chalk.red(state.target || 'none')}`);
    console.log(`  ${'Messages'.padEnd(16)} ${chalk.yellow(state.sessionStats.messages)}`);
    console.log(`  ${'Context'.padEnd(16)} ${chalk.yellow(state.conversationHistory.length)} msgs`);
    console.log(`  ${'Session time'.padEnd(16)} ${chalk.green(elapsedTime())}`);
    hr('─', chalk.red);
  },
};
