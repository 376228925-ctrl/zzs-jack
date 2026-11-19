import { useState } from 'react';
import {
  AlertCircle,
  Check,
  ClipboardPaste,
  History,
  Loader2,
  Minus,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  UserPlus,
} from 'lucide-react';
import type {
  Gender,
  ParsedPlayerInput,
  Player,
  PlayerStanding,
  TournamentState,
} from '../types/tournament';
import {
  buildCalibrationPayload,
  type AnalyzeApiResponse,
  type CalibrationResult,
} from '../utils/aiAnalysis';
import {
  computeDynamicDupr,
  normalizePlayerKey,
  type CareerMemoryMap,
} from '../utils/playerMemory';
import { WeChatImportSheet } from './WeChatImportSheet';

interface PlayersViewProps {
  state: TournamentState;
  players: Player[];
  standings: PlayerStanding[];
  careerMemory: CareerMemoryMap;
  playedCountByPlayer: Map<string, number>;
  rosterDirty: boolean;
  onAddPlayer: (input: ParsedPlayerInput) => void;
  onImportPlayers: (inputs: ParsedPlayerInput[], mode: 'append' | 'replace') => void;
  onToggleActive: (playerId: string) => void;
  onUpdateRating: (playerId: string, nextRating: number) => void;
  onApplyCalibratedRatings: (updates: Array<{ playerId: string; rating: number }>) => void;
  onUpdateGender: (playerId: string, gender: Gender) => void;
  onRemovePlayer: (playerId: string) => void;
  onRescheduleRemaining: () => void;
}

export function PlayersView({
  state,
  players,
  standings,
  careerMemory,
  playedCountByPlayer,
  rosterDirty,
  onAddPlayer,
  onImportPlayers,
  onToggleActive,
  onUpdateRating,
  onApplyCalibratedRatings,
  onUpdateGender,
  onRemovePlayer,
  onRescheduleRemaining,
}: PlayersViewProps) {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('M');
  const [rating, setRating] = useState<number>(3.5);
  const [formError, setFormError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // DeepSeek DUPR Calibration state
  const [calLoading, setCalLoading] = useState(false);
  const [calError, setCalError] = useState<string | null>(null);
  const [calResult, setCalResult] = useState<CalibrationResult | null>(null);
  const [calApplied, setCalApplied] = useState(false);

  const activeCount = players.filter((p) => p.active).length;
  const maleCount = players.filter((p) => p.active && p.gender === 'M').length;
  const femaleCount = players.filter((p) => p.active && p.gender === 'F').length;
  const standingMap = new Map(standings.map((s) => [s.player.id, s]));

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError('请输入球员姓名或昵称');
      return;
    }
    if (players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setFormError(`名单中已有「${trimmed}」，请换一个昵称区分`);
      return;
    }
    onAddPlayer({ name: trimmed, gender, rating });
    setName('');
    setFormError(null);
  };

  const handleRunCalibration = async () => {
    setCalLoading(true);
    setCalError(null);
    setCalApplied(false);
    try {
      const payload = buildCalibrationPayload(state, standings, careerMemory);
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'calibrate',
          context: payload,
        }),
      });
      const json = (await res.json()) as AnalyzeApiResponse<CalibrationResult>;
      if (!res.ok || !json.ok || !json.data) {
        setCalError(json.error || 'AI 实力校准暂时不可用');
        return;
      }
      setCalResult(json.data);
    } catch {
      setCalError('网络异常，无法连接 DeepSeek 服务');
    } finally {
      setCalLoading(false);
    }
  };

  const handleApplyAllCalibration = () => {
    if (!calResult) return;
    const validIds = new Set(players.map((p) => p.id));
    const updates = calResult.adjustments
      .filter((item) => validIds.has(item.playerId) && typeof item.suggestedDupr === 'number')
      .map((item) => ({
        playerId: item.playerId,
        rating: Math.max(2.0, Math.min(6.0, Number(item.suggestedDupr.toFixed(1)))),
      }));
    if (updates.length > 0) {
      onApplyCalibratedRatings(updates);
      setCalApplied(true);
    }
  };

  const nextGenderCycle = (g: Gender): Gender => {
    if (g === 'M') return 'F';
    if (g === 'F') return 'U';
    return 'M';
  };

  const genderText = (g: Gender) => (g === 'M' ? '男' : g === 'F' ? '女' : '未标');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#F4F7FB]">球员与战绩档案</h1>
          <p className="text-xs sm:text-sm text-[#8E9AB2] mt-1 font-mono tabular-nums">
            活跃 {activeCount} 人 · 共 {players.length} 人 · 男 {maleCount} / 女 {femaleCount}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRunCalibration}
            disabled={calLoading}
            className="min-h-[44px] px-3.5 rounded-xl bg-[#162238] border border-[#D4FF2B]/45 text-[#D4FF2B] text-xs sm:text-sm font-bold hover:bg-[#1D2D4A] transition-all inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            {calLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="w-4 h-4" aria-hidden="true" />
            )}
            <span>{calLoading ? '校准中…' : 'AI 实打校准'}</span>
          </button>

          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="min-h-[44px] px-4 rounded-xl bg-[#D4FF2B] text-[#080B10] text-xs sm:text-sm font-bold hover:bg-[#E1FF61] active:scale-[0.98] transition-all inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ClipboardPaste className="w-4 h-4" aria-hidden="true" />
            <span>微信接龙导入</span>
          </button>
        </div>
      </div>

      {/* DeepSeek Calibration Result Drawer Card */}
      {calError && (
        <div
          role="alert"
          className="rounded-2xl bg-[#2A1414] border border-[#FF6448]/40 p-4 flex items-center gap-2.5 text-xs text-[#FF9B87]"
        >
          <AlertCircle className="w-4 h-4 text-[#FF6448] shrink-0" aria-hidden="true" />
          <span>{calError}</span>
        </div>
      )}

      {calResult && (
        <section className="rounded-3xl bg-[#111620] border border-[#D4FF2B]/40 p-4 sm:p-5 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#D4FF2B]">
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                <span>DeepSeek 实打 DUPR 校准建议</span>
              </div>
              <p className="text-xs sm:text-sm text-[#D8E1F0] mt-1">{calResult.summary}</p>
            </div>
            <button
              type="button"
              onClick={handleApplyAllCalibration}
              disabled={calApplied}
              className="min-h-[42px] px-4 rounded-xl bg-[#D4FF2B] text-[#080B10] text-xs font-bold hover:bg-[#E1FF61] disabled:opacity-60 inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Check className="w-4 h-4" aria-hidden="true" />
              <span>{calApplied ? '已应用至名单' : '一键采纳全部校准'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {calResult.adjustments.map((adj) => {
              const delta = Number((adj.suggestedDupr - adj.currentDupr).toFixed(1));
              return (
                <div
                  key={adj.playerId}
                  className="p-3 rounded-2xl bg-[#0A0E16] border border-white/[0.08] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-white truncate">{adj.name}</span>
                      <span className="font-mono tabular-nums text-[#8E9AB2]">
                        {adj.currentDupr.toFixed(1)} →
                      </span>
                      <span className="font-mono tabular-nums font-bold text-[#D4FF2B]">
                        {adj.suggestedDupr.toFixed(1)}
                      </span>
                      {delta !== 0 && (
                        <span
                          className={`font-mono text-[11px] font-bold ${
                            delta > 0 ? 'text-[#22D38B]' : 'text-[#FF6448]'
                          }`}
                        >
                          {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#8E9AB2] mt-1 leading-snug">{adj.reason}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Dirty Roster Banner */}
      {rosterDirty && (
        <div className="rounded-2xl bg-[#151D2B] border border-[#D4FF2B]/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-[#F4F7FB]">
              名单或实力分已更新，尚未同步到后续赛程
            </p>
            <p className="text-xs text-[#9AA5BC]">
              点击重排后，已完成轮次不受影响，新阵容与新 DUPR 评分将立即生效。
            </p>
          </div>
          <button
            type="button"
            onClick={onRescheduleRemaining}
            className="min-h-[44px] px-4 rounded-xl bg-[#D4FF2B] text-[#080B10] text-sm font-bold hover:bg-[#E1FF61] transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            <span>智能重排未赛轮次</span>
          </button>
        </div>
      )}

      {/* Main Split: Left Roster List + Right Quick Add Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Quick Add Player Form */}
        <section className="lg:col-span-4 lg:order-2 bg-[#111620] rounded-3xl border border-white/[0.08] p-5 space-y-4">
          <div>
            <h2 className="text-base font-bold text-[#F4F7FB]">临时加人</h2>
            <p className="text-xs text-[#8E9AB2] mt-0.5">支持赛前报名或中途迟到补录</p>
          </div>

          <form onSubmit={handleAddSubmit} className="space-y-3.5" noValidate>
            <div>
              <label
                htmlFor="new-player-name"
                className="block text-xs font-semibold text-[#8E9AB2] mb-1.5"
              >
                球友昵称
              </label>
              <input
                id="new-player-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (formError) setFormError(null);
                }}
                placeholder="输入姓名或微信昵称"
                maxLength={18}
                className="w-full min-h-[44px] rounded-xl border border-white/[0.1] bg-[#0A0E16] px-3.5 text-sm text-[#F4F7FB] placeholder:text-[#5B677E] focus:outline-none focus:border-[#D4FF2B] transition-colors"
              />
              {formError && (
                <p role="alert" className="text-xs text-[#FF8B73] mt-1.5">
                  {formError}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="block text-xs font-semibold text-[#8E9AB2] mb-1.5">性别</span>
                <div className="grid grid-cols-3 gap-1 p-1 bg-[#0A0E16] border border-white/[0.08] rounded-xl">
                  {(['M', 'F', 'U'] as Gender[]).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`min-h-[36px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        gender === g
                          ? 'bg-[#D4FF2B] text-[#080B10]'
                          : 'text-[#8E9AB2] hover:text-white'
                      }`}
                    >
                      {genderText(g)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="new-player-rating"
                  className="block text-xs font-semibold text-[#8E9AB2] mb-1.5"
                >
                  DUPR 水平
                </label>
                <select
                  id="new-player-rating"
                  value={rating.toFixed(1)}
                  onChange={(e) => setRating(Number(e.target.value))}
                  className="w-full min-h-[44px] rounded-xl border border-white/[0.1] bg-[#0A0E16] px-3 text-sm font-mono tabular-nums text-[#F4F7FB] focus:outline-none focus:border-[#D4FF2B]"
                >
                  {[2.5, 2.8, 3.0, 3.2, 3.5, 3.8, 4.0, 4.2, 4.5, 4.8, 5.0].map((r) => (
                    <option key={r} value={r.toFixed(1)} className="bg-[#111620]">
                      {r.toFixed(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full min-h-[46px] rounded-xl bg-[#D4FF2B] text-[#080B10] text-sm font-bold hover:bg-[#E1FF61] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" aria-hidden="true" />
              <span>加入名单</span>
            </button>
          </form>
        </section>

        {/* Roster List */}
        <section className="lg:col-span-8 lg:order-1 bg-[#111620] rounded-3xl border border-white/[0.08] overflow-hidden">
          <div className="px-5 py-3.5 bg-[#161D2A] border-b border-white/[0.06] flex items-center justify-between text-xs text-[#8E9AB2]">
            <span className="font-bold text-[#F4F7FB]">参赛名单（自动记忆历次实打战绩）</span>
            <span className="hidden sm:inline">已完赛记录自动保留</span>
          </div>

          <div className="divide-y divide-white/[0.06]">
            {players.map((player) => {
              const played = playedCountByPlayer.get(player.id) ?? 0;
              const career = careerMemory[normalizePlayerKey(player.name)];
              const dyn = computeDynamicDupr(player.rating, career, standingMap.get(player.id));
              return (
                <div
                  key={player.id}
                  className={`px-4 sm:px-5 py-3.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 transition-colors ${
                    player.active ? 'bg-[#111620]' : 'bg-[#0C1018]/80 opacity-65'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-[140px] flex-1">
                    <div
                      aria-hidden="true"
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 ${
                        !player.active
                          ? 'bg-white/[0.08] text-[#66738D]'
                          : player.gender === 'F'
                          ? 'bg-[#3A1E1B] text-[#FF907A] border border-[#FF6448]/30'
                          : 'bg-[#173068] text-[#9AC0FF] border border-[#5C93FF]/30'
                      }`}
                    >
                      {player.name.slice(0, 1)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-semibold text-sm truncate ${
                            player.active ? 'text-[#F4F7FB]' : 'text-[#8E9AB2] line-through'
                          }`}
                        >
                          {player.name}
                        </span>
                        {!player.active && (
                          <span className="text-xs text-[#FF6448] font-semibold">已暂离</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#8E9AB2] font-mono tabular-nums mt-0.5">
                        <span>今日 {played} 场</span>
                        {career && career.games > 0 && (
                          <span className="inline-flex items-center gap-1 text-[#7BB1FF]">
                            <History className="w-3 h-3" aria-hidden="true" />
                            <span>
                              记忆 {career.wins}胜{career.losses}负 · 等效 {dyn.toFixed(1)}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onUpdateGender(player.id, nextGenderCycle(player.gender))}
                      aria-label={`切换 ${player.name} 性别，当前 ${genderText(player.gender)}`}
                      className="min-h-[40px] min-w-[44px] px-2.5 rounded-xl bg-[#171E2B] border border-white/[0.08] text-xs font-semibold text-[#F4F7FB] hover:border-[#D4FF2B]/50 cursor-pointer"
                    >
                      {genderText(player.gender)}
                    </button>

                    <div className="flex items-center rounded-xl border border-white/[0.08] bg-[#171E2B] overflow-hidden">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateRating(
                            player.id,
                            Math.max(2.0, Number((player.rating - 0.1).toFixed(1)))
                          )
                        }
                        aria-label={`降低 ${player.name} DUPR 评分`}
                        className="min-h-[40px] min-w-[34px] flex items-center justify-center text-[#9AA5BC] hover:bg-white/[0.08] hover:text-white cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-2 font-mono tabular-nums text-xs font-bold text-[#D4FF2B]">
                        {player.rating.toFixed(1)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateRating(
                            player.id,
                            Math.min(6.0, Number((player.rating + 0.1).toFixed(1)))
                          )
                        }
                        aria-label={`提高 ${player.name} DUPR 评分`}
                        className="min-h-[40px] min-w-[34px] flex items-center justify-center text-[#9AA5BC] hover:bg-white/[0.08] hover:text-white cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onToggleActive(player.id)}
                      aria-label={
                        player.active ? `暂停 ${player.name} 后续参赛` : `恢复 ${player.name} 参赛`
                      }
                      className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors ${
                        player.active
                          ? 'bg-white/[0.07] text-[#D8E1F0] hover:bg-white/[0.14]'
                          : 'bg-[#D4FF2B] text-[#080B10] font-bold hover:bg-[#E1FF61]'
                      }`}
                    >
                      {player.active ? (
                        <>
                          <PauseCircle className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>暂离</span>
                        </>
                      ) : (
                        <>
                          <PlayCircle className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>回归</span>
                        </>
                      )}
                    </button>

                    {played === 0 && (
                      <button
                        type="button"
                        onClick={() => onRemovePlayer(player.id)}
                        aria-label={`移除 ${player.name}`}
                        className="min-h-[40px] min-w-[40px] rounded-xl text-[#8E9AB2] hover:text-[#FF6448] hover:bg-[#2C1414] flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <WeChatImportSheet
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={onImportPlayers}
      />
    </div>
  );
}
