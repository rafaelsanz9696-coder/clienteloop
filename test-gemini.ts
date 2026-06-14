import dotenv from 'dotenv';
dotenv.config();
import { geminiRequest } from './server/lib/gemini.js';

async function test() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('API KEY IN TEST:', apiKey);
  const models = ['gemini-3.5-flash', 'gemini-3.1-pro-preview', 'gemini-1.5-flash', 'gemini-2.0-flash'];

  for (const model of models) {
    try {
      console.log(`--- Fetching directly with model ${model} ---`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Di hola' }] }]
        })
      });
      const data = await response.json();
      console.log(`Response for ${model}:`, JSON.stringify(data, null, 2));
    } catch (err: any) {
      console.error(`Error for ${model}:`, err.message || err);
    }
  }
}
test();
