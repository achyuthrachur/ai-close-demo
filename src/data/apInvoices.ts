import { accrualPolicy } from './config';
import { VendorInvoice, VendorProfile } from '@/types';

const { currentPeriod } = accrualPolicy;

const periodToDate = (period: string, day = 1) => {
  const [year, month] = period.split('-').map((p) => parseInt(p, 10));
  return new Date(year, month - 1, day);
};

const formatDate = (date: Date) => date.toISOString().split('T')[0];
const toPeriod = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

let seed = 101;
const rand = () => {
  seed = (seed * 48271) % 0x7fffffff;
  return seed / 0x7fffffff;
};

const roundTo = (val: number, step = 25) => Math.round(val / step) * step;

export const vendorProfiles: VendorProfile[] = [
  { vendorId: 'V001', vendorName: 'Acme Cloud Hosting', defaultGLAccount: '5200 - Software Subscriptions', costCenter: 'IT01' },
  { vendorId: 'V002', vendorName: 'Northwind Logistics', defaultGLAccount: '5600 - Logistics & Freight', costCenter: 'OPS10' },
  { vendorId: 'V003', vendorName: 'HealthBridge Benefits', defaultGLAccount: '5700 - HR & Recruiting', costCenter: 'HR01' },
  { vendorId: 'V004', vendorName: 'Pixel HR Consultants', defaultGLAccount: '5300 - Professional Services', costCenter: 'HR01' },
  { vendorId: 'V005', vendorName: 'Field & Co Facilities', defaultGLAccount: '5100 - Facilities Expense', costCenter: 'FAC02' },
  { vendorId: 'V006', vendorName: 'Blue Ocean Analytics', defaultGLAccount: '5900 - Training & Education', costCenter: 'FIN01' },
  { vendorId: 'V007', vendorName: 'Metro Travel Group', defaultGLAccount: '5400 - Travel & Meals', costCenter: 'SALES05' },
];

type VendorPattern = {
  vendorId: string;
  cadence: 'Monthly' | 'Quarterly' | 'Irregular';
  base: number;
  variance: number;
  missingPeriods?: string[];
};

const patterns: VendorPattern[] = [
  { vendorId: 'V001', cadence: 'Monthly', base: 1650, variance: 0.05, missingPeriods: [currentPeriod] },
  { vendorId: 'V002', cadence: 'Monthly', base: 8200, variance: 0.12, missingPeriods: [currentPeriod] },
  { vendorId: 'V003', cadence: 'Monthly', base: 4700, variance: 0.08 },
  { vendorId: 'V004', cadence: 'Quarterly', base: 9200, variance: 0.1 },
  { vendorId: 'V005', cadence: 'Monthly', base: 3200, variance: 0.06, missingPeriods: [currentPeriod] },
  { vendorId: 'V006', cadence: 'Irregular', base: 5400, variance: 0.35 },
  { vendorId: 'V007', cadence: 'Monthly', base: 2100, variance: 0.22, missingPeriods: ['2025-04'] },
];

const buildInvoices = (): VendorInvoice[] => {
  const invoices: VendorInvoice[] = [];
  const historyStart = periodToDate('2024-01');
  const historyEnd = periodToDate(currentPeriod, 25);

  const pushInvoice = (vendor: VendorProfile, date: Date, amount: number, status: 'PAID' | 'UNPAID' = 'PAID') => {
    const invoiceId = `${vendor.vendorId}-${formatDate(date).replace(/-/g, '')}`;
    const dueDate = new Date(date);
    dueDate.setDate(dueDate.getDate() + 30);
    const invoice: VendorInvoice = {
      vendorId: vendor.vendorId,
      vendorName: vendor.vendorName,
      invoiceId,
      invoiceDate: formatDate(date),
      dueDate: formatDate(dueDate),
      amount: roundTo(amount),
      currency: 'USD',
      glAccount: vendor.defaultGLAccount,
      costCenter: vendor.costCenter,
      status,
      period: toPeriod(date),
    };
    invoices.push(invoice);
  };

  vendorProfiles.forEach((vendor) => {
    const pattern = patterns.find((p) => p.vendorId === vendor.vendorId)!;
    const cursor = new Date(historyStart);

    while (cursor <= historyEnd) {
      const period = toPeriod(cursor);
      const isMissing = pattern.missingPeriods?.includes(period);

      const baseAmount = pattern.base * (1 + (rand() * 2 - 1) * pattern.variance);
      const amount = Math.max(200, roundTo(baseAmount));

      const shouldCreate =
        (pattern.cadence === 'Monthly' && !isMissing) ||
        (pattern.cadence === 'Quarterly' && cursor.getMonth() % 3 === 2 && !isMissing) ||
        (pattern.cadence === 'Irregular' && rand() > 0.55 && !isMissing);

      if (shouldCreate) {
        const day = 8 + Math.floor(rand() * 10);
        const invoiceDate = new Date(cursor.getFullYear(), cursor.getMonth(), day);
        const status = period === currentPeriod ? 'UNPAID' : 'PAID';
        pushInvoice(vendor, invoiceDate, amount, status);
      }

      // Advance cursor
      cursor.setMonth(cursor.getMonth() + 1);
    }
  });

  // Ensure at least one fresh current-period invoice exists to compare against missing ones.
  const presentVendor = vendorProfiles.find((v) => v.vendorId === 'V003')!;
  const juneInvoiceDate = new Date(periodToDate(currentPeriod).getFullYear(), periodToDate(currentPeriod).getMonth(), 10);
  pushInvoice(presentVendor, juneInvoiceDate, 4750, 'UNPAID');

  return invoices.sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate));
};

export const apInvoices: VendorInvoice[] = buildInvoices();
