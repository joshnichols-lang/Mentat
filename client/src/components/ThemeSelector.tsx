import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "./ThemeProvider";

export default function ThemeSelector() {
  const { themeName, setThemeName } = useTheme();

  const themes = [
    { name: "fox" as const, label: "Fox", description: "Orange & Amber" },
    { name: "cyber" as const, label: "Cyber", description: "Purple & Cyan" },
    { name: "matrix" as const, label: "Matrix", description: "Green Terminal" },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          data-testid="button-theme-selector"
        >
          <Palette className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {themes.map((theme) => (
          <DropdownMenuItem
            key={theme.name}
            onClick={() => setThemeName(theme.name)}
            className={themeName === theme.name ? "bg-accent" : ""}
            data-testid={`menuitem-theme-${theme.name}`}
          >
            <div className="flex flex-col">
              <span className="font-medium">{theme.label}</span>
              <span className="text-xs text-muted-foreground">{theme.description}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
