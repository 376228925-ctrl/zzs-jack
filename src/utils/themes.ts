import type { PosterTheme } from './posterCanvas';

export type ScenicThemeId = 'sunset' | 'botanical' | 'terracotta' | 'midnight';

export interface ScenicThemeConfig {
  id: ScenicThemeId;
  name: string;
  shortName: string;
  tagline: string;
  bgImage: string;
  swatchBg: string;
  swatchAccent: string;
  accentHex: string;
  accentFgHex: string;
  courtOuterHex: string;
  courtInnerHex: string;
  courtKitchenHex: string;
  defaultPosterTheme: PosterTheme;
}

export const SCENIC_THEMES: ScenicThemeConfig[] = [
  {
    id: 'sunset',
    name: '海岸日落',
    shortName: '海岸',
    tagline: '海风落日 · 珊瑚蓝硬地',
    bgImage: '/src/assets/images/sunset_coastal_court_1795082351552.jpg',
    swatchBg: '#D96B59',
    swatchAccent: '#FF8E62',
    accentHex: '#FF8E62',
    accentFgHex: '#121218',
    courtOuterHex: '#2A6F97',
    courtInnerHex: '#D96B59',
    courtKitchenHex: '#B85244',
    defaultPosterTheme: 'night_slam',
  },
  {
    id: 'botanical',
    name: '庄园绿茵',
    shortName: '绿茵',
    tagline: '托斯卡纳柏树 · 晨光绿场',
    bgImage: '/src/assets/images/botanical_club_court_1795082342191.jpg',
    swatchBg: '#236B4B',
    swatchAccent: '#9EF0B8',
    accentHex: '#9EF0B8',
    accentFgHex: '#0A1912',
    courtOuterHex: '#173F2E',
    courtInnerHex: '#236B4B',
    courtKitchenHex: '#1A5239',
    defaultPosterTheme: 'swiss_ticket',
  },
  {
    id: 'terracotta',
    name: '法网陶土',
    shortName: '红土',
    tagline: '暖阳橄榄影 · 红土画报',
    bgImage: '/src/assets/images/terracotta_clay_court_1795082341471.jpg',
    swatchBg: '#BC4E2A',
    swatchAccent: '#F4B36C',
    accentHex: '#F4B36C',
    accentFgHex: '#1C110B',
    courtOuterHex: '#7C341E',
    courtInnerHex: '#BC4E2A',
    courtKitchenHex: '#9A3B1D',
    defaultPosterTheme: 'roland_clay',
  },
  {
    id: 'midnight',
    name: '夜场蓝光',
    shortName: '夜场',
    tagline: '大满贯聚光灯 · 暗夜荧光',
    bgImage: '/src/assets/images/night_court_hero_1795079945626.jpg',
    swatchBg: '#1441A2',
    swatchAccent: '#D4FF2B',
    accentHex: '#D4FF2B',
    accentFgHex: '#080B10',
    courtOuterHex: '#081F52',
    courtInnerHex: '#1441A2',
    courtKitchenHex: '#0C2A6E',
    defaultPosterTheme: 'night_slam',
  },
];

const THEME_STORAGE_KEY = 'pickleball_scenic_theme_v1';

export function getThemeConfig(id: ScenicThemeId): ScenicThemeConfig {
  return SCENIC_THEMES.find((t) => t.id === id) ?? SCENIC_THEMES[0];
}

export function loadSavedTheme(): ScenicThemeId {
  if (typeof window === 'undefined') return 'sunset';
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY) as ScenicThemeId | null;
    if (raw && SCENIC_THEMES.some((t) => t.id === raw)) return raw;
  } catch {
    // Ignore storage read failure
  }
  return 'sunset';
}

export function saveTheme(id: ScenicThemeId): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    // Ignore storage write failure
  }
}
