"use client"

import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { navItems } from "@/components/layout/nav-items"

function pageTitle(pathname: string) {
  const match = navItems.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  )
  return match?.label ?? "Employee Salary Management"
}

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname()

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
    </header>
  )
}
