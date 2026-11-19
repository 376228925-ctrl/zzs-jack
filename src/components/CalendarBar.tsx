import { useState } from 'react';
import { Calendar, CheckCircle2, Lock, Plus, X } from 'lucide-react';
import type {
  ScoringTarget,
  TournamentConfig,
  TournamentFormat,
  TournamentState,
  UserAccount,
} from '../types/tournament';
import { canPublishTournament } from '../utils/authStore';
import { getOffsetDateISO } from '../utils/sessionArchive';

interface CalendarBarProps {
  sessions: TournamentState[];
  activeSessionId: string;
  currentUser: UserAccount | null;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: (params: {
    sessionDate: string;
    config: TournamentConfig;
    rosterMode: 'reuse' | 'fresh';
  }) => void;
  onPromptLogin: () => void;
}

function formatShortDate(iso: string): { dayLabel: string; subLabel: string } {
  const today = getOffsetDateISO(0);
  const yesterday = getOffsetDateISO(-1);
  const tomorrow = getOffsetDateISO(1);
  const parts = iso.split('-');
  const md = parts.length === 3 ? `${Number(parts[1])}/${Number(parts[2])}` : iso;

  if (iso === today) return { dayLabel: '今天', subLabel: md };
  if (iso === yesterday) return { dayLabel: '昨天', subLabel: md };
  if (iso === tomorrow) return { dayLabel: '明天', subLabel: md };
  return { dayLabel: md, subLabel: parts[0] || '' };
}

export function CalendarBar({
  sessions,
  activeSessionId,
  currentUser,
  onSelectSession,
  onCreateSession,
  onPromptLogin,
}: CalendarBarProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [date, setDate] = useState(getOffsetDateISO(0));
  const [title, setTitle] = useState('晚场 · 匹克球智能转转赛');
  const [venue, setVenue] = useState('滨江匹克球公园 1-2号场');
  const [format, setFormat] = useState<TournamentFormat>('ai_smart');
  const [courtCount, setCourtCount] = useState(2);
  const [totalRounds, setTotalRounds] = useState(6);
  const [targetScore, setTargetScore] = useState<ScoringTarget>(11);
  const [rosterMode, setRosterMode] = useState<'reuse' | 'fresh'>('fresh');
  const [permNotice, setPermNotice] = useState(false);

  const canPublish = canPublishTournament(currentUser);

  // Sort sessions newest date first
  const sortedSessions = [...sessions].sort((a, b) => {
    const da = a.sessionDate || '';
    const db = b.sessionDate || '';
    if (db !== da) return db.localeCompare(da);
    return b.createdAt - a.createdAt;
  });

  const handleOpenCreate = () => {
    if (!canPublish) {
      setPermNotice(true);
      return;
    }
    setPermNotice(false);
    setDate(getOffsetDateISO(0));
    setCreateOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateSession({
      sessionDate: date || getOffsetDateISO(0),
      rosterMode,
      config: {
        title: title.trim() || `${date} 匹克球转转赛`,
        venue: venue.trim() || '匹克球场',
        format,
        courtCount,
        totalRounds,
        targetScore,
        winByTwo: true,
        roundMinutes: 12,
      },
    });
    setCreateOpen(false);
  };

  return (
    <section aria-label="赛事日历与历史局切换" className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-white/85">
          <Calendar className="w-3.5 h-3.5 theme-accent-text shrink-0" aria-hidden="true" />
          <span>赛事日历 · 历史局归档</span>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="min-h-[34px] px-3 rounded-xl text-xs font-bold theme-accent-bg transition-all inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
        >
          {canPublish ? (
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <Lock className="w-3 h-3" aria-hidden="true" />
          )}
          <span>发布新赛局</span>
        </button>
      </div>

      {permNotice && (
        <div className="theme-glass border rounded-2xl p-3 flex items-center justify-between gap-3 text-xs">
          <span className="text-white/85">
            仅<strong>超级管理员 / 赛事管理员</strong>可发布新日期赛局（普通球友可随时查阅历史与记分）。
          </span>
          <button
            type="button"
            onClick={() => {
              setPermNotice(false);
              onPromptLogin();
            }}
            className="px-3 py-1.5 rounded-lg theme-accent-bg font-bold whitespace-nowrap shrink-0 cursor-pointer"
          >
            去登录
          </button>
        </div>
      )}

      {/* Horizontal Calendar Session Cards */}
      <div className="flex items-stretch gap-2 overflow-x-auto no-scrollbar pb-0.5">
        {sortedSessions.map((s) => {
          const active = s.id === activeSessionId;
          const totalM = s.rounds.reduce((sum, r) => sum + r.matches.length, 0);
          const doneM = s.rounds.reduce(
            (sum, r) => sum + r.matches.filter((m) => m.status === 'completed').length,
            0
          );
          const allDone = totalM > 0 && doneM === totalM;
          const { dayLabel, subLabel } = formatShortDate(s.sessionDate || getOffsetDateISO(0));

          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelectSession(s.id)}
              aria-pressed={active}
              className={`min-w-[158px] max-w-[210px] px-3.5 py-2.5 rounded-2xl border text-left transition-all shrink-0 cursor-pointer ${
                active
                  ? 'theme-glass-strong border-[var(--theme-accent)] shadow-lg'
                  : 'theme-glass border-white/15 hover:border-white/35 opacity-85 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
                <span className={active ? 'theme-accent-text font-bold' : 'text-white/75 font-semibold'}>
                  {dayLabel} {subLabel}
                </span>
                {allDone ? (
                  <span className="inline-flex items-center gap-0.5 text-[#34E39C] font-semibold">
                    <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                    <span>已归档</span>
                  </span>
                ) : (
                  <span className="text-white/70">
                    {doneM}/{totalM}场
                  </span>
                )}
              </div>
              <div className="text-xs font-bold text-white truncate mt-1">
                {s.config.title}
              </div>
            </button>
          );
        })}
      </div>

      {/* New Calendar Date Session Modal */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/75 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-session-title"
          onClick={() => setCreateOpen(false)}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full md:max-w-lg theme-glass-strong border rounded-t-3xl md:rounded-3xl p-5 sm:p-6 pb-safe shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/[0.1]">
              <div>
                <p className="text-xs font-bold theme-accent-text">
                  管理员发布 · 历史赛局自动保留不覆盖
                </p>
                <h2 id="create-session-title" className="text-lg font-extrabold text-white mt-0.5">
                  新建日期赛局
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                aria-label="关闭新建赛局"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-white/70 hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-white/75 mb-1">比赛日期</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl bg-black/35 border border-white/15 px-3 text-sm text-white font-mono focus:outline-none focus:border-[var(--theme-accent)]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/75 mb-1">赛制模式</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as TournamentFormat)}
                  className="w-full min-h-[42px] rounded-xl bg-black/35 border border-white/15 px-3 text-sm text-white focus:outline-none focus:border-[var(--theme-accent)]"
                >
                  <option value="ai_smart" className="bg-[#121622]">AI 智适应排阵</option>
                  <option value="classic" className="bg-[#121622]">经典全员转</option>
                  <option value="balanced" className="bg-[#121622]">水平均衡转</option>
                  <option value="mixed" className="bg-[#121622]">混双优选转</option>
                  <option value="mexicano" className="bg-[#121622]">胜者升场制</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-white/75 mb-1">赛局名称</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl bg-black/35 border border-white/15 px-3 text-sm text-white focus:outline-none focus:border-[var(--theme-accent)]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/75 mb-1">球馆地点</label>
                <input
                  type="text"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl bg-black/35 border border-white/15 px-3 text-sm text-white focus:outline-none focus:border-[var(--theme-accent)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-white/75 mb-1">场地数</label>
                <select
                  value={courtCount}
                  onChange={(e) => setCourtCount(Number(e.target.value))}
                  className="w-full min-h-[42px] rounded-xl bg-black/35 border border-white/15 px-3 text-sm text-white font-mono"
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n} className="bg-[#121622]">{n}片场</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/75 mb-1">总轮次</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={totalRounds}
                  onChange={(e) => setTotalRounds(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
                  className="w-full min-h-[42px] rounded-xl bg-black/35 border border-white/15 px-3 text-sm text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/75 mb-1">目标分</label>
                <select
                  value={targetScore}
                  onChange={(e) => setTargetScore(Number(e.target.value) as ScoringTarget)}
                  className="w-full min-h-[42px] rounded-xl bg-black/35 border border-white/15 px-3 text-sm text-white font-mono"
                >
                  {[11, 15, 21].map((pts) => (
                    <option key={pts} value={pts} className="bg-[#121622]">{pts}分制</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-white/75">初始名单方式</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRosterMode('fresh')}
                  className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                    rosterMode === 'fresh'
                      ? 'bg-white/12 border-[var(--theme-accent)] text-white font-bold'
                      : 'bg-black/25 border-white/10 text-white/75'
                  }`}
                >
                  <div>全新接龙录入</div>
                  <div className="text-[11px] font-normal text-white/60 mt-0.5">
                    开局后直接粘贴今日微信接龙
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setRosterMode('reuse')}
                  className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                    rosterMode === 'reuse'
                      ? 'bg-white/12 border-[var(--theme-accent)] text-white font-bold'
                      : 'bg-black/25 border-white/10 text-white/75'
                  }`}
                >
                  <div>复用常驻班底</div>
                  <div className="text-[11px] font-normal text-white/60 mt-0.5">
                    沿用当前名单立即生成首轮
                  </div>
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full min-h-[46px] rounded-xl theme-accent-bg text-sm font-bold transition-all cursor-pointer"
            >
              确认发布并切换到该日期
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
