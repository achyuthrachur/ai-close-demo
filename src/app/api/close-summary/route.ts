import { NextResponse } from 'next/server';
import { callChatModel } from '@/lib/ai';
import { CloseOverview } from '@/lib/overview';

const cleanJson = (text: string) => text.trim().replace(/```json|```/g, '');
const tryParse = (text: string) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export async function POST(req: Request) {
  const body = await req.json();
  const overview: CloseOverview = body.overview;
  const period: string = body.period;
  const monthlyTrend: { period: string; score: number }[] = body.monthlyTrend ?? [];
  const periodStats = body.periodStats as
    | {
        period: string;
        totalEntries: number;
        flagged: number;
        highRisk: number;
        remediation: number;
        readiness: number;
        perFlag: { DUPLICATE: number; UNUSUAL_AMOUNT: number; REVERSAL_ISSUE: number };
      }
    | undefined;

  const prompt = `
Generate a controller-ready month-end close report. Use only provided numbers; no new figures.
Respond in JSON: {
  "summary": "4 tight paragraphs that read like a report (not bullets): 
    1) Overall status and readiness, citing JE volume and flag mix for the period. 
    2) JE anomaly analysis with counts by category, how this compares to trend, and what it means operationally. 
    3) Accruals status (expected missing invoices, memos completed) and specific implications. 
    4) Prescriptive, time-bound remediation steps (who/what/when) to close gaps, tied to the metrics and open items."
}

Period: ${period}
Readiness score: ${overview.readinessScore}%
Remediation score: ${overview.remediationScore}%
JE: ${overview.je.reviewedDays}/${overview.je.totalDays} days reviewed, ${overview.je.aiExplainedDays} days have AI narratives.
Accruals: ${overview.accruals.withAiMemo}/${overview.accruals.expectedMissing} expected missing invoices have memos, total vendors ${overview.accruals.totalVendors}.
Open JE days: ${overview.openDays.join(', ') || 'none'}
Open vendors: ${overview.openVendors.join(', ') || 'none'}
Monthly trend readiness: ${monthlyTrend.map((t) => `${t.period}:${t.score}%`).join(', ') || 'n/a'}
Current period JE volume: ${periodStats?.totalEntries ?? 'n/a'} total, ${periodStats?.flagged ?? 'n/a'} flagged, ${periodStats?.highRisk ?? 'n/a'} high-risk.
Flag breakdown: dup ${periodStats?.perFlag?.DUPLICATE ?? 'n/a'}, unusual ${periodStats?.perFlag?.UNUSUAL_AMOUNT ?? 'n/a'}, reversal ${periodStats?.perFlag?.REVERSAL_ISSUE ?? 'n/a'}.
Current period remediation %: ${periodStats?.remediation ?? 'n/a'}; readiness %: ${periodStats?.readiness ?? 'n/a'}.
`;

  let summary = '';
  try {
    const aiText = await callChatModel(prompt);
    const cleaned = cleanJson(aiText);
    const parsed = tryParse(cleaned);
    summary = parsed && typeof parsed.summary === 'string' ? parsed.summary : cleaned;
  } catch (err) {
    console.error('AI close summary error', err);
    summary = 'AI unavailable. Use deterministic readiness score shown on the dashboard.';
  }

  return NextResponse.json({ summary });
}
