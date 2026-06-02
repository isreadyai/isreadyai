import type { ICategoryScore, IScanReport, TGrade } from '@isreadyai/scanner'

export type TShowcaseRow = Pick<ICategoryScore, 'label' | 'score'>

export interface IShowcaseFinding {
  icon: '✗' | '▲' | '✓'
  text: string
  fix?: string
}

export interface IShowcase {
  host: string
  score: IScanReport['overall']
  grade: Uppercase<TGrade>
  rows: TShowcaseRow[]
  findings: IShowcaseFinding[]
}

export interface IShowcaseResponse {
  entries: IShowcase[]
}
