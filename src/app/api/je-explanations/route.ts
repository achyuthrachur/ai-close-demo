import { NextResponse } from 'next/server';
import { callChatModel } from '@/lib/ai';
import { FlaggedEntry } from '@/types';

const cleanJson = (text: string) => {
  const stripped = text.trim().replace(/```json|```/g, '');
  return JSON.parse(stripped);
};

export async function POST(req: Request) {
  const body = await req.json();
  const flagged: FlaggedEntry[] = body.flagged ?? [];
  const date: string = body.date ?? '';
  const summary = body.summary;

  const payload = flagged.map((f) => {
    const net = f.entry.debit - f.entry.credit;
    return {
      jeId: f.entry.jeId,
      account: f.entry.account,
      costCenter: f.entry.costCenter,
      amount: net,
      flags: f.flags,
      description: f.entry.description,
      context: f.context,
    };
  });

  const prompt = `
You are assisting a controller reviewing journal entry flags for ${date}.
Only use the provided data; do not invent new amounts.
Provide remediation-focused guidance.

Daily context:
- Total entries: ${summary?.totalEntries ?? 'n/a'}
- Flagged counts: ${JSON.stringify(summary?.flaggedCounts ?? {})}
- High risk: ${summary?.highRiskCount ?? 0}

Flagged entries JSON:
${JSON.stringify(payload, null, 2)}

Respond in JSON with the shape:
{
  "narrative": "overall 2-3 sentence narrative summarizing the risks and themes",
  "items": [
    { "jeId": "...", "summary": "1 sentence theme", "details": "1-2 sentences describing why flagged", "nextSteps": ["short remediation step 1", "step 2"] }
  ]
}
`;

  let narrative = '';
  let items: { jeId: string; summary: string; details: string }[] = [];

  try {
    const aiText = await callChatModel(prompt);
    const parsed = cleanJson(aiText);
    narrative = parsed.narrative ?? '';
    items = parsed.items ?? [];
  } catch (err) {
    console.error('AI explanation error', err);
    narrative = 'AI unavailable. Deterministic flags remain accurate.';
  }

  // Deterministic fallback if parsing fails or AI returns empty.
  if (!items.length) {
    items = flagged
      .filter((f) => f.flags.length)
      .map((f) => ({
        jeId: f.entry.jeId,
        summary: `${f.flags.join(', ')} on ${f.entry.account}`,
        details: `Flagged deterministically due to ${f.flags.join(' & ')}. Amount: ${Math.abs(
          f.entry.debit - f.entry.credit
        )}.`,
        nextSteps: ['Review supporting docs', 'Confirm approval and reversal timing'],
      }));
  }

  return NextResponse.json({
    dailyNarrative: narrative,
    explanations: items.map((item) => ({
      jeId: item.jeId,
      summary: item.summary,
      text: `${item.details}${item.nextSteps?.length ? `\nNext steps: ${item.nextSteps.join('; ')}` : ''}`,
    })),
  });
}
