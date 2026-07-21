"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Building2, LogOut, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { navItems } from "@/components/layout/nav-items"
import { useAuth } from "@/lib/auth/auth-context"

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()

  function handleLogout() {
    logout()
    router.replace("/login")
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 -translate-x-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 ease-in-out md:static md:translate-x-0",
          open && "translate-x-0"
        )}
      >
        <div className="flex h-14 items-center justify-between gap-2 border-b border-sidebar-border px-4">
          <div className="flex items-center gap-2 font-semibold">
            <Building2 className="size-5" aria-hidden="true" />
            <span>ACME HR</span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 p-2">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center justify-between gap-2 border-t border-sidebar-border p-2">
          {user && (
            <span
              className="truncate px-1 text-xs text-sidebar-foreground/70"
              title={user.email}
            >
              {user.email}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={handleLogout}
          >
            <LogOut className="size-3.5" aria-hidden="true" />
            Log out
          </Button>
        </div>
      </aside>
    </>
  )
}
