const defaultModel = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

export const callChatModel = async (prompt: string) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return `AI key not configured. Deterministic data only. Prompt:\n${prompt.slice(0, 400)}`;
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: defaultModel,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are a finance controller assistant. You summarize deterministic outputs without inventing numbers or percentages.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI provider error: ${res.status} ${text}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? '';
};
