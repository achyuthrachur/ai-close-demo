import { NextResponse } from 'next/server';
import { callChatModel } from '@/lib/ai';
import { AccrualCandidate } from '@/types';

const cleanJson = (text: string) => {
  const stripped = text.trim().replace(/```json|```/g, '');
  return JSON.parse(stripped);
};

export async function POST(req: Request) {
  const candidate: AccrualCandidate = await req.json();

  const prompt = `
You create a concise AI explanation for an accrual recommendation. Use only the data provided.
Respond in JSON: { "explanation": "2 sentences", "memo": "short JE memo" }.

Vendor: ${candidate.vendorName}
Cadence: ${candidate.cadence}
Expected missing invoice: ${candidate.expectedMissing}
Suggested accrual: ${candidate.suggestedAccrual} ${candidate.currency}
Average amount: ${candidate.averageAmount}
Confidence score: ${candidate.confidence}%
Debit account: ${candidate.glAccount}
Credit account: 2100 - Accrued Expenses
Recent invoices:
${candidate.recentInvoices
  .map((i) => `${i.invoiceDate} ${i.amount} ${i.status} (${i.period})`)
  .join('\n')}
`;

  let explanation = '';
  let memo = '';

  try {
    const aiText = await callChatModel(prompt);
    const parsed = cleanJson(aiText);
    explanation = parsed.explanation ?? '';
    memo = parsed.memo ?? '';
  } catch (err) {
    console.error('AI accrual explanation error', err);
    explanation = 'AI unavailable. Deterministic accrual guidance shown.';
  }

  return NextResponse.json({
    vendorId: candidate.vendorId,
    explanation,
    memo,
  });
}
