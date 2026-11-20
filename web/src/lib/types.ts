export interface CustomerFeatures {
  gender: string
  SeniorCitizen: string
  Partner: string
  Dependents: string
  tenure: number
  PhoneService: string
  MultipleLines: string
  InternetService: string
  OnlineSecurity: string
  OnlineBackup: string
  DeviceProtection: string
  TechSupport: string
  StreamingTV: string
  StreamingMovies: string
  Contract: string
  PaperlessBilling: string
  PaymentMethod: string
  MonthlyCharges: number
  TotalCharges: number
}

export type RiskBand = 'low' | 'medium' | 'high'
export type FactorDirection = 'increases_churn' | 'decreases_churn'

export interface TopFactor {
  feature: string
  impact: number
  direction: FactorDirection
}

export interface Prediction {
  churn_probability: number
  will_churn: boolean
  risk_band: RiskBand
  top_factors: TopFactor[]
}

export interface Example extends Prediction {
  features: CustomerFeatures
}

export interface TestMetrics {
  roc_auc: number
  pr_auc: number
  pr_auc_ci: [number, number]
  precision: number
  recall: number
  f1: number
  brier: number
  brier_uncalibrated: number
  threshold: number
  net_benefit_per_1000: number
  net_benefit_per_1000_ci: [number, number]
  confusion_matrix: number[][]
  n_test: number
}

export interface ThresholdSummary {
  chosen_threshold: number
  expected_net_benefit_per_1000: number
  'expected_net_benefit_per_1000_at_0.5'?: number
  expected_net_benefit_per_1000_target_all: number
  n_customers: number
}

export interface ModelComparison {
  model: string
  roc_auc_mean: number
  roc_auc_std?: number
  pr_auc_mean: number
  pr_auc_std?: number
  f1_mean: number
  f1_std?: number
  precision_mean: number
  precision_std?: number
  recall_mean: number
  recall_std?: number
  brier_mean: number
  brier_std?: number
}

export interface MetricsPayload {
  test: TestMetrics
  threshold: {
    threshold: number
    cost_params: BusinessParams
    validation_summary: ThresholdSummary
  }
  comparison: ModelComparison[]
}

export interface BusinessParams {
  customer_lifetime_value: number
  retention_offer_cost: number
  offer_success_rate: number
  sweep_min: number
  sweep_max: number
  sweep_steps: number
}

export interface ModelInfo {
  version: string
  git_sha: string
  trained_at: string
  feature_list: string[]
  dataset_source: string
  metrics: TestMetrics
}

export interface PipelineStatus {
  test_count: number
  coverage: number
  last_trained: string
  git_sha: string
}

export interface DriftFeature {
  feature: string
  type: 'categorical' | 'numerical'
  psi: number
  chi2_pvalue?: number
  drifted: boolean
}

export interface DriftReport {
  status: string
  n_samples: number
  n_features: number
  n_drifted: number
  drifted_share: number
  drift_detected: boolean
  threshold: number
  features: DriftFeature[]
}

export interface DriftPayload {
  no_shift: DriftReport
  shifted: DriftReport
}

export interface RocCurve {
  fpr: number[]
  tpr: number[]
  auc: number
}

export interface PrCurve {
  recall: number[]
  precision: number[]
  ap: number
}

export interface CalibrationBin {
  mean_predicted: number[]
  fraction_positive: number[]
}

export interface CalibrationPayload {
  before: CalibrationBin
  after: CalibrationBin
}

export type ImportancePayload = Record<string, number>

export interface Score {
  p: number
  y: number
}

export interface PredictResult {
  prediction: Prediction
  latencyMs: number
  modelVersion: string
  threshold: number
  requestId: string
}
