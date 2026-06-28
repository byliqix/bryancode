import fs from 'fs';
import path from 'path';
import { marked } from 'marked';
import { CONFIG } from './config.js';
import { state } from './state.js';

const REPORT_CSS = `
body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; color: #222; background: #fff; }
h1 { color: #c00; border-bottom: 3px solid #c00; padding-bottom: 10px; }
h2 { color: #900; margin-top: 30px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
pre { background: #1a1a1a; color: #f8f8f8; padding: 15px; border-radius: 5px; overflow-x: auto; }
code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; }
pre code { background: none; padding: 0; }
.meta { color: #666; font-size: 0.9em; margin-bottom: 30px; }
.meta strong { color: #333; }
.severity-high { color: #c00; font-weight: bold; }
.severity-medium { color: #c60; font-weight: bold; }
.severity-low { color: #660; }
hr { border: none; border-top: 1px solid #ddd; margin: 25px 0; }
`;

function buildMarkdown() {
  let md = `# PenTest Report\n\n`;
  md += `<div class="meta">\n\n`;
  md += `**Target:** ${state.target || 'unspecified'}  \n`;
  md += `**Date:** ${new Date().toLocaleString()}  \n`;
  md += `**Provider:** ${state.provider}  \n`;
  md += `**Model:** ${state.currentModel}  \n\n`;
  md += `</div>\n\n---\n\n`;

  state.conversationHistory.forEach((msg, i) => {
    if (msg.role === 'user') {
      const clean = msg.content.replace(/\[Session context:.*\]/, '').trim();
      md += `## Query ${Math.ceil((i + 1) / 2)}\n**You:** ${clean}\n\n`;
    } else {
      md += `**AI:**\n${msg.content}\n\n---\n\n`;
    }
  });

  return md;
}

function buildHTML(md) {
  const body = marked.parse(md);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PenTest Report</title>
<style>${REPORT_CSS}</style>
</head>
<body>${body}</body>
</html>`;
}

export function saveReport(filename) {
  if (!fs.existsSync(CONFIG.reportDir)) {
    fs.mkdirSync(CONFIG.reportDir, { recursive: true });
  }

  const md = buildMarkdown();
  const ext = filename ? path.extname(filename).toLowerCase() : '.md';

  if (ext === '.pdf' || ext === '.html') {
    const html = buildHTML(md);
    const htmlFile = filename ? filename.replace(/\.pdf$/, '.html') : path.join(
      CONFIG.reportDir, `pentest_${state.target || 'session'}_${Date.now()}.html`
    );
    fs.writeFileSync(htmlFile, html);

    if (ext === '.pdf') {
      const pdfFile = filename || htmlFile.replace(/\.html$/, '.pdf');
      console.log(`  ℹ Open "${path.basename(htmlFile)}" di browser → Ctrl+P → Save as PDF`);
      console.log(`    Atau install pandoc: sudo apt install pandoc && pandoc "${htmlFile}" -o "${pdfFile}"`);
      return pdfFile;
    }
    return htmlFile;
  }

  const out = filename || path.join(CONFIG.reportDir, `pentest_${state.target || 'session'}_${Date.now()}.md`);
  fs.writeFileSync(out, md);
  return out;
}

export function savePDF() {
  const baseName = `pentest_${state.target || 'session'}_${Date.now()}`;
  const htmlFile = path.join(CONFIG.reportDir, `${baseName}.html`);
  const pdfFile = path.join(CONFIG.reportDir, `${baseName}.pdf`);

  const md = buildMarkdown();
  const html = buildHTML(md);
  fs.writeFileSync(htmlFile, html);

  return { htmlFile, pdfFile };
}
