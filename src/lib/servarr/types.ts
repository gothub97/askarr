/** Shapes returned by the Radarr/Sonarr v3 APIs, narrowed to what Askarr uses. */

export interface SystemStatus {
  version: string;
  appName?: string;
  instanceName?: string;
}

export interface QualityProfile {
  id: number;
  name: string;
}

export interface RootFolder {
  id: number;
  path: string;
  freeSpace?: number;
  accessible?: boolean;
}

export interface ArrImage {
  coverType: string;
  url?: string;
  remoteUrl?: string;
}

/** A movie as returned by /movie/lookup or /movie. */
export interface RadarrMovie {
  /** 0 or absent means the instance does not manage this title yet. */
  id?: number;
  tmdbId: number;
  title: string;
  year?: number;
  overview?: string;
  images?: ArrImage[];
  hasFile?: boolean;
  monitored?: boolean;
  status?: string;
  sizeOnDisk?: number;
}

export interface SonarrSeason {
  seasonNumber: number;
  monitored?: boolean;
}

/** A series as returned by /series/lookup or /series. */
export interface SonarrSeries {
  /** 0 or absent means the instance does not manage this title yet. */
  id?: number;
  tvdbId: number;
  title: string;
  year?: number;
  overview?: string;
  images?: ArrImage[];
  seasons?: SonarrSeason[];
  monitored?: boolean;
  status?: string;
  statistics?: { episodeFileCount?: number; episodeCount?: number };
}

/** Instance-agnostic search result, the only shape the bot and Mini App see. */
export interface LookupResult {
  /** tmdbId for movies, tvdbId for series. */
  externalId: number;
  title: string;
  year: number | null;
  overview: string | null;
  posterUrl: string | null;
  /**
   * True when the instance already manages this title.
   *
   * Managed is not the same as watchable, and conflating the two is how a
   * request for a film Radarr merely knows about gets answered "already in the
   * library, go watch it". Read it alongside hasFile and monitored.
   */
  alreadyManaged: boolean;
  /** A playable file exists: a movie file, or at least one episode. */
  hasFile: boolean;
  /** The instance is actually hunting for it. False means nothing will happen. */
  monitored: boolean;
  /**
   * Raw release status from the instance: "announced", "inCinemas",
   * "released" for a movie; "upcoming", "continuing", "ended" for a series.
   * An announced title cannot be found however hard anything looks.
   */
  releaseStatus: string | null;
  /** The id on the instance side, when already managed. */
  arrId: number | null;
  /** Highest season number, for the "Current season" choice. */
  latestSeason: number | null;
}

export type SonarrMonitorMode = "all" | "firstSeason" | "lastSeason";

export function pickPoster(images: ArrImage[] | undefined): string | null {
  if (!images?.length) return null;
  const poster =
    images.find((image) => image.coverType === "poster") ?? images[0];
  return poster.remoteUrl ?? poster.url ?? null;
}
