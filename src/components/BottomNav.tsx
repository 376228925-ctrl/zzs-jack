import { CalendarDays, SlidersHorizontal, Trophy, UserCircle2, Users } from 'lucide-react';
import type { AppTab, UserAccount } from '../types/tournament';

interface BottomNavProps {
  activeTab: AppTab;
  currentUser: UserAccount | null;
  onSelectTab: (tab: AppTab) => void;
  rosterDirty: boolean;
}

/**
 * Product-design optimal tab order following real court-side frequency:
 * 1. 赛程 (Live courts & calendar) -> 2. 榜单 (Standings & AI report)
 * -> 3. 球员 (Roster & calibration) -> 4. 赛制 (Admin publish & rules) -> 5. 我的 (Auth, history & AI review)
 */
const TABS: Array<{
  id: AppTab;
  label: string;
  icon: typeof CalendarDays;
}> = [
  { id: 'schedule', label: '赛程', icon: CalendarDays },
  { id: 'standings', label: '榜单', icon: Trophy },
  { id: 'players', label: '球员', icon: Users },
  { id: 'setup', label: '赛制', icon: SlidersHorizontal },
  { id: 'profile', label: '我的', icon: UserCircle2 },
];

export function BottomNav({
  activeTab,
  currentUser,
  onSelectTab,
  rosterDirty,
}: BottomNavProps) {
  return (
    <nav
      aria-label="底部导航"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 theme-glass-strong border-t pb-safe"
    >
      <div className="grid grid-cols-5 h-[60px] items-center">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                isActive ? 'theme-accent-text' : 'text-white/60'
              }`}
            >
              <span className="relative flex items-center justify-center">
                <Icon
                  className={`w-[20px] h-[20px] ${
                    isActive ? 'stroke-[2.3] theme-accent-text' : 'stroke-[1.75]'
                  }`}
                  aria-hidden="true"
                />
                {tab.id === 'players' && rosterDirty && (
                  <span
                    aria-label="阵容已变动需重排"
                    className="absolute -top-0.5 -right-1.5 text-[10px] font-bold text-[#FF6448]"
                  >
                    !
                  </span>
                )}
              </span>
              <span
                className={`text-[10.5px] leading-none tracking-tight ${
                  isActive ? 'font-bold text-white' : 'font-medium text-white/60'
                }`}
              >
                {tab.id === 'profile' && currentUser ? '我的' : tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
