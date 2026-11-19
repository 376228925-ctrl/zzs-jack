import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Flame,
  HeartHandshake,
  Loader2,
  RefreshCw,
  Scale,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import type {
  AiMatchmakeGoal,
  Player,
  PlayerStanding,
  TournamentState,
} from '../types/tournament';
import {
  buildAiMatchmakePayload,
  validateAiMatchmakeResult,
  type AiMatchmakeResult,
  type AnalyzeApiResponse,
} from '../utils/aiAnalysis';
import {
  computeDynamicDupr,
  normalizePlayerKey,
  type CareerMemoryMap,
} from '../utils/playerMemory';

interface AiMatchmakeSheetProps {
  open: boolean;
  state: TournamentState;
  standings: PlayerStanding[];
  careerMemory: CareerMemoryMap;
  targetRoundNumber: number;
  onClose: () => void;
  onApplyPlan: (
    targetRoundNumber: number,
    mode: 'replace' | 'append',
    plan: AiMatchmakeResult
  ) => void;
}

const GOAL_OPTIONS: Array<{
  id: AiMatchmakeGoal;
  title: string;
  desc: string;
  icon: typeof Scale;
}> = [
  {
    id: 'balanced_clash',
    title: '旗鼓相当巅峰对决',
    desc: '按动态战力拉齐每场胜率，杜绝一边倒',
    icon: Scale,
  },
  {
    id: 'carry_mix',
    title: '强弱带飞社交局',
    desc: '高分球手带进阶球友，体验与公平兼得',
    icon: HeartHandshake,
  },
  {
    id: 'rematch_rivalry',
    title: '强强对话复仇局',
    desc: '连胜高手拆队正面对决，制造王座焦点战',
    icon: Flame,
  },
  {
    id: 'mixed_priority',
    title: '混双社交优选',
    desc: '优先撮合男女混双搭档并均衡实力差',
    icon: Users,
  },
];

export function AiMatchmakeSheet({
  open,
  state,
  standings,
  careerMemory,
  targetRoundNumber,
  onClose,
  onApplyPlan,
}: AiMatchmakeSheetProps) {
  const [goal, setGoal] = useState<AiMatchmakeGoal>('balanced_clash');
  const [applyMode, setApplyMode] = useState<'replace' | 'append'>('replace');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<AiMatchmakeResult | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);

  const activePlayers = useMemo(
    () => state.players.filter((p) => p.active),
    [state.players]
  );

  const playerMap = useMemo(() => {
    const map = new Map<string, Player>();
    state.players.forEach((p) => map.set(p.id, p));
    return map;
  }, [state.players]);

  const standingMap = useMemo(
    () => new Map(standings.map((s) => [s.player.id, s])),
    [standings]
  );

  if (!open) return null;

  const targetRoundObj = state.rounds.find((r) => r.roundNumber === targetRoundNumber);
  const currentRoundHasCompleted = Boolean(
    targetRoundObj?.matches.some((m) => m.status === 'completed')
  );
  const effectiveMode: 'replace' | 'append' = currentRoundHasCompleted ? 'append' : applyMode;
  const effectiveRoundNumber =
    effectiveMode === 'append' ? state.rounds.length + 1 : targetRoundNumber;

  const effectiveCourts = Math.min(
    state.config.courtCount,
    Math.floor(activePlayers.length / 4)
  );

  const rememberedCount = activePlayers.filter((p) => {
    const c = careerMemory[normalizePlayerKey(p.name)];
    return Boolean(c && c.games > 0);
  }).length;

  const handleGenerate = async () => {
    if (effectiveCourts <= 0) {
      setError('当前活跃球员不足 4 人，无法排阵');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const payload = buildAiMatchmakePayload(
        state,
        standings,
        careerMemory,
        effectiveRoundNumber,
        goal
      );

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'matchmake',
          context: payload,
        }),
      });

      const json = (await res.json()) as AnalyzeApiResponse<AiMatchmakeResult>;
      if (!res.ok || !json.ok || !json.data) {
        setError(json.error || 'DeepSeek 排阵服务暂时不可用，请稍后重试');
        return;
      }

      const validated = validateAiMatchmakeResult(
        json.data,
        activePlayers.map((p) => p.id),
        effectiveCourts
      );

      if (!validated) {
        setError('模型返回的球员站位存在冲突，已自动拦截，请点击重试重新生成。');
        return;
      }

      setPlan(validated);
      setModelUsed(json.model ?? null);
    } catch {
      setError('网络请求失败，请检查服务连接后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmApply = () => {
    if (!plan) return;
    onApplyPlan(effectiveRoundNumber, effectiveMode, plan);
    setPlan(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-matchmake-title"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-xl bg-[#111620] text-[#F4F7FB] rounded-t-3xl md:rounded-3xl p-5 sm:p-6 pb-safe shadow-2xl border border-white/[0.1] max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="md:hidden w-10 h-1.5 bg-white/20 rounded-full mx-auto mb-3"
          aria-hidden="true"
        />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-white/[0.08]">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#D4FF2B]">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>DeepSeek 赛事总监 · 动态记忆排阵</span>
            </div>
            <h2
              id="ai-matchmake-title"
              className="text-lg font-extrabold text-white mt-0.5"
            >
              AI 智排第 {effectiveRoundNumber} 轮对阵
            </h2>
            <p className="text-xs text-[#8E9AB2] mt-0.5">
              已结合 {rememberedCount}/{activePlayers.length} 位球友的历史战绩、动态等效 DUPR 与当日手感
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭 AI 排阵弹窗"
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-[#8E9AB2] hover:bg-white/[0.08] hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 py-4 space-y-4 pr-0.5">
          {/* Target Round Mode Switch (if current round is still unplayed) */}
          {!currentRoundHasCompleted && (
            <div className="grid grid-cols-2 gap-1 p-1 bg-[#0A0E16] border border-white/[0.08] rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setApplyMode('replace');
                  setPlan(null);
                }}
                className={`min-h-[38px] rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  applyMode === 'replace'
                    ? 'bg-[#D4FF2B] text-[#080B10] font-bold'
                    : 'text-[#8E9AB2] hover:text-white'
                }`}
              >
                重排当前第 {targetRoundNumber} 轮
              </button>
              <button
                type="button"
                onClick={() => {
                  setApplyMode('append');
                  setPlan(null);
                }}
                className={`min-h-[38px] rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  applyMode === 'append'
                    ? 'bg-[#D4FF2B] text-[#080B10] font-bold'
                    : 'text-[#8E9AB2] hover:text-white'
                }`}
              >
                新增第 {state.rounds.length + 1} 轮加赛
              </button>
            </div>
          )}

          {/* Goal Picker */}
          <div className="space-y-2">
            <span className="block text-xs font-bold text-[#8E9AB2]">选择本轮排阵偏好</span>
            <div className="grid grid-cols-2 gap-2">
              {GOAL_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const selected = goal === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setGoal(opt.id);
                      setPlan(null);
                    }}
                    aria-pressed={selected}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      selected
                        ? 'bg-[#172238] border-[#D4FF2B] text-white'
                        : 'bg-[#171E2B] border-white/[0.06] text-[#D8E1F0] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon
                        className={`w-3.5 h-3.5 shrink-0 ${
                          selected ? 'text-[#D4FF2B]' : 'text-[#8E9AB2]'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="text-xs font-bold truncate">{opt.title}</span>
                    </div>
                    <p className="text-[11px] text-[#8E9AB2] mt-1 leading-snug">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic Skill Memory Strip */}
          <div className="rounded-2xl bg-[#0A0E16] border border-white/[0.08] p-3.5 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-[#B8C4DA]">实时纳入计算的动态战力</span>
              <span className="font-mono tabular-nums text-[#8E9AB2]">
                {activePlayers.length}人 · {effectiveCourts}片场
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activePlayers.map((p) => {
                const career = careerMemory[normalizePlayerKey(p.name)];
                const standing = standingMap.get(p.id);
                const dyn = computeDynamicDupr(p.rating, career, standing);
                const diff = Number((dyn - p.rating).toFixed(2));
                return (
                  <div
                    key={p.id}
                    className="px-2.5 py-1.5 rounded-xl bg-[#111620] border border-white/[0.07] text-[11px] flex items-center gap-1.5"
                  >
                    <span className="font-semibold text-[#F4F7FB]">{p.name}</span>
                    <span className="font-mono tabular-nums text-[#D4FF2B] font-bold">
                      {dyn.toFixed(1)}
                    </span>
                    {Math.abs(diff) >= 0.05 && (
                      <span
                        className={`font-mono tabular-nums text-[10px] ${
                          diff > 0 ? 'text-[#22D38B]' : 'text-[#FF6448]'
                        }`}
                      >
                        {diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Error Notice */}
          {error && (
            <div
              role="alert"
              className="rounded-2xl bg-[#2A1414] border border-[#FF6448]/40 p-3.5 flex items-start gap-2.5 text-xs text-[#FF9B87]"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#FF6448]" aria-hidden="true" />
              <p className="leading-relaxed">{error}</p>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="rounded-2xl bg-[#0A0E16] border border-white/[0.08] p-6 text-center space-y-2.5">
              <Loader2 className="w-6 h-6 text-[#D4FF2B] animate-spin mx-auto" />
              <p className="text-sm font-semibold text-[#F4F7FB]">
                DeepSeek 正在综合历史胜率、动态分与搭档记录排兵布阵…
              </p>
              <p className="text-xs text-[#8E9AB2]">
                系统将自动校验站位唯一性，确保零冲突、零漏人
              </p>
            </div>
          )}

          {/* Proposed AI Courts Preview */}
          {plan && !loading && (
            <div className="space-y-3">
              <div className="rounded-2xl bg-[#16223A] border border-[#D4FF2B]/40 p-3.5 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-[#D4FF2B]">AI 本轮排阵策略</span>
                  {modelUsed && (
                    <span className="font-mono text-[#8E9AB2]">{modelUsed}</span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-[#F4F7FB] leading-relaxed">
                  {plan.strategySummary}
                </p>
              </div>

              <div className="space-y-2.5">
                {plan.courts.map((c) => {
                  const nameOf = (id: string) => playerMap.get(id)?.name ?? id;
                  return (
                    <div
                      key={c.courtNumber}
                      className="rounded-2xl bg-[#0A0E16] border border-white/[0.1] p-3.5 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-score italic text-base font-extrabold text-[#D4FF2B]">
                          {String(c.courtNumber).padStart(2, '0')}号场
                        </span>
                        <span className="text-[11px] text-[#8E9AB2]">已通过无冲突校验</span>
                      </div>

                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm font-bold text-white">
                        <div className="px-2.5 py-2 rounded-xl bg-[#111620] border border-white/[0.06] text-center truncate">
                          {nameOf(c.teamA[0])} / {nameOf(c.teamA[1])}
                        </div>
                        <span className="font-score italic text-sm font-extrabold text-[#D4FF2B]">
                          VS
                        </span>
                        <div className="px-2.5 py-2 rounded-xl bg-[#111620] border border-white/[0.06] text-center truncate">
                          {nameOf(c.teamB[0])} / {nameOf(c.teamB[1])}
                        </div>
                      </div>

                      <p className="text-xs text-[#B8C4DA] leading-relaxed">
                        看点：{c.storyline}
                      </p>
                    </div>
                  );
                })}
              </div>

              {plan.restingIds.length > 0 && (
                <p className="text-xs text-[#8E9AB2] px-1">
                  本轮轮空：
                  {plan.restingIds.map((id) => playerMap.get(id)?.name ?? id).join('、')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer CTAs */}
        <div className="pt-3.5 border-t border-white/[0.08] flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || effectiveCourts <= 0}
            className={`min-h-[46px] px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
              plan
                ? 'bg-white/[0.08] border border-white/[0.1] text-[#F4F7FB] hover:bg-white/[0.14]'
                : 'flex-1 bg-[#D4FF2B] text-[#080B10] hover:bg-[#E1FF61]'
            }`}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : plan ? (
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Sparkles className="w-4 h-4" aria-hidden="true" />
            )}
            <span>{loading ? '排阵计算中…' : plan ? '重算一版' : '生成 AI 智适应排阵'}</span>
          </button>

          {plan && (
            <button
              type="button"
              onClick={handleConfirmApply}
              className="flex-1 min-h-[46px] px-4 rounded-xl bg-[#D4FF2B] text-[#080B10] text-sm font-bold hover:bg-[#E1FF61] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" aria-hidden="true" />
              <span>应用至第 {effectiveRoundNumber} 轮</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
