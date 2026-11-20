import { lazy, Suspense } from 'react'
import { DemoBanner } from './components/layout/DemoBanner'
import { Footer } from './components/layout/Footer'
import { Nav } from './components/layout/Nav'
import { Hero } from './components/sections/Hero'
import { Predictor } from './components/sections/Predictor'
import { Skeleton } from './components/ui/Skeleton'
import { TooltipProvider } from './components/ui/Tooltip'
import { Cursor } from './components/visuals/Cursor'
import { Grain } from './components/visuals/Grain'
import { useApiStatus } from './hooks/useApiStatus'
import { useSmoothScroll } from './hooks/useSmoothScroll'
import { useData } from './lib/data'
import type { Example, MetricsPayload, ModelInfo, PipelineStatus } from './lib/types'

const Impact = lazy(() => import('./components/sections/Impact').then((module) => ({ default: module.Impact })))
const Performance = lazy(() =>
  import('./components/sections/Performance').then((module) => ({ default: module.Performance })),
)
const Pipeline = lazy(() => import('./components/sections/Pipeline').then((module) => ({ default: module.Pipeline })))
const Monitoring = lazy(() =>
  import('./components/sections/Monitoring').then((module) => ({ default: module.Monitoring })),
)
const Engineering = lazy(() =>
  import('./components/sections/Engineering').then((module) => ({ default: module.Engineering })),
)

function SectionFallback() {
  return (
    <div className="border-b border-border py-20 md:py-28" aria-busy="true" aria-label="Loading section">
      <div className="container-page space-y-6">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-10 w-2/3 max-w-[520px]" />
        <Skeleton className="h-4 w-full max-w-[560px]" />
        <div className="grid gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const { status, retry } = useApiStatus()
  const { data: metrics } = useData<MetricsPayload>('metrics.json')
  const { data: examples } = useData<Example[]>('examples.json')
  const { data: modelInfo } = useData<ModelInfo>('model_info.json')
  const { data: pipelineStatus } = useData<PipelineStatus>('pipeline_status.json')

  useSmoothScroll()

  return (
    <TooltipProvider delayDuration={180}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-btn focus:border focus:border-border focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:text-ink"
      >
        Skip to content
      </a>

      <Grain />
      <Cursor />
      <Nav status={status} />
      <DemoBanner status={status} onRetry={retry} />

      <main id="main">
        <Hero metrics={metrics} examples={examples} testCount={pipelineStatus?.test_count ?? null} />
        <Predictor
          metrics={metrics}
          examples={examples}
          apiStatus={status}
          modelVersion={modelInfo?.version ?? null}
        />

        <Suspense fallback={<SectionFallback />}>
          <Impact metrics={metrics} />
          <Performance metrics={metrics} />
          <Pipeline />
          <Monitoring />
          <Engineering metrics={metrics} status={pipelineStatus} modelVersion={modelInfo?.version ?? null} />
        </Suspense>
      </main>

      <Footer />
    </TooltipProvider>
  )
}
