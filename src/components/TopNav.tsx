import { Palette, Sparkles } from 'lucide-react';
import type { AppTab, UserAccount } from '../types/tournament';
import { getThemeConfig, type ScenicThemeId } from '../utils/themes';

interface TopNavProps {
  activeTab: AppTab;
  activeTheme: ScenicThemeId;
  currentUser: UserAccount | null;
  onSelectTab: (tab: AppTab) => void;
  onOpenThemeSwitcher: () => void;
  onOpenReport: () => void;
  rosterDirty: boolean;
}

const NAV_ITEMS: Array<{ id: AppTab; label: string }> = [
  { id: 'schedule', label: '赛程' },
  { id: 'standings', label: '榜单' },
  { id: 'players', label: '球员' },
  { id: 'setup', label: '赛制' },
  { id: 'profile', label: '我的' },
];

export function TopNav({
  activeTab,
  activeTheme,
  currentUser,
  onSelectTab,
  onOpenThemeSwitcher,
  onOpenReport,
  rosterDirty,
}: TopNavProps) {
  const themeCfg = getThemeConfig(activeTheme);

  return (
    <header className="sticky top-0 z-30 h-[52px] md:h-16 theme-glass-strong border-b">
      <div className="max-w-7xl mx-auto h-full px-4 md:px-8 flex items-center justify-between gap-4 md:gap-8">
        {/* Zone 1: Brand wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('schedule')}
          className="text-lg md:text-xl font-extrabold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer"
        >
          轻转匹克
        </button>

        {/* Zone 2: Desktop 5-tab lifecycle navigation */}
        <nav aria-label="主导航" className="hidden md:flex items-center gap-7">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  isActive ? 'text-white font-semibold' : 'text-white/65 hover:text-white'
                }`}
              >
                {item.id === 'profile' && currentUser ? currentUser.displayName : item.label}
                {item.id === 'players' && rosterDirty ? ' · 需重排' : ''}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-0 right-0 h-[2px]"
                    style={{ backgroundColor: 'var(--theme-accent)' }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Scene Theme Switcher + Poster CTA */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenThemeSwitcher}
            aria-label={`切换实景背景主题，当前 ${themeCfg.name}`}
            className="min-h-[38px] px-2.5 sm:px-3 rounded-xl bg-white/[0.1] hover:bg-white/[0.18] border border-white/[0.14] text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <Palette className="w-3.5 h-3.5 theme-accent-text" aria-hidden="true" />
            <span>{themeCfg.shortName}</span>
          </button>

          <button
            type="button"
            onClick={onOpenReport}
            className="min-h-[38px] px-3 sm:px-4 rounded-xl theme-accent-bg text-xs sm:text-sm font-bold active:scale-[0.98] transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            <span>画报</span>
          </button>
        </div>
      </div>
    </header>
  );
}
