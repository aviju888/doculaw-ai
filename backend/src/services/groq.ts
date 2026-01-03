import OpenAI from 'openai';

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

interface SimplificationOptions {
  englishProficiency?: string;
  legalExperience?: string;
  readingPreference?: string;
}

/**
 * Simplify legal document text using Groq LLM
 */
export async function simplifyDocument(
  content: string,
  level: 'basic' | 'intermediate' | 'advanced' = 'basic',
  options: SimplificationOptions = {}
): Promise<string> {
  const { englishProficiency = 'intermediate', legalExperience = 'none', readingPreference = 'simple' } = options;

  const levelInstructions = {
    basic: 'Use very simple words and short sentences. Explain everything as if talking to someone with no legal background.',
    intermediate: 'Use clear language but you can include some common legal terms with brief explanations.',
    advanced: 'Maintain more legal terminology but ensure clarity. Focus on removing unnecessary jargon.',
  };

  const prompt = `You are a legal document simplifier. Your job is to rewrite legal text so that regular people can understand it.

User Profile:
- English proficiency: ${englishProficiency}
- Legal experience: ${legalExperience}
- Preferred reading style: ${readingPreference}

Simplification level: ${level}
Instructions: ${levelInstructions[level]}

Original legal text:
${content}

Please provide a simplified version that:
1. Uses plain, everyday language
2. Breaks down complex sentences into shorter ones
3. Explains any legal terms that must be kept
4. Preserves the key meaning, rights, and obligations
5. Uses bullet points or numbered lists where helpful

Simplified version:`;

  const response = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 2000,
  });

  return response.choices[0].message.content || 'Unable to simplify document.';
}

/**
 * Generate a chat response using Groq LLM with optional context
 */
export async function generateChatResponse(
  userMessage: string,
  context: string[] = [],
  conversationHistory: { role: 'user' | 'assistant'; content: string }[] = []
): Promise<string> {
  const systemPrompt = `You are a helpful legal assistant for DocuLaw AI. Your role is to:
1. Answer questions about legal documents in plain language
2. Explain legal concepts simply
3. Help users understand their rights and obligations
4. Be accurate but accessible

${context.length > 0 ? `\nRelevant context from documents:\n${context.join('\n\n')}` : ''}

Important: You are not a lawyer and cannot provide legal advice. Always recommend consulting a licensed attorney for specific legal matters.`;

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: userMessage },
  ];

  const response = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages,
    temperature: 0.5,
    max_tokens: 1000,
  });

  return response.choices[0].message.content || 'I apologize, but I was unable to generate a response.';
}

/**
 * Generate a summary of a document
 */
export async function summarizeDocument(content: string): Promise<string> {
  const prompt = `Please provide a brief summary (2-3 sentences) of the following legal document. Focus on the main purpose and key points:

${content}

Summary:`;

  const response = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 200,
  });

  return response.choices[0].message.content || 'Unable to generate summary.';
}
