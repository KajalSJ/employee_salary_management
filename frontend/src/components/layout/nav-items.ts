import { BarChart3, Settings, Users } from "lucide-react"

export const navItems = [
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
] as const
