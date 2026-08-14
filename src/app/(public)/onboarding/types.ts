/**
 * Shapes shared between the wizard's client components, the onboarding server
 * actions and the polling route handler.
 *
 * `chatId` is a string on purpose: Prisma models it as a BigInt, which cannot
 * cross the server/client boundary (no JSON representation, and React's
 * serializer refuses it). It is converted once, at the edge.
 */

export type ArrKindValue = "RADARR" | "SONARR";

export interface PublicTelegramChat {
  id: string;
  /** Telegram chat id, serialised. Negative for groups and supergroups. */
  chatId: string;
  /** Forum topic id, when the bot was added inside a topic. */
  threadId: number | null;
  title: string | null;
  enabled: boolean;
}

export interface ConfiguredInstance {
  id: string;
  label: string;
  kind: ArrKindValue;
  baseUrl: string;
  qualityProfileId: number;
  rootFolderPath: string;
}

export interface SetupSummary {
  administrator: { name: string; email: string } | null;
  instances: ConfiguredInstance[];
  chats: PublicTelegramChat[];
}

/**
 * How far setup actually got, read from the database rather than remembered by
 * the browser.
 *
 * Two steps of this wizard are gates now, which means the operator can be sent
 * away mid-run to talk to BotFather or to add a bot to a group. They must come
 * back to where they were, not to the beginning: until `setup_completed` is
 * true the middleware holds every route at /onboarding, so a wizard that forgot
 * its position would be a trap rather than an inconvenience.
 */
export interface SetupProgress {
  administrator: { name: string; email: string } | null;
  /** A token is in force, from the database or from the environment seed. */
  hasToken: boolean;
  /** Last four characters of that token, so two can be told apart. */
  tokenHint: string | null;
  bot: ResolvedBot | null;
  /**
   * The groups already allowed. Carried in full rather than counted, because
   * step 5 needs their row ids to create topics in one, and an operator who
   * comes back to a half-finished wizard must not be shown an empty list of
   * groups they know they allowed.
   */
  allowedChats: PublicTelegramChat[];
  hasInstance: boolean;
  /** True once every allowed group has all three topic ids stored. */
  hasTopics: boolean;
}

export interface ResolvedBot {
  username: string;
  displayName: string;
}

/**
 * What the bot process last reported. Step 3 shows this moving from no_token to
 * polling, which is the proof that the token it just saved actually worked.
 */
export interface PublicBotRuntime {
  state:
    | "polling"
    | "starting"
    | "token_rejected"
    | "no_token"
    | "unreachable"
    | "stopped";
  detail: string | null;
  username: string | null;
  /** False when the heartbeat has gone quiet, so "polling" cannot be trusted. */
  fresh: boolean;
}
