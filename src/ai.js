import Groq from 'groq-sdk';
import OpenAI from 'openai';
import fs from 'fs';
import dotenv from 'dotenv';
import chalk from 'chalk';
import { CONFIG, getOllamaConfig } from './config.js';
import { state } from './state.js';
import { hr, modelShortName, highlightCode } from './ui.js';

dotenv.config();

let groqClient = null;
let ollamaClient = null;

const IMAGE_URL_RE = /https?:\/\/[^\s]+\.(png|jpg|jpeg|gif|webp)(\?[^\s]*)?/i;
const IMAGE_EXT_RE = /\.(png|jpg|jpeg|gif|webp|bmp)$/i;

export async function checkOllama() {
  const cfg = getOllamaConfig();
  const isLocal = cfg.baseURL.includes('localhost') || cfg.baseURL.includes('127.0.0.1');
  try {
    if (isLocal) {
      const ollamaHost = cfg.baseURL.replace('/v1', '');
      const res = await fetch(`${ollamaHost}/tags`);
      if (!res.ok) return { running: false, models: [] };
      const data = await res.json();
      const models = (data.models || []).map(m => m.name);
      return { running: true, models };
    }
    const res = await fetch(`${cfg.baseURL}/models`, {
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
    });
    if (!res.ok) return { running: false, models: [] };
    const data = await res.json();
    const models = (data.data || []).map(m => m.id);
    return { running: true, models };
  } catch {
    return { running: false, models: [] };
  }
}

function getClient() {
  if (state.provider === 'groq') {
    if (!groqClient) {
      groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }
    return groqClient;
  }

  if (!ollamaClient) {
    const cfg = getOllamaConfig();
    ollamaClient = new OpenAI({
      baseURL: cfg.baseURL,
      apiKey: cfg.apiKey,
    });
  }
  return ollamaClient;
}

function buildUserContent(text) {
  const urls = [...text.matchAll(IMAGE_URL_RE)].map(m => m[0]);
  const localFiles = text.split(/\s+/).filter(s => IMAGE_EXT_RE.test(s) && fs.existsSync(s));

  if (urls.length === 0 && localFiles.length === 0) return text;

  const cleanText = text.replace(IMAGE_URL_RE, '').trim();
  const parts = [{ type: 'text', text: cleanText || 'What is in this image?' }];

  for (const url of urls) {
    parts.push({ type: 'image_url', image_url: { url } });
  }

  for (const file of localFiles) {
    const data = fs.readFileSync(file);
    const ext = file.split('.').pop();
    const b64 = data.toString('base64');
    parts.push({ type: 'image_url', image_url: { url: `data:image/${ext};base64,${b64}` } });
  }

  return parts;
}

export async function streamResponse(userPrompt) {
  const contextNote = state.target
    ? `\n[Session context: current target is ${state.target}]`
    : '';

  const content = buildUserContent(userPrompt + contextNote);
  state.conversationHistory.push({ role: 'user', content: typeof content === 'string' ? content : userPrompt + contextNote });

  const messages = [
    { role: 'system', content: CONFIG.systemPrompt },
    ...state.conversationHistory.map(m => ({ role: m.role, content: m.content })),
  ];
  messages[messages.length - 1].content = content;

  const isVision = Array.isArray(content);

  hr('─', chalk.dim);
  process.stdout.write(
    chalk.bold.red('  ☠ BryanCode') +
    chalk.dim(` ${state.provider} [${modelShortName(state.currentModel)}]`) +
    (isVision ? chalk.red(' 📷') : '') +
    '\n\n'
  );

  let fullResponse = '';
  let buffer = '';

  try {
    const client = getClient();
    const stream = await client.chat.completions.create({
      messages,
      model: state.currentModel,
      stream: true,
      temperature: 0.4,
      max_tokens: state.provider === 'groq' ? 8192 : undefined,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      fullResponse += content;
      buffer += content;

      if (!buffer.includes('```') || buffer.split('```').length % 2 === 1) {
        const lines = buffer.split('\n');
        for (let i = 0; i < lines.length - 1; i++) {
          process.stdout.write('  ' + chalk.white(lines[i]) + '\n');
        }
        buffer = lines[lines.length - 1];
      }
    }

    if (buffer) process.stdout.write('  ' + chalk.white(buffer));

    if (fullResponse.includes('```')) {
      process.stdout.write('\r\x1b[K');
      process.stdout.moveCursor?.(0, -(fullResponse.split('\n').length + 2));
      process.stdout.clearScreenDown?.();
      const highlighted = highlightCode(fullResponse);
      highlighted.split('\n').forEach(line => console.log('  ' + chalk.white(line)));
    }

    console.log('\n');
    state.conversationHistory.push({ role: 'assistant', content: fullResponse });
    state.sessionStats.messages++;

    if (state.conversationHistory.length > CONFIG.maxHistory) {
      state.conversationHistory = state.conversationHistory.slice(-CONFIG.maxHistory);
    }

    return fullResponse;
  } catch (err) {
    console.log('\n');
    if (state.provider === 'groq' && state.currentModel !== CONFIG.fallbackModel) {
      console.log(chalk.yellow(`  ⚠ ${modelShortName(state.currentModel)} failed — switching to fallback...\n`));
      state.currentModel = CONFIG.fallbackModel;
      return streamResponse(userPrompt);
    }
    if (state.provider === 'ollama') {
      const isModelErr = err.message?.toLowerCase().includes('model') && err.status === 404;
      if (isModelErr) {
        console.log(chalk.yellow(`\n  ⚠ Model "${state.currentModel}" tidak ditemukan. Ganti model via /model\n`));
      } else {
        console.log(chalk.yellow(`\n  ⚠ Gagal terhubung ke ${getOllamaConfig().baseURL}\n`));
      }
    }
    throw err;
  }
}
