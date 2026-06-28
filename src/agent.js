import chalk from 'chalk';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import { state } from './state.js';
import { streamResponse } from './ai.js';
import { hr } from './ui.js';

const ATTACK_PROMPT = `Kamu adalah AI penetration testing agent otonom. Tugasmu adalah mengexploit target secara bertahap.

ATURAN:
1. Setelah setiap langkah, kamu akan MENDAPATKAN OUTPUT dari command yang dijalankan
2. Analisis output tersebut dan tentukan langkah selanjutnya
3. Keluarkan command dalam format code block \`\`\`bash (tanpa markdown berlebih)
4. Jelaskan APA yang kamu lakukan dan MENGAPA sebelum memberikan command
5. Jika dapat shell/akses, beri tahu user dan tampilkan informasi yang ditemukan
6. Lanjutkan sampai target terkontrol penuh atau user menghentikan

CONTOH RESPON:
Analisis: [analisis hasil scan]
Langkah selanjutnya: [penjelasan]

\`\`\`bash
command yang akan dijalankan
\`\`\``;

function extractCommands(text) {
  const cmds = [];
  const regex = /```(?:bash|sh|shell|powershell|cmd)?\n?([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const cmd = match[1].trim();
    if (cmd && !cmd.startsWith('#') && !cmd.startsWith('//')) {
      cmds.push(cmd);
    }
  }
  return cmds;
}

async function runWithConfirm(cmd) {
  console.log(chalk.dim(`\n$ ${cmd}\n`));
  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: chalk.yellow('  Run this command?'),
    default: false,
  }]);
  if (!confirm) {
    console.log(chalk.dim('  ⏭ Skipped\n'));
    return null;
  }
  hr('─', chalk.dim);
  try {
    const out = execSync(cmd, { timeout: 60000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    process.stdout.write(chalk.white(out));
    return out;
  } catch (e) {
    const err = (e.stdout || e.stderr || e.message).slice(0, 2000);
    process.stdout.write(chalk.dim(err));
    return err;
  }
}

export async function attackLoop(target) {
  if (!target) {
    console.log(chalk.red('\n  ✗ Target tidak ada. Set dulu: /attack <ip>\n'));
    return;
  }

  state.target = target;
  console.log(chalk.green(`\n  ✓ Target: ${chalk.bold.red(target)}\n`));
  console.log(chalk.yellow('  ⚠ Mode otonom — AI akan menyarankan command, kamu konfirmasi sebelum dijalankan\n'));

  // Phase 1: Initial recon
  hr('─', chalk.dim);
  console.log(chalk.bold.cyan('  [Recon] Scanning target...\n'));

  const nmapCmd = `nmap -sV -sC --top-ports 1000 -T4 --open ${target}`;
  console.log(chalk.dim(`  $ ${nmapCmd}\n`));

  let nmapOut = '';
  try {
    nmapOut = execSync(nmapCmd, { timeout: 120000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    process.stdout.write(chalk.dim(nmapOut.slice(0, 1500)));
  } catch (e) {
    nmapOut = e.stdout || e.stderr || e.message;
    process.stdout.write(chalk.dim(nmapOut.slice(0, 1500)));
  }

  // Phase 2: Start interactive attack loop
  let context = `Target: ${target}\n\nInitial nmap scan results:\n\`\`\`\n${nmapOut.slice(0, 4000)}\n\`\`\``;
  let step = 0;
  const maxSteps = 20;

  while (step < maxSteps) {
    step++;
    hr('═', chalk.red);
    console.log(chalk.bold.red(`  ☠ Attack Step ${step}/${maxSteps}\n`));

    const response = await streamResponse(`${ATTACK_PROMPT}\n\n${context}\n\nApa langkah exploitation selanjutnya? Berikan command yang spesifik.`);

    const commands = extractCommands(response);
    if (commands.length === 0) {
      console.log(chalk.yellow('\n  ⚠ Tidak ada command yang ditemukan. AI mungkin sedang menganalisis.\n'));
      const { cont } = await inquirer.prompt([{
        type: 'confirm', name: 'cont',
        message: chalk.yellow('  Lanjut ke langkah berikutnya?'),
        default: true,
      }]);
      if (!cont) break;
      context = 'AI tidak memberikan command. Lanjutkan analisis dan berikan exploitation command.';
      continue;
    }

    let allOutput = '';
    for (const cmd of commands) {
      const out = await runWithConfirm(cmd);
      if (out !== null) {
        allOutput += `$ ${cmd}\n${out.slice(0, 3000)}\n`;
      }
    }

    // Check if we should stop
    const { cont } = await inquirer.prompt([{
      type: 'confirm', name: 'cont',
      message: chalk.yellow('  Lanjut exploitation?'),
      default: true,
    }]);
    if (!cont) break;

    context = `Langkah exploitation sebelumnya:\n${allOutput.slice(0, 5000)}\n\nAnalisis hasil ini dan berikan exploitation command selanjutnya.`;
  }

  hr('═', chalk.red);
  console.log(chalk.bold.red('  ☠ Attack session selesai\n'));
}
