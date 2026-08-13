-- One forum topic per purpose: ask in #request, approve in #admin, announce
-- in #general.
--
-- The old `threadId` was written by the Groups page and never read by
-- anything, so it becomes the requests topic — a rename rather than a drop,
-- because anyone who filled it in meant "the topic Askarr works in".
ALTER TABLE "TelegramChat" RENAME COLUMN "threadId" TO "requestThreadId";

ALTER TABLE "TelegramChat" ADD COLUMN "adminThreadId" INTEGER;
ALTER TABLE "TelegramChat" ADD COLUMN "generalThreadId" INTEGER;
