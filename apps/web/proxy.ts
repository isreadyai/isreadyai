import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// MARK: - Session refresh proxy

/**
 * Refreshes the Supabase session cookie on every matched request. Uses
 * getUser() (server-validated, unspoofable) rather than getSession(). Route
 * protection lives in the /dashboard layout, not here.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.next({ request })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (url === undefined || url.length === 0 || key === undefined || key.length === 0) {
    return response
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value)
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // A shared dashboard scan link opened by a signed-out visitor should land on
  // the PUBLIC report, not the /login wall (the /dashboard layout would bounce
  // them otherwise). Authenticated users fall through to the dashboard.
  if (user === null) {
    const match = /^\/dashboard\/scans\/([0-9a-f-]{36})$/i.exec(request.nextUrl.pathname)
    if (match !== null) {
      const target = request.nextUrl.clone()
      target.pathname = `/report/${match[1]}`
      target.search = ''
      const redirect = NextResponse.redirect(target)
      for (const cookie of response.cookies.getAll()) {
        redirect.cookies.set(cookie)
      }
      return redirect
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
