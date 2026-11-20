const repo = 'https://github.com/Kuldeepni/churn-mlops'

export const siteConfig = {
  name: 'churn-mlops',
  tagline: 'Predict churn. Decide by profit.',
  description:
    'An open-source MLOps case study: calibrated churn probabilities, a profit-optimised decision threshold, experiment tracking, CI/CD and drift monitoring.',
  repo,
  githubUrl: repo,
  apiUrl: 'https://kuldeepni-churn-mlops-api.hf.space',
  apiDocs: 'https://kuldeepni-churn-mlops-api.hf.space/docs',
  author: {
    name: 'Kuldeep',
    url: 'https://github.com/Kuldeepni',
  },
  links: {
    readme: `${repo}#readme`,
    license: `${repo}/blob/main/LICENSE`,
    pipeline: `${repo}/tree/main/src/churn`,
    dvc: `${repo}/blob/main/dvc.yaml`,
    ci: `${repo}/blob/main/.github/workflows/ci.yml`,
    docker: `${repo}/blob/main/Dockerfile`,
    tests: `${repo}/tree/main/tests`,
    evaluate: `${repo}/blob/main/src/churn/evaluate.py`,
    params: `${repo}/blob/main/params.yaml`,
    train: `${repo}/blob/main/src/churn/models/train.py`,
    calibrate: `${repo}/blob/main/src/churn/models/calibrate.py`,
    threshold: `${repo}/blob/main/src/churn/models/threshold.py`,
    bundle: `${repo}/blob/main/src/churn/models/bundle.py`,
    api: `${repo}/blob/main/src/churn/api/main.py`,
    apiMetrics: `${repo}/blob/main/src/churn/api/metrics.py`,
    drift: `${repo}/blob/main/src/churn/monitoring/drift.py`,
    simulate: `${repo}/blob/main/src/churn/monitoring/simulate.py`,
    dockerCompose: `${repo}/blob/main/docker-compose.yml`,
    makefile: `${repo}/blob/main/Makefile`,
  },
  nav: [
    { id: 'predict', label: 'Predict' },
    { id: 'impact', label: 'Impact' },
    { id: 'performance', label: 'Performance' },
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'monitoring', label: 'Monitoring' },
  ],
} as const
