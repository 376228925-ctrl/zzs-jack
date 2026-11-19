import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  ChevronRight,
  Cloud,
  LayoutGrid,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Table2,
  Timer,
  UserCheck,
} from 'lucide-react';
import type {
  Match,
  Player,
  PlayerStanding,
  ScheduleFairnessReport,
  TournamentConfig,
  TournamentFormat,
  TournamentState,
  UserAccount,
} from '../types/tournament';
import { getPlayerScheduleTimeline } from '../utils/scheduler';
import { getThemeConfig, type ScenicThemeId } from '../utils/themes';
import { CalendarBar } from './CalendarBar';
import { MatchCard } from './MatchCard';

interface ScheduleViewProps {
  state: TournamentState;
  sessions: TournamentState[];
  activeTheme: ScenicThemeId;
  currentUser: UserAccount | null;
  standings: PlayerStanding[];
  fairness: ScheduleFairnessReport;
  activeRoundNumber: number;
  roomCode: string | null;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: (params: {
    sessionDate: string;
    config: TournamentConfig;
    rosterMode: 'reuse' | 'fresh';
  }) => void;
  onPromptLogin: () => void;
  onSelectRound: (roundNumber: number) => void;
  onOpenScore: (match: Match) => void;
  onOpenAiPreview: (match: Match) => void;
  onOpenAiMatchmake: () => void;
  onOpenCloudSync: () => void;
  onSwapPlayers: (roundNumber: number, playerIdA: string, playerIdB: string) => void;
  onGenerateNextMexicano: () => void;
  onRescheduleRemaining: () => void;
  onGoToStandings: () => void;
  onGoToPlayers: () => void;
}

const FORMAT_LABELS: Record<TournamentFormat, string> = {
  classic: '经典全员转',
  balanced: '水平均衡转',
  mixed: '混双优选转',
  mexicano: '胜者升场制',
  ai_smart: 'AI 智适应排阵',
};

function formatClock(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function ScheduleView({
  state,
  sessions,
  activeTheme,
  currentUser,
  standings,
  fairness,
  activeRoundNumber,
  roomCode,
  onSelectSession,
  onCreateSession,
  onPromptLogin,
  onSelectRound,
  onOpenScore,
  onOpenAiPreview,
  onOpenAiMatchmake,
  onOpenCloudSync,
  onSwapPlayers,
  onGenerateNextMexicano,
  onRescheduleRemaining,
  onGoToStandings,
  onGoToPlayers,
}: ScheduleViewProps) {
  const [viewMode, setViewMode] = useState<'court' | 'matrix'>('court');
  const [focusedPlayerId, setFocusedPlayerId] = useState<string | null>(null);
  const [swapMode, setSwapMode] = useState(false);
  const [selectedSwapId, setSelectedSwapId] = useState<string | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const themeCfg = getThemeConfig(activeTheme);

  const initialSeconds = state.config.roundMinutes * 60;
  const [secondsLeft, setSecondsLeft] = useState<number>(initialSeconds);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);

  useEffect(() => {
    setSecondsLeft(state.config.roundMinutes * 60);
    setTimerRunning(false);
  }, [state.config.roundMinutes]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  useEffect(() => {
    setSwapMode(false);
    setSelectedSwapId(null);
  }, [activeRoundNumber, viewMode]);

  const playerMap = useMemo(() => {
    const map = new Map<string, Player>();
    state.players.forEach((p) => map.set(p.id, p));
    return map;
  }, [state.players]);

  const focusedPlayer = focusedPlayerId ? playerMap.get(focusedPlayerId) ?? null : null;

  const personalTimeline = useMemo(() => {
    if (!focusedPlayerId) return [];
    return getPlayerScheduleTimeline(focusedPlayerId, state.rounds, playerMap);
  }, [focusedPlayerId, state.rounds, playerMap]);

  const currentRound =
    state.rounds.find((r) => r.roundNumber === activeRoundNumber) ?? state.rounds[0] ?? null;

  const totalMatches = state.rounds.reduce((sum, r) => sum + r.matches.length, 0);
  const completedMatches = state.rounds.reduce(
    (sum, r) => sum + r.matches.filter((m) => m.status === 'completed').length,
    0
  );
  const progressPct = totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0;
  const activePlayerCount = state.players.filter((p) => p.active).length;

  const isLatestRoundCompleted =
    state.rounds.length > 0 &&
    state.rounds[state.rounds.length - 1].matches.every((m) => m.status === 'completed');

  const canSwapCurrentRound =
    viewMode === 'court' &&
    currentRound !== null &&
    currentRound.matches.some((m) => m.status !== 'completed');

  const handleSelectSwapPlayer = (playerId: string) => {
    if (!currentRound) return;
    if (!selectedSwapId) {
      setSelectedSwapId(playerId);
      return;
    }
    if (selectedSwapId === playerId) {
      setSelectedSwapId(null);
      return;
    }
    onSwapPlayers(currentRound.roundNumber, selectedSwapId, playerId);
    setSelectedSwapId(null);
    setSwapMode(false);
  };

  return (
    <div className="space-y-5">
      {/* Multi-Day Tournament Calendar & Historical Session Switcher */}
      <CalendarBar
        sessions={sessions}
        activeSessionId={state.id}
        currentUser={currentUser}
        onSelectSession={onSelectSession}
        onCreateSession={onCreateSession}
        onPromptLogin={onPromptLogin}
      />

      {/* Cinematic Scenic Court Hero Banner */}
      <section className="relative rounded-3xl overflow-hidden border border-white/[0.18] min-h-[210px] sm:min-h-[235px] flex flex-col justify-end shadow-2xl">
        {!heroImgFailed ? (
          <img
            src={themeCfg.bgImage}
            alt={`${themeCfg.name} 匹克球实景球场`}
            referrerPolicy="no-referrer"
            onError={() => setHeroImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover object-center transition-all duration-500"
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-br from-[#1B2A4A] to-[#0B0F18]"
          />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/48 to-black/15"
        />

        <div className="relative z-10 p-5 sm:p-7 flex flex-col md:flex-row md:items-end md:justify-between gap-5">
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-bold theme-accent-text">
              <span>{FORMAT_LABELS[state.config.format]}</span>
              <span aria-hidden="true" className="text-white/35">
                ·
              </span>
              <span className="font-mono tabular-nums text-white/90">
                {state.config.targetScore}分制
              </span>
              <span aria-hidden="true" className="text-white/35">
                ·
              </span>
              <span className="font-mono tabular-nums text-white/90">
                {activePlayerCount}人 / {state.config.courtCount}片场
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow">
              {state.config.title}
            </h1>

            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-white/85">
              <span>{state.config.venue || '未设球馆'}</span>
              {state.publishedBy && (
                <>
                  <span aria-hidden="true" className="text-white/30">
                    ·
                  </span>
                  <span className="text-xs text-white/75">发布者 {state.publishedBy}</span>
                </>
              )}
              <span aria-hidden="true" className="text-white/30">
                ·
              </span>
              <button
                type="button"
                onClick={onOpenCloudSync}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white hover:opacity-85 transition-opacity cursor-pointer"
              >
                <Cloud className="w-3.5 h-3.5 theme-accent-text" aria-hidden="true" />
                <span>{roomCode ? `云端房间 ${roomCode}` : '云同步 / 存档'}</span>
              </button>
            </div>
          </div>

          {/* Right HUD: Progress + Oversized Broadcast Countdown Clock */}
          <div className="flex items-center justify-between md:justify-end gap-4 pt-3.5 md:pt-0 border-t border-white/[0.16] md:border-t-0">
            <div className="text-left md:text-right min-w-[82px]">
              <div className="text-[11px] text-white/75">完赛进度</div>
              <div className="font-score italic text-3xl font-extrabold leading-none theme-accent-text mt-0.5">
                {completedMatches}
                <span className="text-white/55 not-italic font-semibold text-lg">/{totalMatches}</span>
              </div>
              <div className="w-20 h-1 bg-white/20 rounded-full overflow-hidden mt-1.5 md:ml-auto">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%`, backgroundColor: 'var(--theme-accent)' }}
                />
              </div>
            </div>

            <div className="h-10 w-px bg-white/[0.18]" aria-hidden="true" />

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 pr-1">
                <Timer className="w-4 h-4 theme-accent-text" aria-hidden="true" />
                <span
                  className={`font-score italic text-3xl font-extrabold tracking-wide leading-none ${
                    secondsLeft === 0 ? 'text-[#FF6448]' : 'text-white'
                  }`}
                  aria-label="本轮倒计时"
                >
                  {formatClock(secondsLeft)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setTimerRunning((v) => !v)}
                aria-label={timerRunning ? '暂停本轮计时' : '开始本轮计时'}
                className="min-h-[42px] min-w-[42px] rounded-xl bg-white/[0.14] backdrop-blur-md hover:bg-white/[0.24] text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                {timerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTimerRunning(false);
                  setSecondsLeft(state.config.roundMinutes * 60);
                }}
                aria-label="重置本轮计时"
                className="min-h-[42px] min-w-[42px] rounded-xl bg-white/[0.1] hover:bg-white/[0.18] text-white/85 flex items-center justify-center transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Roster-Dirty Smart Reschedule Banner */}
      {state.rosterDirty && (
        <div className="rounded-2xl bg-[#151D2B] border border-[#D4FF2B]/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-[#F4F7FB]">
              检测到球员阵容有变动（新增或暂离）
            </p>
            <p className="text-xs text-[#9AA5BC]">
              已完赛轮次与积分将完整保留，智能引擎可即时重新优化后续未赛轮次。
            </p>
          </div>
          <button
            type="button"
            onClick={onRescheduleRemaining}
            className="min-h-[44px] px-4 rounded-xl bg-[#D4FF2B] text-[#080B10] text-sm font-bold hover:bg-[#E1FF61] transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            <span>智能重排未赛轮次</span>
          </button>
        </div>
      )}

      {/* Personal Spotlight ("我的视角") Focus Rail */}
      <section aria-label="个人聚焦筛选" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#B8C4DA] whitespace-nowrap">
            <UserCheck className="w-4 h-4 text-[#D4FF2B] shrink-0" aria-hidden="true" />
            <span>个人对阵视角</span>
          </div>

          {/* View Mode Switcher: 球场视角 vs 全景总览 */}
          <div className="inline-flex items-center p-1 rounded-xl bg-[#111620] border border-white/[0.08] shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('court')}
              aria-pressed={viewMode === 'court'}
              className={`min-h-[34px] px-2.5 sm:px-3 rounded-lg text-xs font-semibold flex items-center gap-1 whitespace-nowrap transition-all cursor-pointer ${
                viewMode === 'court'
                  ? 'bg-[#D4FF2B] text-[#080B10]'
                  : 'text-[#8E9AB2] hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
              <span>球场视角</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              aria-pressed={viewMode === 'matrix'}
              className={`min-h-[34px] px-2.5 sm:px-3 rounded-lg text-xs font-semibold flex items-center gap-1 whitespace-nowrap transition-all cursor-pointer ${
                viewMode === 'matrix'
                  ? 'bg-[#D4FF2B] text-[#080B10]'
                  : 'text-[#8E9AB2] hover:text-white'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>全景总览</span>
            </button>
          </div>
        </div>

        {/* Horizontal Player Focus Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          <button
            type="button"
            onClick={() => setFocusedPlayerId(null)}
            aria-pressed={focusedPlayerId === null}
            className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
              focusedPlayerId === null
                ? 'bg-[#F4F7FB] text-[#080B10]'
                : 'bg-[#111620] border border-white/[0.08] text-[#9AA5BC] hover:text-white'
            }`}
          >
            全部视角
          </button>
          {state.players
            .filter((p) => p.active)
            .map((p) => {
              const active = focusedPlayerId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setFocusedPlayerId(active ? null : p.id)}
                  aria-pressed={active}
                  className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                    active
                      ? 'bg-[#D4FF2B] text-[#080B10] font-bold'
                      : 'bg-[#111620] border border-white/[0.08] text-[#D8E1F0] hover:border-white/25'
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
        </div>

        {/* Focused Player's Personal Stadium-Pass Round Timeline */}
        {focusedPlayer && personalTimeline.length > 0 && (
          <div className="rounded-2xl bg-[#111620] border border-[#D4FF2B]/35 p-3.5 sm:p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="font-bold text-[#F4F7FB]">
                {focusedPlayer.name} · 今日全轮次路线图
              </div>
              <button
                type="button"
                onClick={() => setFocusedPlayerId(null)}
                className="text-[#D4FF2B] font-medium hover:underline cursor-pointer"
              >
                退出聚焦
              </button>
            </div>
            <div className="flex items-stretch gap-2 overflow-x-auto no-scrollbar pb-0.5">
              {personalTimeline.map((item) => {
                const isSelectedRound =
                  viewMode === 'court' && currentRound?.roundNumber === item.roundNumber;
                return (
                  <button
                    key={item.roundNumber}
                    type="button"
                    onClick={() => {
                      onSelectRound(item.roundNumber);
                      setViewMode('court');
                    }}
                    className={`min-w-[118px] p-2.5 rounded-xl border text-left transition-all shrink-0 cursor-pointer ${
                      isSelectedRound
                        ? 'bg-[#182338] border-[#D4FF2B] text-white'
                        : 'bg-[#0B0F17] border-white/[0.08] text-[#D8E1F0] hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                      <span
                        className={
                          isSelectedRound ? 'text-[#D4FF2B] font-bold' : 'text-[#8E9AB2] font-semibold'
                        }
                      >
                        第{item.roundNumber}轮
                      </span>
                      {item.status === 'resting' ? (
                        <span className="text-[#8E9AB2]">轮空</span>
                      ) : item.status === 'win' ? (
                        <span className="text-[#22D38B] font-bold">
                          胜 {item.myScore}:{item.oppScore}
                        </span>
                      ) : item.status === 'loss' ? (
                        <span className="text-[#FF6448] font-bold">
                          负 {item.myScore}:{item.oppScore}
                        </span>
                      ) : (
                        <span className="text-[#D4FF2B] font-semibold">{item.courtNumber}号场</span>
                      )}
                    </div>
                    <div className="text-xs font-medium mt-1 truncate text-[#F4F7FB]">
                      {item.status === 'resting' ? '本轮场边休整' : `搭档 ${item.partnerName}`}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Main Responsive Split: Left 8-col Courts/Matrix + Right 4-col Desktop Live Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-4">
          {viewMode === 'court' ? (
            <>
              {/* Horizontal Round Selector Strip */}
              <div className="flex items-center justify-between gap-3">
                <div
                  role="tablist"
                  aria-label="选择比赛轮次"
                  className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-1"
                >
                  {state.rounds.map((round) => {
                    const isActive = currentRound?.roundNumber === round.roundNumber;
                    const doneCount = round.matches.filter((m) => m.status === 'completed').length;
                    const allDone = round.matches.length > 0 && doneCount === round.matches.length;
                    return (
                      <button
                        key={round.roundNumber}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => onSelectRound(round.roundNumber)}
                        className={`min-h-[44px] px-4 rounded-xl text-sm font-medium whitespace-nowrap shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                          isActive
                            ? 'bg-[#F4F7FB] text-[#080B10] font-bold'
                            : 'bg-[#111620] border border-white/[0.08] text-[#9AA5BC] hover:text-white hover:border-white/25'
                        }`}
                      >
                        <span>第{round.roundNumber}轮</span>
                        <span
                          className={`font-mono tabular-nums text-[11px] ${
                            isActive
                              ? allDone
                                ? 'text-[#0D7A4F] font-bold'
                                : 'text-[#080B10]/65'
                              : allDone
                              ? 'text-[#22D38B]'
                              : 'text-[#66738D]'
                          }`}
                        >
                          {doneCount}/{round.matches.length}
                        </span>
                      </button>
                    );
                  })}

                  {state.config.format === 'mexicano' && (
                    <button
                      type="button"
                      onClick={onGenerateNextMexicano}
                      disabled={!isLatestRoundCompleted || activePlayerCount < 4}
                      className="min-h-[44px] px-3.5 rounded-xl bg-[#D4FF2B] text-[#080B10] text-sm font-bold whitespace-nowrap shrink-0 hover:bg-[#E1FF61] disabled:opacity-35 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" />
                      <span>生成下轮升场</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Round Toolbar */}
              {currentRound && (
                <div className="flex items-center justify-between gap-3 px-0.5">
                  <div className="text-xs sm:text-sm text-[#8E9AB2] min-w-0 truncate">
                    <span className="font-bold text-[#F4F7FB]">
                      第 {currentRound.roundNumber} 轮
                      <span className="hidden sm:inline">球场分布</span>
                    </span>
                    <span aria-hidden="true" className="mx-1.5 text-white/25">
                      ·
                    </span>
                    <span>
                      {currentRound.matches.length} 场
                      <span className="hidden sm:inline">同时开打</span>
                    </span>
                    {currentRound.restingPlayerIds.length > 0 && (
                      <>
                        <span aria-hidden="true" className="mx-1.5 text-white/25">
                          ·
                        </span>
                        <span>{currentRound.restingPlayerIds.length} 人轮空</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {activePlayerCount >= 4 && (
                      <button
                        type="button"
                        onClick={onOpenAiMatchmake}
                        className="min-h-[40px] px-3 rounded-xl text-xs font-bold bg-[#162238] border border-[#D4FF2B]/45 text-[#D4FF2B] hover:bg-[#1D2D4A] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>AI 智排</span>
                      </button>
                    )}

                    {canSwapCurrentRound && (
                      <button
                        type="button"
                        onClick={() => {
                          setSwapMode((v) => !v);
                          setSelectedSwapId(null);
                        }}
                        className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                          swapMode
                            ? 'bg-[#D4FF2B] text-[#080B10] font-bold'
                            : 'bg-[#111620] border border-white/[0.1] text-[#D8E1F0] hover:border-white/25'
                        }`}
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{swapMode ? '完成换人' : '微调换人'}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {swapMode && (
                <p className="text-xs text-[#D4FF2B] bg-[#161E2D] border border-[#D4FF2B]/35 rounded-xl px-3.5 py-2.5">
                  {selectedSwapId
                    ? `已选中「${playerMap.get(selectedSwapId)?.name ?? ''}」，请点击球场上另一位球员（或轮空球员）完成互换。`
                    : '请依次点击球场上任意两位未完赛球员即可即时互换站位。'}
                </p>
              )}

              {/* Visual Floodlit Hard-Court Match Cards */}
              {!currentRound || currentRound.matches.length === 0 ? (
                <div className="bg-[#111620] rounded-3xl border border-white/[0.08] p-8 text-center space-y-3">
                  <p className="text-base font-bold text-[#F4F7FB]">
                    当前活跃球员不足 4 人，暂无法排阵
                  </p>
                  <p className="text-sm text-[#8E9AB2]">
                    请前往「球员」页面添加球友或使用微信接龙一键导入。
                  </p>
                  <button
                    type="button"
                    onClick={onGoToPlayers}
                    className="min-h-[44px] px-5 rounded-xl bg-[#D4FF2B] text-[#080B10] text-sm font-bold hover:bg-[#E1FF61] cursor-pointer"
                  >
                    去添加球员
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {currentRound.matches.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      playerMap={playerMap}
                      swapMode={swapMode}
                      selectedSwapPlayerId={selectedSwapId}
                      focusedPlayerId={focusedPlayerId}
                      onOpenScore={onOpenScore}
                      onOpenAiPreview={onOpenAiPreview}
                      onSelectSwapPlayer={handleSelectSwapPlayer}
                    />
                  ))}
                </div>
              )}

              {/* Resting / Bye Players Row */}
              {currentRound && currentRound.restingPlayerIds.length > 0 && (
                <section className="bg-[#111620] rounded-2xl border border-white/[0.08] p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h2 className="text-sm font-bold text-[#F4F7FB]">
                      本轮轮空候场（{currentRound.restingPlayerIds.length}人）
                    </h2>
                    <span className="text-xs text-[#8E9AB2]">公平轮换自动分配</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {currentRound.restingPlayerIds.map((pid) => {
                      const p = playerMap.get(pid);
                      if (!p) return null;
                      const isFocused = focusedPlayerId === pid;
                      const isSelected = swapMode && selectedSwapId === pid;
                      return swapMode ? (
                        <button
                          key={pid}
                          type="button"
                          onClick={() => handleSelectSwapPlayer(pid)}
                          className={`min-h-[44px] px-3.5 rounded-xl text-sm font-semibold border transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[#D4FF2B] text-[#080B10] border-[#D4FF2B]'
                              : 'bg-[#171E2B] text-[#F4F7FB] border-white/[0.1] hover:border-[#D4FF2B]/60'
                          }`}
                        >
                          {p.name} · {p.rating.toFixed(1)}
                        </button>
                      ) : (
                        <div
                          key={pid}
                          className={`px-3 py-2 rounded-xl text-sm flex items-center gap-1.5 border ${
                            isFocused
                              ? 'bg-[#1A2416] border-[#D4FF2B]/70 text-[#D4FF2B] font-bold'
                              : 'bg-[#171E2B] border-white/[0.06] text-[#E2E8F5]'
                          }`}
                        >
                          <span className="font-medium">{p.name}</span>
                          <span className="text-xs font-mono tabular-nums text-[#8E9AB2]">
                            {p.rating.toFixed(1)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          ) : (
            /* ALL-ROUNDS BROADCAST MATRIX VIEW ("全景总览") */
            <section aria-label="全景对阵总览" className="space-y-3">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-xs sm:text-sm font-bold text-[#F4F7FB]">
                  全赛程全景矩阵（点击任意场次快捷记分）
                </span>
                <span className="text-xs text-[#8E9AB2] font-mono tabular-nums">
                  共 {state.rounds.length} 轮
                </span>
              </div>

              <div className="space-y-3">
                {state.rounds.map((round) => {
                  const done = round.matches.filter((m) => m.status === 'completed').length;
                  return (
                    <div
                      key={round.roundNumber}
                      className="bg-[#111620] rounded-2xl border border-white/[0.08] overflow-hidden"
                    >
                      <div className="px-4 py-2.5 bg-[#161D2A] border-b border-white/[0.06] flex items-center justify-between text-xs">
                        <span className="font-bold text-[#F4F7FB]">第 {round.roundNumber} 轮</span>
                        <div className="flex items-center gap-2 text-[#8E9AB2] font-mono tabular-nums">
                          {round.restingPlayerIds.length > 0 && (
                            <span>
                              轮空：
                              {round.restingPlayerIds
                                .map((id) => playerMap.get(id)?.name ?? '')
                                .join('、')}
                            </span>
                          )}
                          <span className={done === round.matches.length ? 'text-[#22D38B] font-semibold' : ''}>
                            {done}/{round.matches.length} 场
                          </span>
                        </div>
                      </div>

                      <div className="divide-y divide-white/[0.06]">
                        {round.matches.map((m) => {
                          const hasFocus =
                            focusedPlayerId &&
                            (m.teamA.includes(focusedPlayerId) || m.teamB.includes(focusedPlayerId));
                          const completed = m.status === 'completed' && m.scoreA !== null && m.scoreB !== null;
                          const winA = completed && (m.scoreA ?? 0) > (m.scoreB ?? 0);
                          const winB = completed && (m.scoreB ?? 0) > (m.scoreA ?? 0);

                          const renderName = (id: string) => {
                            const n = playerMap.get(id)?.name ?? '球友';
                            const isMe = focusedPlayerId === id;
                            return (
                              <span
                                key={id}
                                className={
                                  isMe
                                    ? 'text-[#D4FF2B] font-extrabold'
                                    : ''
                                }
                              >
                                {n}
                              </span>
                            );
                          };

                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => onOpenScore(m)}
                              className={`w-full min-h-[54px] px-4 py-3 grid grid-cols-[42px_1fr_auto_1fr] items-center gap-2 text-left transition-colors cursor-pointer ${
                                hasFocus
                                  ? 'bg-[#192338] hover:bg-[#1E2B44]'
                                  : 'hover:bg-white/[0.03]'
                              }`}
                            >
                              <span className="font-score italic text-base font-bold text-[#D4FF2B]">
                                {String(m.courtNumber).padStart(2, '0')}场
                              </span>

                              <div
                                className={`text-xs sm:text-sm truncate flex items-center gap-1 ${
                                  winA ? 'font-bold text-white' : 'text-[#B8C4DA]'
                                }`}
                              >
                                {renderName(m.teamA[0])}
                                <span className="text-white/25">/</span>
                                {renderName(m.teamA[1])}
                              </div>

                              <div className="px-2 text-center">
                                {completed ? (
                                  <span className="font-score italic text-lg font-bold tracking-wide whitespace-nowrap">
                                    <span className={winA ? 'text-[#D4FF2B]' : 'text-[#8E9AB2]'}>
                                      {m.scoreA}
                                    </span>
                                    <span className="text-white/25 mx-0.5">:</span>
                                    <span className={winB ? 'text-[#D4FF2B]' : 'text-[#8E9AB2]'}>
                                      {m.scoreB}
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-semibold text-[#D4FF2B] whitespace-nowrap">
                                    记分
                                  </span>
                                )}
                              </div>

                              <div
                                className={`text-xs sm:text-sm truncate flex items-center justify-end gap-1 text-right ${
                                  winB ? 'font-bold text-white' : 'text-[#B8C4DA]'
                                }`}
                              >
                                {renderName(m.teamB[0])}
                                <span className="text-white/25">/</span>
                                {renderName(m.teamB[1])}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Desktop Right Sidebar (Live Top 4 + Fairness Engine Telemetry) */}
        <aside className="lg:col-span-4 space-y-4">
          <section className="bg-[#111620] rounded-3xl border border-white/[0.08] p-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.07]">
              <h2 className="text-sm font-bold text-[#F4F7FB]">实时积分前四</h2>
              <button
                type="button"
                onClick={onGoToStandings}
                className="text-xs font-semibold text-[#D4FF2B] hover:text-[#E1FF61] flex items-center gap-0.5 cursor-pointer"
              >
                <span>完整榜单</span>
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="divide-y divide-white/[0.06] mt-1">
              {standings.slice(0, 4).map((row) => (
                <button
                  key={row.player.id}
                  type="button"
                  onClick={() =>
                    setFocusedPlayerId(
                      focusedPlayerId === row.player.id ? null : row.player.id
                    )
                  }
                  className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-white/[0.03] -mx-2 px-2 rounded-xl transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`font-score italic text-xl font-extrabold w-6 text-center ${
                        row.rank === 1 ? 'text-[#D4FF2B]' : 'text-[#7A87A0]'
                      }`}
                    >
                      {String(row.rank).padStart(2, '0')}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#F4F7FB] truncate">
                        {row.player.name}
                      </p>
                      <p className="text-xs text-[#8E9AB2] font-mono tabular-nums">
                        {row.wins}胜{row.losses}负 · DUPR {row.player.rating.toFixed(1)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`font-score italic text-2xl font-extrabold leading-none ${
                        row.pointDiff > 0
                          ? 'text-[#22D38B]'
                          : row.pointDiff < 0
                          ? 'text-[#FF6448]'
                          : 'text-[#8E9AB2]'
                      }`}
                    >
                      {row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}
                    </div>
                    <div className="text-[10px] text-[#7A87A0] mt-0.5">净胜分</div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="bg-[#111620] rounded-3xl border border-white/[0.08] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#D4FF2B]" aria-hidden="true" />
                <h2 className="text-sm font-bold text-[#F4F7FB]">智能排阵评估</h2>
              </div>
              <span className="font-score italic text-2xl font-extrabold text-[#D4FF2B]">
                {fairness.compositeScore}分
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div className="bg-[#171E2B] rounded-2xl p-3 border border-white/[0.05]">
                <div className="text-[11px] text-[#8E9AB2]">搭档不重复率</div>
                <div className="font-score italic text-2xl font-extrabold text-[#F4F7FB] mt-0.5 leading-tight">
                  {fairness.partnerUniquenessPct}%
                </div>
              </div>
              <div className="bg-[#171E2B] rounded-2xl p-3 border border-white/[0.05]">
                <div className="text-[11px] text-[#8E9AB2]">平均对局分差</div>
                <div className="font-score italic text-2xl font-extrabold text-[#F4F7FB] mt-0.5 leading-tight">
                  {fairness.avgSkillGap.toFixed(2)}
                </div>
              </div>
              <div className="bg-[#171E2B] rounded-2xl p-3 border border-white/[0.05]">
                <div className="text-[11px] text-[#8E9AB2]">上场次数极差</div>
                <div className="font-score italic text-2xl font-extrabold text-[#F4F7FB] mt-0.5 leading-tight">
                  ≤ {fairness.playCountSpread} 场
                </div>
              </div>
              <div className="bg-[#171E2B] rounded-2xl p-3 border border-white/[0.05]">
                <div className="text-[11px] text-[#8E9AB2]">混双组合占比</div>
                <div className="font-score italic text-2xl font-extrabold text-[#F4F7FB] mt-0.5 leading-tight">
                  {fairness.mixedTeamPct}%
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
