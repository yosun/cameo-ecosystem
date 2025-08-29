import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    // Add any additional middleware logic here
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Define protected routes
        const protectedPaths = [
          "/dashboard",
          "/creator",
          "/store",
          "/profile",
          "/api/creator",
          "/api/generate",
          "/api/infer",
          "/api/store",
          "/api/checkout"
        ]

        const { pathname } = req.nextUrl

        // Check if the current path is protected
        const isProtectedPath = protectedPaths.some(path => 
          pathname.startsWith(path)
        )

        // Allow access to non-protected paths
        if (!isProtectedPath) {
          return true
        }

        // Require authentication for protected paths
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|public).*)",
  ],
}