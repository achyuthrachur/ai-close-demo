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
Generate a controller-ready month-end close summary. Use only provided numbers; no new figures.
Respond in JSON: { "summary": "3-4 short paragraphs: 1) overall status and volume/context; 2) JE and accrual trends with month-to-month comparisons; 3) key open items; 4) concrete remediation steps" }.

Period: ${period}
Readiness score: ${overview.readinessScore}%
Remediation score: ${overview.remediationScore}%
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
