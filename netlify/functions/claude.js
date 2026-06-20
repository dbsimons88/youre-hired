exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { systemPrompt, messages, maxTokens, model } = JSON.parse(event.body);

    // Build message array — if empty, send a bootstrap user message
    const apiMessages = (!messages || messages.length === 0)
      ? [{ role: 'user', content: 'Begin the interview.' }]
      : messages;

    // Default to Sonnet for interviews; caller can pass Haiku for coaching reports
    const selectedModel = model || 'claude-sonnet-4-6';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: selectedModel,
        max_tokens: maxTokens || 1024,
        system: systemPrompt,
        messages: apiMessages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `Anthropic API error ${response.status}: ${errText}` }),
      };
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? '';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
