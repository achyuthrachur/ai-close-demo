import { NextResponse } from 'next/server';
import { callChatModel } from '@/lib/ai';
import { FlaggedEntry, JEFlag } from '@/types';

const cleanJson = (text: string) => {
  const stripped = text.trim().replace(/```json|```/g, '');
  return JSON.parse(stripped);
};

export async function POST(req: Request) {
  const body = await req.json();
  const flagged: FlaggedEntry[] = body.flagged ?? [];
  const date: string = body.date ?? '';
  const summary = body.summary;
  const decisions: { jeId: string; status: string }[] = body.decisions ?? [];

  const categories: Record<
    JEFlag,
    {
      jeIds: string[];
      entries: {
        jeId: string;
        account: string;
        amount: number;
        description: string;
        context: FlaggedEntry['context'];
      }[];
    }
  > = {
    DUPLICATE: { jeIds: [], entries: [] },
    UNUSUAL_AMOUNT: { jeIds: [], entries: [] },
    REVERSAL_ISSUE: { jeIds: [], entries: [] },
  };

  flagged
    .filter((f) => f.flags.length)
    .forEach((f) => {
      const net = f.entry.debit - f.entry.credit;
      const decision = decisions.find((d) => d.jeId === f.entry.jeId)?.status ?? 'PENDING';
      f.flags.forEach((flag) => {
        const bucket = categories[flag];
        bucket.jeIds.push(f.entry.jeId);
        bucket.entries.push({
          jeId: f.entry.jeId,
          account: f.entry.account,
          amount: net,
          description: f.entry.description,
          context: f.context,
          decision,
        } as {
          jeId: string;
          account: string;
          amount: number;
          description: string;
          context: FlaggedEntry['context'];
          decision: string;
        });
      });
    });

  const prompt = `
You are assisting a controller reviewing journal entry flags for ${date}.
Only use the provided data; do not invent new amounts.
Provide remediation-focused guidance.

Daily context:
- Total entries: ${summary?.totalEntries ?? 'n/a'}
- Flagged counts: ${JSON.stringify(summary?.flaggedCounts ?? {})}
- High risk: ${summary?.highRiskCount ?? 0}

Grouped flagged entries JSON by category:
${JSON.stringify(
  Object.entries(categories).map(([flag, info]) => ({
    flag,
    jeIds: info.jeIds,
    entries: info.entries,
  })),
  null,
  2
)}

Respond in JSON with the shape:
{
  "narrative": "overall 2-3 sentence narrative summarizing the risks and themes",
  "categories": [
    { "flag": "DUPLICATE", "summary": "theme", "details": "1-2 sentences describing why flagged and referencing JE IDs and decisions", "nextSteps": ["short remediation step 1", "step 2"], "jeIds": ["...","..."] }
  ]
}
`;

let narrative = '';
let categoriesResponse:
  | {
      flag: JEFlag;
      summary: string;
      details: string;
      nextSteps?: string[];
      jeIds?: string[];
    }[]
  | undefined;

try {
  const aiText = await callChatModel(prompt);
  const parsed = cleanJson(aiText);
  narrative = parsed.narrative ?? '';
  categoriesResponse = parsed.categories;
} catch (err) {
  console.error('AI explanation error', err);
  narrative = 'AI unavailable. Deterministic flags remain accurate.';
}

// Deterministic fallback if parsing fails or AI returns empty.
if (!categoriesResponse?.length) {
  categoriesResponse = (Object.keys(categories) as JEFlag[])
    .map((flag) => ({
      flag,
      summary: `${flag} issues`,
      details: `Entries: ${categories[flag].jeIds.join(', ') || 'none'}.`,
      nextSteps: ['Review supporting docs', 'Confirm approval and reversal timing'],
      jeIds: categories[flag].jeIds,
    }))
    .filter((c) => c.jeIds?.length);
}

  return NextResponse.json({
    dailyNarrative: narrative,
    explanations: categoriesResponse?.map((cat) => ({
      jeId: cat.flag,
      summary: `${cat.flag}: ${cat.summary}`,
      text: `${cat.details}${cat.nextSteps?.length ? `\nNext steps: ${cat.nextSteps.join('; ')}` : ''}`,
      jeIds: cat.jeIds ?? [],
    })),
  });
}
