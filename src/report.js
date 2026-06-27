import fs from 'fs';
import path from 'path';
import { CONFIG } from './config.js';
import { state } from './state.js';

export function saveReport(filename) {
  if (!fs.existsSync(CONFIG.reportDir)) {
    fs.mkdirSync(CONFIG.reportDir, { recursive: true });
  }

  const out = filename || path.join(
    CONFIG.reportDir,
    `pentest_${state.target || 'session'}_${Date.now()}.md`
  );

  let md = `# PenTest Report\n`;
  md += `**Target:** ${state.target || 'unspecified'}  \n`;
  md += `**Date:** ${new Date().toLocaleString()}  \n`;
  md += `**Model:** ${state.currentModel}  \n\n---\n\n`;

  state.conversationHistory.forEach((msg, i) => {
    if (msg.role === 'user') {
      const clean = msg.content.replace(/\[Session context:.*\]/, '').trim();
      md += `## Query ${Math.ceil((i + 1) / 2)}\n**You:** ${clean}\n\n`;
    } else {
      md += `**AI:**\n${msg.content}\n\n---\n\n`;
    }
  });

  fs.writeFileSync(out, md);
  return out;
}
