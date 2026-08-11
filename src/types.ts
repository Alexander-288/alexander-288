/** Everything a card may read. Cards never fetch; they receive this. */
export interface ProfileData {
  user: {
    login: string;
    name: string;
    avatarDataUri: string;
    createdAt: string;
    followers: number;
    repositories: number;
  };
  totals: {
    releases: number;
    packages: number;
    diskUsageBytes: number;
    linesAdded: number;
    linesRemoved: number;
    stars: number;
    forks: number;
    watchers: number;
    sponsors: number;
    preferredLicense: string;
  };
  activity: {
    /** Up to 371 days of contribution counts, oldest first. */
    calendar: readonly CalendarDay[];
    last7Days: readonly CalendarDay[];
    reposTouchedLast7Days: number;
    currentStreakDays: number;
    avgCommitsPerDay: number;
  };
  habits: {
    /** 24 buckets, index = hour of day (UTC). */
    commitsByHour: readonly number[];
    /** 7 buckets, index 0 = Sunday. */
    commitsByWeekday: readonly number[];
    /** Top 3, by share of commits. */
    commitLanguages: readonly LanguageShare[];
    /** All, by share of bytes. */
    byteLanguages: readonly LanguageShare[];
  };
  currentProject: {
    repo: string;
    url: string;
    updatedAt: string;
    doing: string;
    next: string;
  } | null;
  authored: {
    learned: readonly TechEntry[];
    learning: readonly TechEntry[];
    pages: readonly PageEntry[];
    tracks: readonly TrackEntry[];
  };
}

export interface CalendarDay {
  date: string;
  count: number;
  /** 0..4, matching the theme's contribution scale. */
  level: number;
}

export interface LanguageShare {
  name: string;
  /** 0..1 */
  share: number;
  color: string;
}

export interface TechEntry {
  name: string;
  icon: string;
}

export interface PageEntry {
  title: string;
  url: string;
  rating: number;
}

export interface TrackEntry {
  title: string;
  artist: string;
}
