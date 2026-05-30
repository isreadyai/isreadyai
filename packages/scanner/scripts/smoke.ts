// Quick end-to-end smoke run: bun scripts/smoke.ts <url>
import { allChecks, scan } from '../src/index.ts'

const print = (line: string): boolean => process.stdout.write(`${line}\n`)

const url = process.argv[2] ?? 'example.com'
const report = await scan(url, { checks: allChecks, onProgress: (m) => console.error(`· ${m}`) })

print(`URL:      ${report.finalUrl}`)
print(`Overall:  ${report.overall} (${report.grade}) in ${report.meta.durationMs}ms`)
for (const c of report.categories) {
  print(`   ${c.label.padEnd(18)} ${String(c.score).padStart(3)}`)
}
const statuses = report.checks.reduce<Record<string, number>>((acc, c) => {
  acc[c.status] = (acc[c.status] ?? 0) + 1
  return acc
}, {})
print(`Checks:   ${report.checks.length} | statuses: ${JSON.stringify(statuses)}`)
for (const c of report.checks.filter((x) => x.status === 'fail' || x.status === 'error')) {
  print(`  ✗ ${c.id}: ${c.detail}`)
}
