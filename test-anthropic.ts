import dotenv from 'dotenv';
dotenv.config();
import Anthropic from '@anthropic-ai/sdk';

async function test() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is missing');
    return;
  }
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const models = ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-haiku-20240307', 'claude-3-5-sonnet-20241022'];

  for (const model of models) {
    try {
      console.log(`Testing model ${model}...`);
      const response = await anthropic.messages.create({
        model,
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Di hola' }]
      });
      console.log(`Response for ${model}:`, response.content);
      break; // stop on first success
    } catch (err: any) {
      console.error(`Error for ${model}:`, err.message || err);
    }
  }
}
test();
