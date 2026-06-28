import { CONFIG } from './config.js';

export const state = {
  currentModel: CONFIG.defaultModel,
  provider: 'groq',
  conversationHistory: [],
  sessionStats: { messages: 0, start: Date.now() },
  target: null,
  paidModels: new Set(),
};
