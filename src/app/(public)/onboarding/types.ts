/**
 * Shapes shared between the wizard's client components, the onboarding server
 * actions and the polling route handler.
 *
 * `chatId` is a string on purpose: Prisma models it as a BigInt, which cannot
 * cross the server/client boundary (no JSON representation, and React's
 * serializer refuses it). It is converted once, at the edge.
 */

export type ArrKindValue = "RADARR" | "SONARR";
export type AudioVersionValue = "VO" | "MULTI";

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
  version: AudioVersionValue;
  baseUrl: string;
  qualityProfileId: number;
  rootFolderPath: string;
}

export interface SetupSummary {
  administrator: { name: string; email: string } | null;
  instances: ConfiguredInstance[];
  chats: PublicTelegramChat[];
}
