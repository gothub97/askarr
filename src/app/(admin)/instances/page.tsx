import { PageHeader } from "@/components/admin/page-header";
import { prisma } from "@/lib/prisma";
import { findRootFolderCollisions, toPublicInstance } from "@/lib/instances";
import { InstancesManager } from "./instances-manager";
import { appUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function InstancesPage() {
  const [instances, collisions] = await Promise.all([
    prisma.arrInstance.findMany({
      orderBy: [{ kind: "asc" }, { label: "asc" }],
    }),
    findRootFolderCollisions(),
  ]);

  // toPublicInstance masks the API key: the raw one never reaches the browser.
  const url = appUrl() ?? "http://localhost:3000";
  const publicInstances = instances.map((instance) =>
    toPublicInstance(instance, url),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Instances"
        description="The Radarr and Sonarr instances Askarr pushes approved titles to."
      />
      <InstancesManager
        instances={publicInstances}
        collisions={collisions}
      />
    </div>
  );
}
