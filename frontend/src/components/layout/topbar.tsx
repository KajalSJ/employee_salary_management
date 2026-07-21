"use client"

import { usePathname, useRouter } from "next/navigation"
import { LogOut, Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { navItems } from "@/components/layout/nav-items"
import { useAuth } from "@/lib/auth/auth-context"

function pageTitle(pathname: string) {
  const match = navItems.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  )
  return match?.label ?? "Employee Salary Management"
}

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()

  function handleLogout() {
    logout()
    router.replace("/login")
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
      <Button
        variant="ghost"
        size="icon-sm"
        className="md:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        <Menu />
      </Button>
      <h1 className="text-sm font-medium">{pageTitle(pathname)}</h1>
      <div className="ml-auto flex items-center gap-3">
        {user && (
          <span
            className="hidden truncate text-xs text-muted-foreground sm:inline"
            title={user.email}
          >
            {user.email}
          </span>
        )}
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="size-3.5" aria-hidden="true" />
          Log out
        </Button>
      </div>
    </header>
  )
}
