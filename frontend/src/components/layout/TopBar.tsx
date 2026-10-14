import { Menu, PanelRight, Settings2, ShieldCheck } from "lucide-react";

import { Brand } from "@/components/common/Brand";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { getInitials } from "@/lib/utils";

interface TopBarProps {
  sourceCount: number;
  onOpenNavigation: () => void;
  onOpenSources: () => void;
  onOpenSettings: () => void;
}

export function TopBar({ sourceCount, onOpenNavigation, onOpenSources, onOpenSettings }: TopBarProps) {
  const { settings, logout } = useAuth();
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-white px-3 sm:px-4">
      <div className="flex items-center gap-2.5">
        <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" onClick={onOpenNavigation} aria-label="Open document navigation"><Menu className="h-4 w-4" /></Button>
        <Brand />
        <div className="ml-2 hidden items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-medium text-slate-600 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Local workspace
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg px-2.5 text-[10px] shadow-none" onClick={onOpenSources}>
              <PanelRight className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Sources</span>
              <span className="grid h-4 min-w-4 place-items-center rounded-full bg-slate-100 px-1 text-[8px] text-slate-600">{sourceCount}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open answer sources</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="ml-1 h-8 w-8 rounded-full bg-slate-950 text-[10px] font-semibold text-white hover:bg-slate-800 hover:text-white" aria-label="Account menu">
              {getInitials(settings?.user.email)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <span className="block text-[10px] uppercase tracking-wide">Signed in</span>
              <span className="mt-1 block truncate text-xs font-medium text-foreground">{settings?.user.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onOpenSettings}><Settings2 /> Workspace settings</DropdownMenuItem>
            <DropdownMenuItem disabled><ShieldCheck /> Data stored locally</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout(false)}>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
