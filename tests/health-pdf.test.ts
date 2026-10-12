import { describe, it, expect, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
vi.mock('server-only', () => ({}));
import { extractExchangePdf } from '../src/domains/health/pdf';
describe('bounded private PDF processing', () => {
  it('extracts only the known exchange layout and keeps ordinary reports unsupported', async () => {
    const ordinary = await PDFDocument.create();
    ordinary.addPage();
    expect(await extractExchangePdf(await ordinary.save())).toBeNull();
    const exchange = await PDFDocument.create();
    exchange.addPage();
    const form = exchange.getForm();
    form.createTextField('aethelios_lab_exchange_version').setText('1');
    const text = JSON.stringify([
      { name: 'Synthetic test', value: '12', unit: 'mg/dL', date: '2026-10-01' },
    ]);
    form.createTextField('aethelios_lab_exchange_json').setText(text);
    expect(await extractExchangePdf(await exchange.save())).toBe(text);
  });
  it('rejects invalid PDF rather than creating results', async () => {
    await expect(extractExchangePdf(new TextEncoder().encode('%PDF-invalid'))).rejects.toThrow(
      /processed/,
    );
  });
});
