export type Gender = 'M' | 'F' | 'U';

export type TournamentFormat = 'classic' | 'balanced' | 'mixed' | 'mexicano' | 'ai_smart';

export type AiMatchmakeGoal =
  | 'balanced_clash'
  | 'carry_mix'
  | 'rematch_rivalry'
  | 'mixed_priority';

export type ScoringTarget = 11 | 15 | 21;

export type AppTab = 'schedule' | 'standings' | 'players' | 'setup' | 'profile';

export type UserRole = 'super_admin' | 'admin' | 'member';

export interface UserAccount {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  displayName: string;
  gender: Gender;
  dupr: number;
  handedness: 'right' | 'left';
  playStyle: string;
  bio: string;
  createdAt: number;
}

export interface Player {
  id: string;
  name: string;
  gender: Gender;
  rating: number; // DUPR-style 2.0 - 5.5
  active: boolean; // false = paused / left mid-tournament
  joinedRound: number;
}

export interface PlayerCareerRecord {
  name: string;
  games: number;
  wins: number;
  losses: number;
  pointDiff: number;
  estimatedDupr: number;
  recentForm: Array<'W' | 'L'>;
  recordedMatchIds: string[];
  lastPlayedAt: number;
}

export interface Match {
  id: string;
  roundNumber: number;
  courtNumber: number;
  teamA: [string, string];
  teamB: [string, string];
  scoreA: number | null;
  scoreB: number | null;
  status: 'pending' | 'completed';
  completedAt?: number;
  aiReason?: string;
}

export interface Round {
  roundNumber: number;
  matches: Match[];
  restingPlayerIds: string[];
  generatedMode: TournamentFormat;
}

export interface TournamentConfig {
  title: string;
  venue: string;
  format: TournamentFormat;
  courtCount: number;
  totalRounds: number;
  targetScore: ScoringTarget;
  winByTwo: boolean;
  roundMinutes: number;
}

export interface TournamentState {
  id: string;
  sessionDate?: string; // YYYY-MM-DD calendar date
  publishedBy?: string; // Organizer display name
  createdAt: number;
  updatedAt: number;
  seed: number;
  config: TournamentConfig;
  players: Player[];
  rounds: Round[];
  rosterDirty: boolean; // true when players changed after schedule generation
}

export interface PersonalMatchRecord {
  sessionId: string;
  sessionDate: string;
  sessionTitle: string;
  venue: string;
  roundNumber: number;
  courtNumber: number;
  partnerName: string;
  opponentNames: [string, string];
  myScore: number;
  oppScore: number;
  won: boolean;
  pointDiff: number;
  completedAt: number;
}

export interface PartnerRecord {
  partnerId: string;
  partnerName: string;
  games: number;
  wins: number;
  pointDiff: number;
}

export interface PlayerStanding {
  rank: number;
  player: Player;
  played: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  winRate: number;
  avgPointsFor: number;
  form: Array<'W' | 'L' | 'T'>;
  partnerRecords: PartnerRecord[];
  bestPartner: PartnerRecord | null;
}

export interface ScheduleFairnessReport {
  totalMatches: number;
  partnerUniquenessPct: number;
  repeatPartnerCount: number;
  repeatOpponentCount: number;
  playCountMin: number;
  playCountMax: number;
  playCountSpread: number;
  avgSkillGap: number;
  mixedTeamPct: number;
  compositeScore: number;
}

export interface ScoreValidationResult {
  valid: boolean;
  warning: string | null;
  error: string | null;
  winner: 'A' | 'B' | null;
}

export interface ParsedPlayerInput {
  name: string;
  gender: Gender;
  rating: number;
}
