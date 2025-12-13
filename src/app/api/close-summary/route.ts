import { NextResponse } from 'next/server';
import { callChatModel } from '@/lib/ai';
import { CloseOverview } from '@/lib/overview';

const cleanJson = (text: string) => text.trim().replace(/```json|```/g, '');

export async function POST(req: Request) {
  const body = await req.json();
  const overview: CloseOverview = body.overview;
  const period: string = body.period;
  const monthlyTrend: { period: string; score: number }[] = body.monthlyTrend ?? [];

  const prompt = `
Generate a concise controller-friendly month-end close summary. Use only provided numbers; no new figures.
Respond in JSON: { "summary": "3-4 sentence narrative with key observations and next steps, mentioning month-to-month trends" }.

Period: ${period}
Readiness score: ${overview.readinessScore}%
JE: ${overview.je.reviewedDays}/${overview.je.totalDays} days reviewed, ${overview.je.aiExplainedDays} days have AI narratives.
Accruals: ${overview.accruals.withAiMemo}/${overview.accruals.expectedMissing} expected missing invoices have memos, total vendors ${overview.accruals.totalVendors}.
Open JE days: ${overview.openDays.join(', ') || 'none'}
Open vendors: ${overview.openVendors.join(', ') || 'none'}
Monthly trend readiness: ${monthlyTrend.map((t) => `${t.period}:${t.score}%`).join(', ') || 'n/a'}
`;

  let summary = '';
  try {
    const aiText = await callChatModel(prompt);
    const cleaned = cleanJson(aiText);
    const parsed = JSON.parse(cleaned);
    summary = parsed.summary ?? cleaned;
  } catch (err) {
    console.error('AI close summary error', err);
    summary = 'AI unavailable. Use deterministic readiness score shown on the dashboard.';
  }

  return NextResponse.json({ summary });
}
