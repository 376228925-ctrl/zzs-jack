import { Check, Palette, X } from 'lucide-react';
import { SCENIC_THEMES, type ScenicThemeId } from '../utils/themes';

interface ThemeSwitcherModalProps {
  open: boolean;
  activeTheme: ScenicThemeId;
  onSelectTheme: (id: ScenicThemeId) => void;
  onClose: () => void;
}

export function ThemeSwitcherModal({
  open,
  activeTheme,
  onSelectTheme,
  onClose,
}: ThemeSwitcherModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="theme-switcher-title"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-lg theme-glass-strong border rounded-t-3xl md:rounded-3xl p-5 sm:p-6 pb-safe shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="md:hidden w-10 h-1.5 bg-white/20 rounded-full mx-auto mb-3"
          aria-hidden="true"
        />

        <div className="flex items-start justify-between gap-3 pb-4 border-b border-white/[0.1]">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold theme-accent-text">
              <Palette className="w-3.5 h-3.5" aria-hidden="true" />
              <span>实景氛围 · 一键换肤</span>
            </div>
            <h2 id="theme-switcher-title" className="text-lg font-extrabold text-white mt-0.5">
              切换球场实景背景与色调
            </h2>
            <p className="text-xs text-white/65 mt-0.5">
              全屏实景摄影、玻璃拟态质感、球场配色与主题高亮将同步切换
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭主题切换"
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-white/70 hover:bg-white/[0.1] hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-4">
          {SCENIC_THEMES.map((theme) => {
            const isSelected = activeTheme === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => {
                  onSelectTheme(theme.id);
                  onClose();
                }}
                aria-pressed={isSelected}
                className={`group relative rounded-2xl overflow-hidden border text-left h-40 sm:h-44 flex flex-col justify-end p-3.5 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[var(--theme-accent)] ring-2 ring-[var(--theme-accent)]/50 scale-[1.01]'
                    : 'border-white/15 hover:border-white/40'
                }`}
              >
                <img
                  src={theme.bgImage}
                  alt={theme.name}
                  className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10"
                />

                {/* Top palette dot + active check */}
                <div className="relative z-10 flex items-center justify-between mb-auto">
                  <div className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="w-3.5 h-3.5 rounded-full border border-white/60 shadow"
                      style={{ backgroundColor: theme.swatchBg }}
                    />
                    <span
                      aria-hidden="true"
                      className="w-3.5 h-3.5 rounded-full border border-white/60 shadow"
                      style={{ backgroundColor: theme.swatchAccent }}
                    />
                  </div>
                  {isSelected && (
                    <span className="w-6 h-6 rounded-full theme-accent-bg flex items-center justify-center shadow">
                      <Check className="w-3.5 h-3.5 stroke-[2.8]" aria-hidden="true" />
                    </span>
                  )}
                </div>

                <div className="relative z-10">
                  <div className="text-sm font-extrabold text-white">{theme.name}</div>
                  <div className="text-[11px] text-white/75 mt-0.5">{theme.tagline}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
