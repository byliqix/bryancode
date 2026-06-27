import chalk from 'chalk';
import { state } from './state.js';

export function clearScreen() {
  process.stdout.write('\x1Bc');
}

export function hr(char = '─', color = chalk.dim) {
  console.log(color(char.repeat(process.stdout.columns || 80)));
}

export function elapsedTime() {
  const s = Math.floor((Date.now() - state.sessionStats.start) / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export function modelShortName(id) {
  return id.split('/').pop();
}

export function strip(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

const providerColor = { groq: '#ff6b6b', ollama: '#6bcfff' };

export function formatStatus() {
  const w = process.stdout.columns || 80;
  const tgt = state.target ? chalk.bold.red(state.target) : chalk.dim('no target');
  const model = chalk.bold.cyan(`${state.provider}/${modelShortName(state.currentModel)}`);
  const msgs = chalk.bold.yellow(String(state.sessionStats.messages));
  const time = chalk.bold.green(elapsedTime());
  const dot = chalk.dim('·');
  const skull = chalk.hex(providerColor[state.provider] || '#ff4444')('☠');

  const left = ` ${skull} ${model} ${dot} ${tgt} ${dot} ${msgs} msg${state.sessionStats.messages !== 1 ? 's' : ''} ${dot} ${time} `;
  const pad = Math.max(0, w - strip(left).length - 2);

  return (
    chalk.bgHex('#1a0a0a').hex('#550000')('▐') +
    chalk.bgHex('#1a0a0a')(left) +
    chalk.bgHex('#1a0a0a')(' '.repeat(pad)) +
    chalk.bgHex('#1a0a0a').hex('#550000')('▌')
  );
}

export function highlightCode(text) {
  return text.replace(/```(\w+)?\n?([\s\S]*?)```/g, (_, lang, code) => {
    const langLabel = lang
      ? chalk.bgHex('#1a0a0a').hex('#ff4444').bold(` ${lang} `)
      : chalk.bgHex('#1a0a0a').hex('#ff4444').bold(' cmd ');

    const langColor = {
      bash: chalk.hex('#ff6b6b'), sh: chalk.hex('#ff6b6b'),
      python: chalk.green, py: chalk.green,
      js: chalk.yellow, javascript: chalk.yellow,
      json: chalk.cyan, xml: chalk.cyan, html: chalk.cyan,
      sql: chalk.hex('#ff9944'),
      text: chalk.white,
    }[lang?.toLowerCase()] || chalk.hex('#ff9944');

    const border = chalk.dim('┃ ');
    const w = process.stdout.columns || 80;
    const formatted = code.trimEnd().split('\n')
      .map(line => `  ${border}${langColor(line)}`).join('\n');

    return (
      `\n  ${langLabel}\n` +
      chalk.dim('  ┌' + '─'.repeat(w - 4) + '\n') +
      formatted + '\n' +
      chalk.dim('  └' + '─'.repeat(w - 4)) + '\n'
    );
  });
}

export function printBanner() {
  const w = process.stdout.columns || 80;
  const inner = w - 2;

  const centerPad = (str, width) => {
    const vis = strip(str);
    const space = Math.max(0, width - vis.length);
    const l = Math.floor(space / 2);
    const r = space - l;
    return ' '.repeat(l) + str + ' '.repeat(r);
  };

  const BG = '#0d0000';
  const SIDE = chalk.hex('#880000');
  const line = (content = '') =>
    SIDE('║') + chalk.bgHex(BG)(centerPad(content, inner)) + SIDE('║');
  const edge = (a, b, c) => SIDE(a + b.repeat(inner) + c);

  const art = [
    chalk.hex('#ff2222').bold('██████╗ ██████╗ ██╗   ██╗ █████╗ ███╗  ██╗'),
    chalk.hex('#ff3333').bold('██╔══██╗██╔══██╗╚██╗ ██╔╝██╔══██╗████╗ ██║'),
    chalk.hex('#ff4444').bold('██████╔╝██████╔╝ ╚████╔╝ ███████║██╔██╗██║'),
    chalk.hex('#ff3333').bold('██╔══██╗██╔══██╗  ╚██╔╝  ██╔══██║██║╚████║'),
    chalk.hex('#ff2222').bold('██████╔╝██║  ██║   ██║   ██║  ██║██║ ╚███║'),
    chalk.hex('#cc0000').bold('╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚══╝'),
  ];

  const sub1 = chalk.hex('#880000')('☠  P E N T E S T   A I   T E R M I N A L  ☠');
  const sub2 = chalk.dim('for authorized security research only');
  const sub3 = chalk.dim('/help for commands  ·  /target <ip> to begin  ·  exit to quit');

  console.log();
  console.log(edge('╔', '═', '╗'));
  console.log(line());
  for (const artLine of art) {
    if (strip(artLine).length + 4 <= w) console.log(line(artLine));
  }
  console.log(line());
  console.log(line(sub1));
  console.log(line(sub2));
  console.log(line());
  console.log(line(sub3));
  console.log(line());
  console.log(edge('╚', '═', '╝'));
  console.log();
}
