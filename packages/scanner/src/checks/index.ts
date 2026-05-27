import type { ICheck } from '../types.ts'
import { crawlerChecks } from './crawler/index.ts'
import { renderingChecks } from './rendering/index.ts'
import { structuredDataChecks } from './structured-data/index.ts'
import { trustChecks } from './trust/index.ts'
import { geoChecks } from './geo/index.ts'
import { llmsTxtCheck } from './llms-txt.ts'
import { contentSignalsCheck } from './content-signals.ts'

// MARK: - Registry

export const allChecks: ICheck[] = [
  ...crawlerChecks,
  ...renderingChecks,
  ...structuredDataChecks,
  ...trustChecks,
  ...geoChecks,
  llmsTxtCheck,
  contentSignalsCheck,
]
