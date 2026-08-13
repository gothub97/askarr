import { PageHeader } from "@/components/admin/page-header";
import { readBotStatus } from "@/lib/bot-control";
import { getBotTokenState } from "@/lib/bot-token";
import { BotManager } from "./bot-manager";

export const dynamic = "force-dynamic";

export default async function BotPage() {
  const [token, status] = await Promise.all([getBotTokenState(), readBotStatus()]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Bot"
        description="The token Askarr talks to Telegram with."
      />

      <BotManager
        initialOverview={{
          token,
          status,
        }}
      />
    </div>
  );
}
