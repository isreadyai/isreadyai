export { allChecks } from './checks/index.ts'
export {
  buildFixPlan,
  type IFixFile,
  type IFixContext,
  type IFixPatch,
  type IFixPlan,
} from './fix-plan.ts'
export { defineCheck, makeResult, type ICheckDef } from './checks/builder.ts'
export {
  isGrade,
  isScanReport,
  isSiteReport,
  isSmartAgentReport,
  isSmartAgentSiteReport,
} from './guards.ts'
export { NativeProvider, SCANNER_UA, createProviders } from './providers/index.ts'
export {
  normalizeUrl,
  validateScanInput,
  isPrivateAddress,
  firstPrivateHost,
  hostOf,
  EUrlProblem,
  type TValidatedUrl,
  type TUrlProblem,
  type TDnsResolver,
} from './util/url.ts'
export { reportToMarkdown, type TMarkdownMode } from './markdown.ts'
export { scan } from './engine.ts'
export {
  scanSite,
  discoverPages,
  aggregateSiteFindings,
  buildStructuralClusters,
  type IDeepScanOptions,
  type IDiscoverOptions,
  type IDiscoveryResult,
  type ISiteCluster,
  type ISiteReport,
  type ISiteFindingGroup,
} from './crawl.ts'
export { SCORE_VERSION, CATEGORY_WEIGHTS, scoreCategories, overallScore, gradeOf } from './score.ts'
export * from './crawlers.ts'
export * from './smart-agent/index.ts'
export * from './types.ts'
