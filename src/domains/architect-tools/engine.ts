export const ESTIMATOR_KIND = 'quantity-cost-estimator' as const;
export const estimatorCurrencies = ['USD', 'EUR', 'GBP', 'JPY'] as const;
export type EstimatorCurrency = (typeof estimatorCurrencies)[number];

export const CURRENCY_SCALE: Record<EstimatorCurrency, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  JPY: 0,
};

export const ESTIMATOR_LIMITS = {
  maxItems: 24,
  maxName: 80,
  maxUnit: 24,
  maxAssumptions: 1000,
  maxQuantity: 1_000_000_000,
  maxUnitCost: 1_000_000_000,
  quantityScale: 4,
  percentScale: 2,
  maxWastePercent: 100,
  maxMarkupPercent: 1000,
  maxConfigBytes: 32768,
  maxToolsPerProject: 20,
  maxRevisions: 100,
} as const;

export const SAMPLE_ESTIMATOR_LABEL =
  'Sample demonstration — 8×4 plywood sheets. Not a live supplier quote or construction product.';

export type EstimatorItem = {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  unit_cost: string;
};

export type EstimatorConfig = {
  kind: typeof ESTIMATOR_KIND;
  currency: EstimatorCurrency;
  rounding: 'half-up-minor';
  waste_percent: string | null;
  markup_percent: string | null;
  assumptions: string;
  items: EstimatorItem[];
};

export type EstimatorLine = {
  id: string;
  name: string;
  quantity: string;
  effective_quantity: string;
  unit: string;
  unit_cost: string;
  extension: string;
  waste: string;
  line_total: string;
};

export type EstimatorResult = {
  currency: EstimatorCurrency;
  rounding: 'half-up-minor';
  lines: EstimatorLine[];
  subtotal: string;
  waste_total: string;
  markup_amount: string;
  total: string;
  implied_margin_percent: string | null;
  assumptions: string[];
};

export class EstimatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EstimatorError';
  }
}

export function parseDecimal(value: string, scale: number, field: string): bigint {
  const trimmed = value.trim();
  if (!trimmed) throw new EstimatorError(`${field} is missing. Enter an explicit number.`);
  if (!/^-?\d+(\.\d+)?$/.test(trimmed))
    throw new EstimatorError(`${field} must be a plain decimal, not scientific notation or text.`);
  const negative = trimmed.startsWith('-');
  const [wholeRaw, fraction = ''] = (negative ? trimmed.slice(1) : trimmed).split('.');
  if (fraction.length > scale)
    throw new EstimatorError(`${field} allows at most ${scale} decimal place${scale === 1 ? '' : 's'}.`);
  const whole = wholeRaw || '0';
  const units = BigInt(whole) * 10n ** BigInt(scale) + BigInt((fraction + '0'.repeat(scale)).slice(0, scale));
  return negative ? -units : units;
}

export function formatDecimal(units: bigint, scale: number) {
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const base = 10n ** BigInt(scale);
  const whole = abs / base;
  const fraction = (abs % base).toString().padStart(scale, '0');
  const body = scale === 0 ? whole.toString() : `${whole}.${fraction}`;
  return negative ? `-${body}` : body;
}

export function mulDivHalfUp(value: bigint, numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new EstimatorError('Calculation divisor is zero.');
  const product = value * numerator;
  const sign = product < 0n !== denominator < 0n ? -1n : 1n;
  const absProduct = product < 0n ? -product : product;
  const absDenom = denominator < 0n ? -denominator : denominator;
  const half = absDenom / 2n;
  return sign * ((absProduct + half) / absDenom);
}

function requireNonNegative(units: bigint, field: string) {
  if (units < 0n) throw new EstimatorError(`${field} cannot be negative.`);
}

function requirePositive(units: bigint, field: string) {
  if (units <= 0n) throw new EstimatorError(`${field} must be greater than zero.`);
}

function percentToBps(value: string | null, field: string, max: number): bigint | null {
  if (value === null || value.trim() === '') return null;
  const units = parseDecimal(value, ESTIMATOR_LIMITS.percentScale, field);
  requireNonNegative(units, field);
  const maxUnits = parseDecimal(String(max), ESTIMATOR_LIMITS.percentScale, field);
  if (units > maxUnits) throw new EstimatorError(`${field} cannot exceed ${max}%.`);
  return units;
}

export function calculateEstimator(
  config: EstimatorConfig,
  quantityOverrides: Record<string, string> = {},
): EstimatorResult {
  if (config.kind !== ESTIMATOR_KIND)
    throw new EstimatorError('Only the quantity-and-cost estimator is implemented.');
  if (config.rounding !== 'half-up-minor')
    throw new EstimatorError('Only half-up rounding to currency minor units is supported.');
  if (!estimatorCurrencies.includes(config.currency))
    throw new EstimatorError('Choose USD, EUR, GBP or JPY. Other currencies are unsupported.');
  if (!config.items.length) throw new EstimatorError('Add at least one named item.');
  if (config.items.length > ESTIMATOR_LIMITS.maxItems)
    throw new EstimatorError(`At most ${ESTIMATOR_LIMITS.maxItems} items can be calculated.`);
  const ids = new Set(config.items.map((item) => item.id));
  if (ids.size !== config.items.length) throw new EstimatorError('Item identities must be unique.');
  for (const key of Object.keys(quantityOverrides)) {
    if (!ids.has(key)) throw new EstimatorError('Quantity override refers to an item that is not in this saved revision.');
  }
  const moneyScale = CURRENCY_SCALE[config.currency];
  const qtyScale = ESTIMATOR_LIMITS.quantityScale;
  const wasteBps = percentToBps(config.waste_percent, 'Waste percent', ESTIMATOR_LIMITS.maxWastePercent);
  const markupBps = percentToBps(
    config.markup_percent,
    'Markup percent',
    ESTIMATOR_LIMITS.maxMarkupPercent,
  );
  const percentBase = 10n ** BigInt(ESTIMATOR_LIMITS.percentScale);
  const lines: EstimatorLine[] = [];
  let subtotal = 0n;
  let wasteTotal = 0n;
  for (const item of config.items) {
    if (!item.name.trim()) throw new EstimatorError('Each item needs an explicit name.');
    if (item.name.trim().length > ESTIMATOR_LIMITS.maxName)
      throw new EstimatorError('Item names stay within 80 characters.');
    if (!item.unit.trim()) throw new EstimatorError(`${item.name} is missing a unit label.`);
    if (item.unit.trim().length > ESTIMATOR_LIMITS.maxUnit)
      throw new EstimatorError('Unit labels stay within 24 characters.');
    const quantityText = quantityOverrides[item.id] ?? item.quantity;
    const quantity = parseDecimal(quantityText, qtyScale, `${item.name} quantity`);
    requirePositive(quantity, `${item.name} quantity`);
    const maxQty = parseDecimal(String(ESTIMATOR_LIMITS.maxQuantity), qtyScale, `${item.name} quantity`);
    if (quantity > maxQty) throw new EstimatorError(`${item.name} quantity exceeds the supported range.`);
    const unitCost = parseDecimal(item.unit_cost, moneyScale, `${item.name} unit cost`);
    requireNonNegative(unitCost, `${item.name} unit cost`);
    const maxCost = parseDecimal(String(ESTIMATOR_LIMITS.maxUnitCost), moneyScale, `${item.name} unit cost`);
    if (unitCost > maxCost) throw new EstimatorError(`${item.name} unit cost exceeds the supported range.`);
    const moneyBase = 10n ** BigInt(qtyScale);
    const extension = mulDivHalfUp(quantity, unitCost, moneyBase);
    const wasteQty = wasteBps === null ? 0n : mulDivHalfUp(quantity, wasteBps, percentBase * 100n);
    const effective = quantity + wasteQty;
    const lineTotal = mulDivHalfUp(effective, unitCost, moneyBase);
    const waste = lineTotal - extension;
    subtotal += extension;
    wasteTotal += waste;
    lines.push({
      id: item.id,
      name: item.name.trim(),
      quantity: formatDecimal(quantity, qtyScale),
      effective_quantity: formatDecimal(effective, qtyScale),
      unit: item.unit.trim(),
      unit_cost: formatDecimal(unitCost, moneyScale),
      extension: formatDecimal(extension, moneyScale),
      waste: formatDecimal(waste, moneyScale),
      line_total: formatDecimal(lineTotal, moneyScale),
    });
  }
  const markupAmount = markupBps === null ? 0n : mulDivHalfUp(subtotal + wasteTotal, markupBps, percentBase * 100n);
  const total = subtotal + wasteTotal + markupAmount;
  const impliedMargin =
    markupBps === null
      ? null
      : formatDecimal(
          mulDivHalfUp(markupBps * 10000n, 1n, percentBase * 100n + markupBps),
          ESTIMATOR_LIMITS.percentScale,
        );
  const assumptions = [
    `${config.currency} amounts use half-up rounding to ${moneyScale} minor unit${moneyScale === 1 ? '' : 's'}.`,
    wasteBps === null
      ? 'No waste factor is applied.'
      : `Waste adds ${config.waste_percent}% to each item quantity before monetary rounding. Line totals use effective quantity × unit cost, then half-up to currency minor units. Waste is not a price increase.`,
    markupBps === null
      ? 'No markup is applied. Markup is not margin.'
      : `Markup adds ${config.markup_percent}% to the wasted-cost subtotal. Markup is not margin. Implied margin is ${impliedMargin}% of the selling total.`,
    'Units are labels only. No unit conversion or supplier catalogue is applied.',
    'Missing prices are not invented. Empty fields refuse the calculation.',
    config.assumptions.trim() || 'No additional owner assumptions were recorded.',
  ];
  return {
    currency: config.currency,
    rounding: 'half-up-minor',
    lines,
    subtotal: formatDecimal(subtotal, moneyScale),
    waste_total: formatDecimal(wasteTotal, moneyScale),
    markup_amount: formatDecimal(markupAmount, moneyScale),
    total: formatDecimal(total, moneyScale),
    implied_margin_percent: impliedMargin,
    assumptions,
  };
}

export function sampleEstimatorConfig(): EstimatorConfig {
  return {
    kind: ESTIMATOR_KIND,
    currency: 'USD',
    rounding: 'half-up-minor',
    waste_percent: '10',
    markup_percent: '15',
    assumptions: SAMPLE_ESTIMATOR_LABEL,
    items: [
      {
        id: '00000000-0000-4000-8000-000000000101',
        name: 'Plywood sheet 8x4',
        quantity: '12',
        unit: 'sheet',
        unit_cost: '24.50',
      },
      {
        id: '00000000-0000-4000-8000-000000000102',
        name: 'Wood screws',
        quantity: '2',
        unit: 'box',
        unit_cost: '8.00',
      },
    ],
  };
}

export function emptyEstimatorConfig(): EstimatorConfig {
  return {
    kind: ESTIMATOR_KIND,
    currency: 'USD',
    rounding: 'half-up-minor',
    waste_percent: null,
    markup_percent: null,
    assumptions: '',
    items: [
      {
        id: crypto.randomUUID(),
        name: '',
        quantity: '',
        unit: '',
        unit_cost: '',
      },
    ],
  };
}
