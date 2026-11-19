import { useCallback, useEffect, useMemo, useState } from 'react';
import { AiMatchmakeSheet } from './components/AiMatchmakeSheet';
import { BottomNav } from './components/BottomNav';
import { CloudSyncSheet } from './components/CloudSyncSheet';
import { MatchPreviewSheet } from './components/MatchPreviewSheet';
import { PlayersView } from './components/PlayersView';
import { ProfileView } from './components/ProfileView';
import { ScheduleView } from './components/ScheduleView';
import { ScoreSheet } from './components/ScoreSheet';
import { SetupView } from './components/SetupView';
import { StandingsView } from './components/StandingsView';
import { ThemeSwitcherModal } from './components/ThemeSwitcherModal';
import { TopNav } from './components/TopNav';
import { WeChatReportModal } from './components/WeChatReportModal';
import type {
  AppTab,
  Gender,
  Match,
  ParsedPlayerInput,
  Player,
  Round,
  TournamentConfig,
  TournamentState,
  UserAccount,
} from './types/tournament';
import type { AiMatchmakeResult } from './utils/aiAnalysis';
import {
  authenticateUser,
  loadActiveUserId,
  loadUsers,
  registerNewAccount,
  saveActiveUserId,
  saveUsers,
  updateUserRoleByAdmin,
} from './utils/authStore';
import {
  loadCareerMemory,
  recordCompletedMatchesToMemory,
  saveCareerMemory,
  type CareerMemoryMap,
} from './utils/playerMemory';
import {
  isValidRoomCode,
  normalizeRoomCode,
  pullRoomState,
  validateTournamentStatePayload,
} from './utils/roomSync';
import {
  analyzeScheduleFairness,
  calculateStandings,
  generateNextMexicanoRound,
  generateSmartSchedule,
  getRecommendedRounds,
  rescheduleRemainingRounds,
  swapPlayersInRound,
} from './utils/scheduler';
import {
  createInitialCalendarSessions,
  createSessionForDate,
  loadCalendarSessions,
  saveCalendarSessions,
} from './utils/sessionArchive';
import {
  getThemeConfig,
  loadSavedTheme,
  saveTheme,
  type ScenicThemeId,
} from './utils/themes';

function findDefaultActiveRound(state: TournamentState): number {
  const firstPending = state.rounds.find((r) =>
    r.matches.some((m) => m.status !== 'completed')
  );
  return firstPending?.roundNumber ?? state.rounds[state.rounds.length - 1]?.roundNumber ?? 1;
}

export default function App() {
  // Multi-day calendar sessions store
  const [sessions, setSessions] = useState<TournamentState[]>(() => loadCalendarSessions());
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const initial = loadCalendarSessions();
    return initial[0]?.id ?? '';
  });

  // Active scenic background photography & tone theme
  const [activeTheme, setActiveTheme] = useState<ScenicThemeId>(() => loadSavedTheme());
  const [themeModalOpen, setThemeModalOpen] = useState(false);

  // Accounts & RBAC (Jack Super Admin + Admins + Isolated Members)
  const [users, setUsers] = useState<UserAccount[]>(() => loadUsers());
  const [activeUserId, setActiveUserId] = useState<string | null>(() => loadActiveUserId());

  const [activeTab, setActiveTab] = useState<AppTab>('schedule');
  const [activeRoundNumber, setActiveRoundNumber] = useState<number>(() => {
    const first = loadCalendarSessions()[0];
    return first ? findDefaultActiveRound(first) : 1;
  });

  const [scoringMatchId, setScoringMatchId] = useState<string | null>(null);
  const [previewMatchId, setPreviewMatchId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [cloudSyncOpen, setCloudSyncOpen] = useState(false);
  const [aiMatchmakeOpen, setAiMatchmakeOpen] = useState(false);
  const [careerMemory, setCareerMemory] = useState<CareerMemoryMap>(() => loadCareerMemory());
  const [roomCode, setRoomCode] = useState<string | null>(() => {
    try {
      const param = new URLSearchParams(window.location.search).get('room');
      const normalized = param ? normalizeRoomCode(param) : '';
      return isValidRoomCode(normalized) ? normalized : null;
    } catch {
      return null;
    }
  });
  const [toast, setToast] = useState<string | null>(null);

  const state: TournamentState = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? sessions[0],
    [sessions, activeSessionId]
  );

  const currentUser: UserAccount | null = useMemo(
    () => (activeUserId ? users.find((u) => u.id === activeUserId) ?? null : null),
    [users, activeUserId]
  );

  const themeCfg = getThemeConfig(activeTheme);

  const updateCurrentSession = useCallback(
    (updater: (prev: TournamentState) => TournamentState) => {
      setSessions((prevList) =>
        prevList.map((s) => (s.id === activeSessionId ? updater(s) : s))
      );
    },
    [activeSessionId]
  );

  // Persist sessions & sync career memory across ALL sessions
  useEffect(() => {
    saveCalendarSessions(sessions);
    setCareerMemory((prev) => {
      let next = prev;
      for (const s of sessions) {
        next = recordCompletedMatchesToMemory(next, s.id, s.players, s.rounds);
      }
      saveCareerMemory(next);
      return next;
    });
  }, [sessions]);

  // Persist users & active session user
  useEffect(() => {
    saveUsers(users);
  }, [users]);

  useEffect(() => {
    saveActiveUserId(activeUserId);
  }, [activeUserId]);

  // Persist scenic theme and apply data-theme attribute to documentElement
  useEffect(() => {
    saveTheme(activeTheme);
    document.documentElement.setAttribute('data-theme', activeTheme);
  }, [activeTheme]);

  const showToast = useCallback((message: string) => {
    setToast(message);
  }, []);

  // If opened with ?room=CODE, automatically pull the live cloud room snapshot
  useEffect(() => {
    if (!roomCode) return;
    let cancelled = false;
    pullRoomState(roomCode)
      .then((res) => {
        if (cancelled) return;
        if (res.ok && res.state) {
          const validated = validateTournamentStatePayload(res.state);
          if (validated) {
            setSessions((prev) => {
              const exists = prev.some((s) => s.id === validated.id);
              return exists
                ? prev.map((s) => (s.id === validated.id ? validated : s))
                : [validated, ...prev];
            });
            setActiveSessionId(validated.id);
            setActiveRoundNumber(findDefaultActiveRound(validated));
            showToast(`已同步云端房间 ${roomCode} 的最新赛况`);
          }
        }
      })
      .catch(() => {
        // Silent fallback to local sessions
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  const standings = useMemo(
    () => calculateStandings(state.players, state.rounds),
    [state.players, state.rounds]
  );

  const fairness = useMemo(
    () => analyzeScheduleFairness(state.players, state.rounds),
    [state.players, state.rounds]
  );

  const playerMap = useMemo(() => {
    const map = new Map<string, Player>();
    state.players.forEach((p) => map.set(p.id, p));
    return map;
  }, [state.players]);

  const playedCountByPlayer = useMemo(() => {
    const map = new Map<string, number>();
    standings.forEach((s) => map.set(s.player.id, s.played));
    return map;
  }, [standings]);

  const totalMatches = useMemo(
    () => state.rounds.reduce((sum, r) => sum + r.matches.length, 0),
    [state.rounds]
  );

  const completedMatches = useMemo(
    () =>
      state.rounds.reduce(
        (sum, r) => sum + r.matches.filter((m) => m.status === 'completed').length,
        0
      ),
    [state.rounds]
  );

  const scoringMatch: Match | null = useMemo(() => {
    if (!scoringMatchId) return null;
    for (const round of state.rounds) {
      const found = round.matches.find((m) => m.id === scoringMatchId);
      if (found) return found;
    }
    return null;
  }, [scoringMatchId, state.rounds]);

  const previewMatch: Match | null = useMemo(() => {
    if (!previewMatchId) return null;
    for (const round of state.rounds) {
      const found = round.matches.find((m) => m.id === previewMatchId);
      if (found) return found;
    }
    return null;
  }, [previewMatchId, state.rounds]);

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      const target = sessions.find((s) => s.id === sessionId);
      if (!target) return;
      setActiveSessionId(sessionId);
      setActiveRoundNumber(findDefaultActiveRound(target));
      showToast(`已切换至 ${target.sessionDate || ''} · ${target.config.title}`);
    },
    [sessions, showToast]
  );

  const handleCreateSession = useCallback(
    (params: {
      sessionDate: string;
      config: TournamentConfig;
      rosterMode: 'reuse' | 'fresh';
    }) => {
      const freshSession = createSessionForDate({
        sessionDate: params.sessionDate,
        config: params.config,
        players: params.rosterMode === 'reuse' ? state.players : [],
        publishedBy: currentUser?.displayName || '管理员',
      });
      if (params.rosterMode === 'fresh') {
        freshSession.players = [];
        freshSession.rounds = [];
      }
      setSessions((prev) => [freshSession, ...prev]);
      setActiveSessionId(freshSession.id);
      setActiveRoundNumber(1);
      if (params.rosterMode === 'fresh') {
        setActiveTab('players');
        showToast(`已发布 ${params.sessionDate} 新赛局，请粘贴今日接龙导入球友`);
      } else {
        setActiveTab('schedule');
        showToast(`已发布 ${params.sessionDate} 新赛局（历史记录完整保留）`);
      }
    },
    [state.players, currentUser, showToast]
  );

  const handleSaveScore = useCallback(
    (matchId: string, scoreA: number, scoreB: number) => {
      updateCurrentSession((prev) => ({
        ...prev,
        updatedAt: Date.now(),
        rounds: prev.rounds.map((round) => ({
          ...round,
          matches: round.matches.map((m) =>
            m.id === matchId
              ? {
                  ...m,
                  scoreA,
                  scoreB,
                  status: 'completed',
                  completedAt: Date.now(),
                }
              : m
          ),
        })),
      }));
      showToast(`比分已记录：${scoreA} : ${scoreB}`);
    },
    [updateCurrentSession, showToast]
  );

  const handleClearScore = useCallback(
    (matchId: string) => {
      updateCurrentSession((prev) => ({
        ...prev,
        updatedAt: Date.now(),
        rounds: prev.rounds.map((round) => ({
          ...round,
          matches: round.matches.map((m) =>
            m.id === matchId
              ? {
                  ...m,
                  scoreA: null,
                  scoreB: null,
                  status: 'pending',
                  completedAt: undefined,
                }
              : m
          ),
        })),
      }));
      showToast('已清除该场比分');
    },
    [updateCurrentSession, showToast]
  );

  const handleSwapPlayers = useCallback(
    (roundNumber: number, playerIdA: string, playerIdB: string) => {
      updateCurrentSession((prev) => ({
        ...prev,
        updatedAt: Date.now(),
        rounds: prev.rounds.map((round) =>
          round.roundNumber === roundNumber
            ? swapPlayersInRound(round, playerIdA, playerIdB)
            : round
        ),
      }));
      const nameA = playerMap.get(playerIdA)?.name ?? '';
      const nameB = playerMap.get(playerIdB)?.name ?? '';
      showToast(`已互换 ${nameA} 与 ${nameB} 的站位`);
    },
    [updateCurrentSession, playerMap, showToast]
  );

  const handleGenerateNextMexicano = useCallback(() => {
    updateCurrentSession((prev) => {
      const nextRound = generateNextMexicanoRound(
        prev.players,
        prev.rounds,
        prev.config,
        prev.seed
      );
      setActiveRoundNumber(nextRound.roundNumber);
      return {
        ...prev,
        updatedAt: Date.now(),
        rosterDirty: false,
        rounds: [...prev.rounds, nextRound],
      };
    });
    showToast('已按实时积分生成下一轮升场对阵');
  }, [updateCurrentSession, showToast]);

  const handleRescheduleRemaining = useCallback(() => {
    updateCurrentSession((prev) => {
      const next = rescheduleRemainingRounds(prev);
      setActiveRoundNumber(findDefaultActiveRound(next));
      return next;
    });
    showToast('已保留完赛记录并智能重排后续轮次');
  }, [updateCurrentSession, showToast]);

  const handleAddPlayer = useCallback(
    (input: ParsedPlayerInput) => {
      updateCurrentSession((prev) => {
        const nextRoundJoined =
          prev.rounds.filter((r) => r.matches.some((m) => m.status === 'completed')).length + 1;
        const newPlayer: Player = {
          id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: input.name,
          gender: input.gender,
          rating: input.rating,
          active: true,
          joinedRound: nextRoundJoined,
        };
        return {
          ...prev,
          updatedAt: Date.now(),
          players: [...prev.players, newPlayer],
          rosterDirty: true,
        };
      });
      showToast(`已加入球友「${input.name}」，可点击智能重排生效`);
    },
    [updateCurrentSession, showToast]
  );

  const handleImportPlayers = useCallback(
    (inputs: ParsedPlayerInput[], mode: 'append' | 'replace') => {
      if (inputs.length === 0) return;

      if (mode === 'replace') {
        const newPlayers: Player[] = inputs.map((item, idx) => ({
          id: `imp-${Date.now()}-${idx}`,
          name: item.name,
          gender: item.gender,
          rating: item.rating,
          active: true,
          joinedRound: 1,
        }));

        updateCurrentSession((prev) => {
          const maxCourts = Math.max(
            1,
            Math.min(prev.config.courtCount, Math.floor(newPlayers.length / 4) || 1)
          );
          const recommended = getRecommendedRounds(newPlayers.length, maxCourts);
          const nextConfig: TournamentConfig = {
            ...prev.config,
            courtCount: maxCourts,
            totalRounds: recommended,
          };
          const nextSeed = prev.seed + 13;
          const nextRounds = generateSmartSchedule(newPlayers, nextConfig, nextSeed);
          setActiveRoundNumber(1);
          return {
            ...prev,
            seed: nextSeed,
            updatedAt: Date.now(),
            config: nextConfig,
            players: newPlayers,
            rounds: nextRounds,
            rosterDirty: false,
          };
        });
        showToast(`已导入 ${inputs.length} 位球友并重新生成赛程`);
        return;
      }

      updateCurrentSession((prev) => {
        const existingNames = new Set(prev.players.map((p) => p.name.toLowerCase()));
        const nextRoundJoined =
          prev.rounds.filter((r) => r.matches.some((m) => m.status === 'completed')).length + 1;
        const additions: Player[] = inputs
          .filter((item) => !existingNames.has(item.name.toLowerCase()))
          .map((item, idx) => ({
            id: `imp-${Date.now()}-${idx}`,
            name: item.name,
            gender: item.gender,
            rating: item.rating,
            active: true,
            joinedRound: nextRoundJoined,
          }));

        if (additions.length === 0) {
          showToast('导入名单中的球友均已在当前名单中');
          return prev;
        }

        showToast(`已追加 ${additions.length} 位球友，可点击智能重排生效`);
        return {
          ...prev,
          updatedAt: Date.now(),
          players: [...prev.players, ...additions],
          rosterDirty: true,
        };
      });
    },
    [updateCurrentSession, showToast]
  );

  const handleToggleActive = useCallback(
    (playerId: string) => {
      updateCurrentSession((prev) => ({
        ...prev,
        updatedAt: Date.now(),
        rosterDirty: true,
        players: prev.players.map((p) =>
          p.id === playerId ? { ...p, active: !p.active } : p
        ),
      }));
    },
    [updateCurrentSession]
  );

  const handleUpdateRating = useCallback(
    (playerId: string, nextRating: number) => {
      updateCurrentSession((prev) => ({
        ...prev,
        updatedAt: Date.now(),
        players: prev.players.map((p) =>
          p.id === playerId ? { ...p, rating: nextRating } : p
        ),
      }));
    },
    [updateCurrentSession]
  );

  const handleUpdateGender = useCallback(
    (playerId: string, gender: Gender) => {
      updateCurrentSession((prev) => ({
        ...prev,
        updatedAt: Date.now(),
        players: prev.players.map((p) => (p.id === playerId ? { ...p, gender } : p)),
      }));
    },
    [updateCurrentSession]
  );

  const handleRemovePlayer = useCallback(
    (playerId: string) => {
      updateCurrentSession((prev) => ({
        ...prev,
        updatedAt: Date.now(),
        rosterDirty: true,
        players: prev.players.filter((p) => p.id !== playerId),
      }));
      showToast('已移除球友');
    },
    [updateCurrentSession, showToast]
  );

  const handleApplyConfigAndGenerate = useCallback(
    (nextConfig: TournamentConfig) => {
      updateCurrentSession((prev) => {
        const nextSeed = prev.seed + 29;
        const nextRounds = generateSmartSchedule(prev.players, nextConfig, nextSeed);
        return {
          ...prev,
          seed: nextSeed,
          publishedBy: currentUser?.displayName || prev.publishedBy,
          updatedAt: Date.now(),
          config: nextConfig,
          rounds: nextRounds,
          rosterDirty: false,
        };
      });
      setActiveRoundNumber(1);
      setActiveTab('schedule');
      showToast('已发布新赛制并生成智能赛程');
    },
    [updateCurrentSession, currentUser, showToast]
  );

  const handleShuffleSchedule = useCallback(() => {
    updateCurrentSession((prev) => rescheduleRemainingRounds(prev));
    setActiveTab('schedule');
    showToast('已为你换一套高公平度排阵方案');
  }, [updateCurrentSession, showToast]);

  const handleResetDemo = useCallback(() => {
    const freshList = createInitialCalendarSessions();
    setSessions(freshList);
    setActiveSessionId(freshList[0].id);
    setActiveRoundNumber(findDefaultActiveRound(freshList[0]));
    setActiveTab('schedule');
    showToast('已恢复今日与昨日默认示例赛事');
  }, [showToast]);

  const handleApplyImportedState = useCallback(
    (nextState: TournamentState, sourceLabel: string) => {
      setSessions((prev) => {
        const exists = prev.some((s) => s.id === nextState.id);
        return exists
          ? prev.map((s) => (s.id === nextState.id ? nextState : s))
          : [nextState, ...prev];
      });
      setActiveSessionId(nextState.id);
      setActiveRoundNumber(findDefaultActiveRound(nextState));
      showToast(sourceLabel);
    },
    [showToast]
  );

  const handleApplyAiPlan = useCallback(
    (targetRoundNumber: number, mode: 'replace' | 'append', plan: AiMatchmakeResult) => {
      const newRound: Round = {
        roundNumber: targetRoundNumber,
        restingPlayerIds: plan.restingIds,
        generatedMode: 'ai_smart',
        matches: plan.courts.map((c) => ({
          id: `r${targetRoundNumber}-c${c.courtNumber}-ai-${Date.now().toString(36)}`,
          roundNumber: targetRoundNumber,
          courtNumber: c.courtNumber,
          teamA: c.teamA,
          teamB: c.teamB,
          scoreA: null,
          scoreB: null,
          status: 'pending',
          aiReason: c.storyline,
        })),
      };

      updateCurrentSession((prev) => {
        if (mode === 'append') {
          return {
            ...prev,
            updatedAt: Date.now(),
            config: {
              ...prev.config,
              totalRounds: Math.max(prev.config.totalRounds, targetRoundNumber),
            },
            rounds: [...prev.rounds, newRound],
          };
        }

        const exists = prev.rounds.some((r) => r.roundNumber === targetRoundNumber);
        return {
          ...prev,
          updatedAt: Date.now(),
          rounds: exists
            ? prev.rounds.map((r) => (r.roundNumber === targetRoundNumber ? newRound : r))
            : [...prev.rounds, newRound],
        };
      });

      setActiveRoundNumber(targetRoundNumber);
      showToast(`已应用 DeepSeek 智排方案至第 ${targetRoundNumber} 轮`);
    },
    [updateCurrentSession, showToast]
  );

  const handleApplyCalibratedRatings = useCallback(
    (updates: Array<{ playerId: string; rating: number }>) => {
      const ratingMap = new Map(updates.map((u) => [u.playerId, u.rating]));
      updateCurrentSession((prev) => ({
        ...prev,
        updatedAt: Date.now(),
        rosterDirty: true,
        players: prev.players.map((p) =>
          ratingMap.has(p.id) ? { ...p, rating: ratingMap.get(p.id)! } : p
        ),
      }));
      showToast(`已更新 ${updates.length} 位球友的实打 DUPR 评分`);
    },
    [updateCurrentSession, showToast]
  );

  // Auth & RBAC handlers
  const handleLogin = useCallback(
    (username: string, password: string) => {
      const res = authenticateUser(users, username, password);
      if (!res.ok) return res;
      setActiveUserId(res.user.id);
      showToast(`欢迎回来，${res.user.displayName}`);
      return { ok: true };
    },
    [users, showToast]
  );

  const handleRegister = useCallback(
    (input: {
      username: string;
      password: string;
      displayName: string;
      gender: Gender;
      dupr: number;
    }) => {
      const res = registerNewAccount(users, input);
      if (!res.ok) return res;
      setUsers(res.nextUsers);
      setActiveUserId(res.user.id);
      showToast(`已创建球手档案：${res.user.displayName}`);
      return { ok: true };
    },
    [users, showToast]
  );

  const handleLogout = useCallback(() => {
    setActiveUserId(null);
    showToast('已退出登录');
  }, [showToast]);

  const handleUpdateProfile = useCallback(
    (patch: {
      displayName: string;
      gender: Gender;
      dupr: number;
      handedness: 'right' | 'left';
      playStyle: string;
      bio: string;
    }) => {
      if (!activeUserId) return;
      setUsers((prev) =>
        prev.map((u) => (u.id === activeUserId ? { ...u, ...patch } : u))
      );
      showToast('个人档案已更新');
    },
    [activeUserId, showToast]
  );

  const handleToggleUserAdmin = useCallback(
    (targetUserId: string, nextRole: 'admin' | 'member') => {
      const res = updateUserRoleByAdmin(users, currentUser, targetUserId, nextRole);
      if (!res.ok) {
        showToast(res.error);
        return;
      }
      setUsers(res.nextUsers);
      showToast(nextRole === 'admin' ? '已授权为赛事管理员' : '已取消管理员权限');
    },
    [users, currentUser, showToast]
  );

  return (
    <div data-theme={activeTheme} className="relative min-h-screen text-[#F8FAFC] flex flex-col">
      {/* Full-Bleed Scenic Court Photography Atmosphere Layer */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
        <img
          src={themeCfg.bgImage}
          alt=""
          className="w-full h-full object-cover object-center scale-105 transition-all duration-700"
        />
        <div
          className="absolute inset-0 transition-colors duration-500"
          style={{
            background:
              'linear-gradient(180deg, var(--theme-scrim-top) 0%, var(--theme-scrim-mid) 45%, var(--theme-scrim-bot) 100%)',
          }}
        />
      </div>

      <TopNav
        activeTab={activeTab}
        activeTheme={activeTheme}
        currentUser={currentUser}
        onSelectTab={setActiveTab}
        onOpenThemeSwitcher={() => setThemeModalOpen(true)}
        onOpenReport={() => setReportOpen(true)}
        rosterDirty={state.rosterDirty}
      />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 pt-4 pb-24 md:pb-12">
        {activeTab === 'schedule' && (
          <ScheduleView
            state={state}
            sessions={sessions}
            activeTheme={activeTheme}
            currentUser={currentUser}
            standings={standings}
            fairness={fairness}
            activeRoundNumber={activeRoundNumber}
            roomCode={roomCode}
            onSelectSession={handleSelectSession}
            onCreateSession={handleCreateSession}
            onPromptLogin={() => setActiveTab('profile')}
            onSelectRound={setActiveRoundNumber}
            onOpenScore={(match) => setScoringMatchId(match.id)}
            onOpenAiPreview={(match) => setPreviewMatchId(match.id)}
            onOpenAiMatchmake={() => setAiMatchmakeOpen(true)}
            onOpenCloudSync={() => setCloudSyncOpen(true)}
            onSwapPlayers={handleSwapPlayers}
            onGenerateNextMexicano={handleGenerateNextMexicano}
            onRescheduleRemaining={handleRescheduleRemaining}
            onGoToStandings={() => setActiveTab('standings')}
            onGoToPlayers={() => setActiveTab('players')}
          />
        )}

        {activeTab === 'standings' && (
          <StandingsView
            state={state}
            standings={standings}
            fairness={fairness}
            playerMap={playerMap}
            completedMatches={completedMatches}
            totalMatches={totalMatches}
            onOpenReport={() => setReportOpen(true)}
          />
        )}

        {activeTab === 'players' && (
          <PlayersView
            state={state}
            players={state.players}
            standings={standings}
            careerMemory={careerMemory}
            playedCountByPlayer={playedCountByPlayer}
            rosterDirty={state.rosterDirty}
            onAddPlayer={handleAddPlayer}
            onImportPlayers={handleImportPlayers}
            onToggleActive={handleToggleActive}
            onUpdateRating={handleUpdateRating}
            onApplyCalibratedRatings={handleApplyCalibratedRatings}
            onUpdateGender={handleUpdateGender}
            onRemovePlayer={handleRemovePlayer}
            onRescheduleRemaining={handleRescheduleRemaining}
          />
        )}

        {activeTab === 'setup' && (
          <SetupView
            state={state}
            activeTheme={activeTheme}
            currentUser={currentUser}
            fairness={fairness}
            roomCode={roomCode}
            onApplyConfigAndGenerate={handleApplyConfigAndGenerate}
            onShuffleSchedule={handleShuffleSchedule}
            onOpenCloudSync={() => setCloudSyncOpen(true)}
            onPromptLogin={() => setActiveTab('profile')}
            onResetDemo={handleResetDemo}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileView
            currentUser={currentUser}
            allUsers={users}
            sessions={sessions}
            activeTheme={activeTheme}
            onSelectTheme={(id) => {
              setActiveTheme(id);
              showToast(`已切换至「${getThemeConfig(id).name}」实景主题`);
            }}
            onLogin={handleLogin}
            onRegister={handleRegister}
            onLogout={handleLogout}
            onUpdateProfile={handleUpdateProfile}
            onToggleUserAdmin={handleToggleUserAdmin}
            onJumpToSession={(sid) => {
              handleSelectSession(sid);
              setActiveTab('schedule');
            }}
          />
        )}
      </main>

      <BottomNav
        activeTab={activeTab}
        currentUser={currentUser}
        onSelectTab={setActiveTab}
        rosterDirty={state.rosterDirty}
      />

      <ScoreSheet
        match={scoringMatch}
        playerMap={playerMap}
        targetScore={state.config.targetScore}
        winByTwo={state.config.winByTwo}
        onClose={() => setScoringMatchId(null)}
        onSaveScore={handleSaveScore}
        onClearScore={handleClearScore}
      />

      <MatchPreviewSheet
        match={previewMatch}
        playerMap={playerMap}
        standings={standings}
        targetScore={state.config.targetScore}
        onClose={() => setPreviewMatchId(null)}
      />

      <WeChatReportModal
        open={reportOpen}
        state={state}
        standings={standings}
        fairness={fairness}
        heroImageUrl={themeCfg.bgImage}
        onClose={() => setReportOpen(false)}
      />

      <CloudSyncSheet
        open={cloudSyncOpen}
        state={state}
        roomCode={roomCode}
        onClose={() => setCloudSyncOpen(false)}
        onRoomCodeChange={setRoomCode}
        onApplyImportedState={handleApplyImportedState}
      />

      <AiMatchmakeSheet
        open={aiMatchmakeOpen}
        state={state}
        standings={standings}
        careerMemory={careerMemory}
        targetRoundNumber={activeRoundNumber}
        onClose={() => setAiMatchmakeOpen(false)}
        onApplyPlan={handleApplyAiPlan}
      />

      <ThemeSwitcherModal
        open={themeModalOpen}
        activeTheme={activeTheme}
        onSelectTheme={(id) => {
          setActiveTheme(id);
          showToast(`已切换至「${getThemeConfig(id).name}」实景主题`);
        }}
        onClose={() => setThemeModalOpen(false)}
      />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl theme-accent-bg text-xs sm:text-sm font-bold shadow-xl whitespace-nowrap"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
