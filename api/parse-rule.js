const GEMINI_MODELS = ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest']

function endpointFor(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
}

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    resolvable: { type: 'BOOLEAN' },
    reason: { type: 'STRING' },
    rule: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        scope: { type: 'STRING', enum: ['brand', 'platform', 'cart'] },
        appliesTo: { type: 'STRING' },
        type: { type: 'STRING', enum: ['percentage', 'flat'] },
        value: { type: 'NUMBER' },
        stackable: { type: 'BOOLEAN' },
        minCartValue: { type: 'NUMBER', nullable: true },
      },
      required: ['scope', 'appliesTo', 'type', 'value', 'stackable'],
    },
  },
  required: ['resolvable', 'reason'],
}

const SYSTEM_PROMPT = `Parse an e-commerce discount rule into JSON.
Rules:
- scope must be "brand", "platform", or "cart".
- For "brand" or "platform", appliesTo is the exact brand or platform name; minCartValue is null.
- For "cart", appliesTo is "Entire cart" and minCartValue is the minimum cart threshold in rupees.
- type is "percentage" or "flat". value is a positive number (e.g. 20 for 20%, 100 for Rs.100).
- stackable defaults to false unless the sentence mentions stackable / combines with other offers.
- If the sentence is missing a discount value, target (brand/platform), or threshold (for cart rules), set resolvable=false, rule=null, and explain concisely in reason what is missing.`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' })
  }

  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : ''
  if (!text) {
    return res.status(400).json({ error: 'Please enter a discount rule description.' })
  }
  if (text.length > 300) {
    return res.status(400).json({ error: 'Rule description must be 300 characters or fewer.' })
  }

  try {
    let lastError = 'No Gemini models available.'

    for (const model of GEMINI_MODELS) {
      const response = await fetch(`${endpointFor(model)}?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text }] }],
          generationConfig: {
            temperature: 0,
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        lastError = `Gemini API error (${response.status}): ${errText.slice(0, 200)}`
        if (response.status === 404 || response.status === 429 || response.status === 503) {
          continue
        }
        return res.status(502).json({ error: lastError })
      }

      const data = await response.json()
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!raw) {
        return res.status(502).json({ error: 'Empty response from Gemini.' })
      }
      return res.status(200).json(JSON.parse(raw))
    }

    return res.status(502).json({ error: lastError })
  } catch (err) {
    return res.status(502).json({ error: `Failed to parse rule: ${err.message}` })
  }
}

