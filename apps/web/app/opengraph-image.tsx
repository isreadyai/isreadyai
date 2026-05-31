import { ImageResponse } from 'next/og'
import { allChecks } from '@isreadyai/scanner'

// MARK: - OG image (static, generated at build)

export const alt = 'isready.ai — The future is AI. Is your website ready for AI?'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'radial-gradient(110% 120% at 12% -10%, #2f4413 0%, rgba(47,68,19,0) 45%), radial-gradient(90% 120% at 100% 110%, #1d2b3a 0%, rgba(29,43,58,0) 50%), #161613',
        color: '#ececea',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 44 }}>
        <div
          style={{
            width: 36,
            height: 36,
            background: '#b8f53d',
            transform: 'rotate(45deg)',
            borderRadius: 6,
          }}
        />
        <span style={{ fontWeight: 700 }}>isready</span>
        <span style={{ color: '#8a8a82' }}>.ai</span>
      </div>
      <div
        style={{
          marginTop: 40,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          fontWeight: 800,
          letterSpacing: -3,
        }}
      >
        <div style={{ display: 'flex', fontSize: 76 }}>The future is AI.</div>
        <div style={{ display: 'flex', marginTop: 10, fontSize: 72 }}>
          Is your&nbsp;<span style={{ color: '#b8f53d' }}>website</span>&nbsp;ready for AI?
        </div>
      </div>
      <div style={{ marginTop: 32, fontSize: 30, color: '#8a8a82', display: 'flex' }}>
        {allChecks.length} real checks · GPTBot · ClaudeBot · PerplexityBot · free · open-source
        engine
      </div>
    </div>,
    size,
  )
}
