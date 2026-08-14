import type { BotCommand } from "grammy/types";
import { Composer } from "grammy";
import type { AskarrContext } from "../handlers/context";
import { adminCommand } from "./admin";
import { helpCommand } from "./help";
import { requestsCommand } from "./requests";
import { searchCommands } from "./search";

export const commands = new Composer<AskarrContext>();

commands.use(searchCommands);
commands.use(requestsCommand);
commands.use(helpCommand);
commands.use(adminCommand);

/**
 * The autocomplete list. /admin is deliberately absent: it is checked at call
 * time anyway, and advertising it to everyone invites pointless taps.
 */
export const COMMAND_MENU: BotCommand[] = [
  { command: "movie", description: "Ask for a film" },
  { command: "series", description: "Ask for a show" },
  { command: "requests", description: "What you asked for" },
  { command: "help", description: "How this works" },
];
