import fs from 'fs';
import chalk from 'chalk';
import { state } from './state.js';
import { streamResponse } from './ai.js';
import { hr } from './ui.js';

function parseBurpXML(xml) {
  const issues = [];
  const issueRegex = /<issue>([\s\S]*?)<\/issue>/g;
  const extract = (block, tag) => {
    const m = block.match(new RegExp(`<${tag}>([^<]*)<\\/${tag}>`));
    return m ? m[1].trim() : '';
  };

  let match;
  while ((match = issueRegex.exec(xml)) !== null) {
    const block = match[1];
    issues.push({
      name: extract(block, 'name'),
      host: extract(block, 'host'),
      path: extract(block, 'path'),
      severity: extract(block, 'severity'),
      confidence: extract(block, 'confidence'),
      detail: extract(block, 'issueDetail'),
      remediation: extract(block, 'remediationDetail'),
      background: extract(block, 'issueBackground'),
    });
  }
  return issues;
}

export async function analyzeBurp(filePath) {
  if (!filePath) {
    console.log(chalk.red('\n  Usage: /burp <file.xml>\n'));
    return;
  }

  if (!fs.existsSync(filePath)) {
    console.log(chalk.red(`\n  ✗ File not found: ${filePath}\n`));
    return;
  }

  hr('─', chalk.dim);
  console.log(chalk.bold.cyan('  [1/2] Parsing Burp XML...\n'));

  const xml = fs.readFileSync(filePath, 'utf-8');
  const issues = parseBurpXML(xml);

  if (issues.length === 0) {
    console.log(chalk.yellow('  ⚠ No issues found in XML\n'));
    return;
  }

  const bySeverity = { High: 0, Medium: 0, Low: 0, Info: 0, Information: 0 };
  issues.forEach(i => {
    const s = i.severity;
    if (s in bySeverity) bySeverity[s]++;
    else bySeverity[s] = 1;
  });

  console.log(chalk.green(`  ✓ Found ${issues.length} issues:\n`));
  for (const [sev, count] of Object.entries(bySeverity)) {
    if (count > 0) {
      const color = sev === 'High' ? chalk.red : sev === 'Medium' ? chalk.yellow : chalk.dim;
      console.log(`    ${color('■')} ${sev}: ${count}`);
    }
  }

  const topIssues = issues.slice(0, 15);
  let summary = `=== BURP SUITE SCAN RESULTS ===\n`;
  summary += `Total issues: ${issues.length}\n\n`;

  topIssues.forEach((issue, i) => {
    summary += `Issue ${i + 1}: ${issue.name}\n`;
    summary += `  URL: ${issue.host}${issue.path}\n`;
    summary += `  Severity: ${issue.severity} | Confidence: ${issue.confidence}\n`;
    if (issue.detail) summary += `  Detail: ${issue.detail.slice(0, 300)}\n`;
    if (issue.remediation) summary += `  Remediation: ${issue.remediation.slice(0, 300)}\n`;
    summary += '\n';
  });

  hr('─', chalk.dim);
  console.log(chalk.bold.cyan('  [2/2] Sending to AI for analysis & remediation plan...\n'));

  const prompt = `Berikut adalah hasil scan Burp Suite dengan ${issues.length} findings.

${summary.slice(0, 8000)}

Buatkan:
1. **Executive Summary** — ringkasan level risiko
2. **Priority Fix Plan** — urutan perbaikan berdasarkan severity
3. **Detailed Remediation** — langkah teknis untuk setiap celah
4. **Re-testing Commands** — cara verifikasi setelah fix (curl, sqlmap, etc.)

Format dalam code block dengan bahasa yang jelas.`;
  await streamResponse(prompt);
}
