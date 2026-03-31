// DeepSeek API integration for chat completions
// Using the free version: https://api.deepseek.com/

const DEEPSEEK_API_KEY = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY || '';
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function chatWithDeepSeek(
  messages: ChatMessage[],
  onChunk?: (chunk: string) => void
): Promise<string> {
  if (!DEEPSEEK_API_KEY) {
    console.warn('DEEPSEEK_API_KEY not set. Using mock response.');
    return getMockResponse();
  }

  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: messages,
        stream: true,
        temperature: 0.7,
        top_p: 0.95,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.statusText}`);
    }

    let fullResponse = '';
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('No response body');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullResponse += content;
              onChunk?.(content);
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }

    return fullResponse;
  } catch (error) {
    console.error('DeepSeek API error:', error);
    return getMockResponse();
  }
}

function getMockResponse(): string {
  const mockResponses = [
    'I\'m ready to help you with your questions and analysis. As a mock response, I can assist with investment analysis, document reviews, strategy development, and much more.',
    'Thank you for reaching out. I can help you analyze documents, develop strategies, answer questions, and provide insights based on the information you share with me.',
    'I\'m here to support your work with intelligent analysis and comprehensive responses. Please share your questions or upload documents for analysis.',
    'Based on your needs, I can help with research, analysis, writing support, and strategic planning. What would you like to focus on?',
  ];
  return mockResponses[Math.floor(Math.random() * mockResponses.length)];
}

export async function generateTitle(messageContent: string): Promise<string> {
  const systemMessage: ChatMessage = {
    role: 'system',
    content: 'Generate a short, concise title (max 5 words) for a chat conversation based on the initial message. Return only the title, no other text.',
  };

  try {
    const title = await chatWithDeepSeek([
      systemMessage,
      {
        role: 'user',
        content: messageContent,
      },
    ]);
    return title.trim() || 'New Chat';
  } catch (error) {
    console.error('Error generating title:', error);
    return 'New Chat';
  }
}
