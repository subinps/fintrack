import { Laptop, Moon, Sun } from "lucide-react"
// Appearance panel: theme and accent live together, both saved per browser
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { AccentPicker } from "@/components/system/AccentPicker"
import { cn } from "@/lib/utils"

const THEMES = [
    { id: "light", label: "Light", icon: Sun },
    { id: "dark", label: "Dark", icon: Moon },
    { id: "system", label: "System", icon: Laptop },
] as const

/** Light / dark / system switcher, used in the appearance popover and on the profile page. */
export function ThemeChooser({ compact = false }: { compact?: boolean }) {
    const { setTheme, theme } = useTheme()

    return (
        <div className={cn("grid grid-cols-3 gap-1.5", compact ? "w-full" : "w-full")} role="group" aria-label="Theme">
            {THEMES.map((option) => {
                const selected = theme === option.id
                return (
                    <button
                        key={option.id}
                        type="button"
                        onClick={() => setTheme(option.id)}
                        aria-pressed={selected}
                        className={cn(
                            "flex h-14 flex-col items-center justify-center gap-1 rounded-xl border text-[11.5px] font-medium transition-colors duration-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover",
                            selected
                                ? "border-primary/40 bg-primary/10 text-primary-strong"
                                : "border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground",
                        )}
                    >
                        <option.icon className="h-4 w-4" aria-hidden="true" />
                        {option.label}
                    </button>
                )
            })}
        </div>
    )
}

export function ThemeToggle() {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Appearance">
                    <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">Appearance</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-3">
                <p className="eyebrow mb-2 px-1">Theme</p>
                <ThemeChooser />
                <div className="my-3 h-px bg-border" aria-hidden="true" />
                <AccentPicker />
            </PopoverContent>
        </Popover>
    )
}
