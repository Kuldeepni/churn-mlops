import { ArrowUp, ArrowUpRight, Github } from 'lucide-react'
import { siteConfig } from '../../config/site'
import { Logo } from '../visuals/Logo'

const columns = [
  {
    title: 'Project',
    links: [
      { label: 'GitHub repository', href: siteConfig.githubUrl },
      { label: 'README', href: siteConfig.links.readme },
      { label: 'MIT license', href: siteConfig.links.license },
    ],
  },
  {
    title: 'Build',
    links: [
      { label: 'Pipeline source', href: siteConfig.links.pipeline },
      { label: 'DVC pipeline', href: siteConfig.links.dvc },
      { label: 'CI workflow', href: siteConfig.links.ci },
      { label: 'Dockerfile', href: siteConfig.links.docker },
    ],
  },
  {
    title: 'Model',
    links: [
      { label: 'API reference', href: siteConfig.apiDocs },
      { label: 'Evaluation gate', href: siteConfig.links.evaluate },
      { label: 'Tests', href: siteConfig.links.tests },
      { label: 'Training params', href: siteConfig.links.params },
    ],
  },
]

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="container-page pb-10 pt-16 md:pt-20">
        <p className="display max-w-[14ch] text-[clamp(3rem,9vw,7rem)] leading-[0.9] tracking-[-0.04em] text-ink">
          Decide by <em className="text-accent">profit.</em>
        </p>

        <div className="mt-14 grid gap-10 border-t border-border pt-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-[30ch] text-[13px] leading-6 text-muted">
              An open-source MLOps case study. Calibrated probabilities, a cost-based cutoff, and a monitored
              serving path.
            </p>
            <a
              href={siteConfig.author.url}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
            >
              Built by {siteConfig.author.name}
              <ArrowUpRight size={13} aria-hidden="true" />
            </a>
          </div>

          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h3 className="overline">{column.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[13px] text-muted transition-colors hover:text-ink"
                    >
                      {link.label}
                      <ArrowUpRight size={11} className="text-faint" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-border pt-6 text-[11px] text-faint sm:flex-row sm:items-center sm:justify-between">
          <p>
            Portfolio project using the public IBM Telco Customer Churn dataset. MIT licensed. Not affiliated with
            IBM.
          </p>
          <div className="flex items-center gap-5">
            <a
              href={siteConfig.githubUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-ink"
            >
              <Github size={12} aria-hidden="true" />
              Source
            </a>
            <a href="#top" className="inline-flex items-center gap-1.5 transition-colors hover:text-ink">
              Back to top
              <ArrowUp size={12} aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
