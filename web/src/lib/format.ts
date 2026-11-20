const FEATURE_LABELS: Record<string, string> = {
  tenure: 'Tenure',
  MonthlyCharges: 'Monthly charges',
  TotalCharges: 'Total charges',
  avg_monthly_spend: 'Average monthly spend',
  num_addon_services: 'Add-on services',
  charge_to_tenure_ratio: 'Charge-to-tenure ratio',
  is_month_to_month: 'Month-to-month contract',
  has_autopay: 'Automatic payment',
  'Contract_Month-to-month': 'Month-to-month contract',
  'Contract_One year': 'One-year contract',
  'Contract_Two year': 'Two-year contract',
  'InternetService_Fiber optic': 'Fiber optic internet',
  InternetService_DSL: 'DSL internet',
  OnlineSecurity_No: 'No online security',
  OnlineSecurity_Yes: 'Online security',
  TechSupport_No: 'No tech support',
  TechSupport_Yes: 'Tech support',
  PaperlessBilling_Yes: 'Paperless billing',
  PaperlessBilling_No: 'Paper billing',
  'PaymentMethod_Electronic check': 'Electronic check',
  PaymentMethod_Credit_card_automatic: 'Automatic credit card',
  'PaymentMethod_Bank transfer (automatic)': 'Automatic bank transfer',
  'PaymentMethod_Credit card (automatic)': 'Automatic credit card',
  MultipleLines_No: 'No multiple lines',
  MultipleLines_Yes: 'Multiple lines',
  'MultipleLines_No phone service': 'No phone service',
  SeniorCitizen_Yes: 'Senior citizen',
  SeniorCitizen_No: 'Not a senior citizen',
  Partner_Yes: 'Has a partner',
  Partner_No: 'No partner',
  Dependents_Yes: 'Has dependents',
  Dependents_No: 'No dependents',
  'tenure_bucket_0-11m': 'Tenure 0–11 months',
  'tenure_bucket_12-23m': 'Tenure 12–23 months',
  'tenure_bucket_24-47m': 'Tenure 24–47 months',
  'tenure_bucket_48-59m': 'Tenure 48–59 months',
  'tenure_bucket_60m+': 'Tenure 60+ months',
}

export function humanizeFeature(feature: string): string {
  if (FEATURE_LABELS[feature]) return FEATURE_LABELS[feature]
  const cleaned = feature.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

export function humanizeField(field: string): string {
  const cleaned = field.replace(/([a-z])([A-Z])/g, '$1 $2')
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

export function formatNumber(value: number, digits = 3): string {
  return Number.isFinite(value) ? value.toFixed(digits) : '—'
}

export function formatPercent(value: number, digits = 1): string {
  return Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : '—'
}

export function formatCurrency(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}

export function formatCompactCurrency(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}k`
  return `$${value.toFixed(0)}`
}

export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

export function riskLabel(band: 'low' | 'medium' | 'high'): string {
  return band === 'high' ? 'High risk' : band === 'medium' ? 'Watch' : 'Low risk'
}

export function riskTone(band: 'low' | 'medium' | 'high'): 'danger' | 'warning' | 'success' {
  return band === 'high' ? 'danger' : band === 'medium' ? 'warning' : 'success'
}
