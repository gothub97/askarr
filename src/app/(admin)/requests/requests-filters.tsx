"use client";

import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export interface FilterOption {
  value: string;
  label: string;
}

export interface RequestFilters {
  search: string;
  status: string;
  requester: string;
  instance: string;
}

const ALL = "all";

/**
 * Filters live in the URL, not in component state: the server does the
 * filtering, so a filtered view can be linked to and survives a reload.
 */
export function RequestsFilters({
  filters,
  statuses,
  requesters,
  instances,
}: {
  filters: RequestFilters;
  statuses: FilterOption[];
  requesters: FilterOption[];
  instances: FilterOption[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState(filters.search);

  function apply(next: Partial<RequestFilters>): void {
    const merged = { ...filters, search, ...next };
    const params = new URLSearchParams();
    if (merged.search.trim()) params.set("q", merged.search.trim());
    if (merged.status !== ALL) params.set("status", merged.status);
    if (merged.requester !== ALL) params.set("requester", merged.requester);
    if (merged.instance !== ALL) params.set("instance", merged.instance);
    const query = params.toString();
    router.replace(query ? `/requests?${query}` : "/requests");
  }

  const statusItems = toItems(statuses, "Any status");
  const requesterItems = toItems(requesters, "Anyone");
  const instanceItems = toItems(instances, "Any instance");

  return (
    <form
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        apply({});
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="request-search" className="text-sm text-muted-foreground">
          Search a title
        </Label>
        <div className="flex gap-1.5">
          <Input
            id="request-search"
            value={search}
            placeholder="Dune, Severance…"
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button type="submit" variant="outline" size="default" aria-label="Search">
            <SearchIcon />
          </Button>
        </div>
      </div>

      <FilterSelect
        id="request-status"
        label="Status"
        value={filters.status}
        items={statusItems}
        onChange={(value) => apply({ status: value })}
      />
      <FilterSelect
        id="request-requester"
        label="Requester"
        value={filters.requester}
        items={requesterItems}
        onChange={(value) => apply({ requester: value })}
      />
      <FilterSelect
        id="request-instance"
        label="Instance"
        value={filters.instance}
        items={instanceItems}
        onChange={(value) => apply({ instance: value })}
      />
    </form>
  );
}

function toItems(options: FilterOption[], anyLabel: string): FilterOption[] {
  return [{ value: ALL, label: anyLabel }, ...options];
}

function FilterSelect({
  id,
  label,
  value,
  items,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  items: FilterOption[];
  onChange: (value: string) => void;
}) {
  const itemMap: Record<string, string> = {};
  for (const item of items) itemMap[item.value] = item.label;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-sm text-muted-foreground">
        {label}
      </Label>
      <Select
        items={itemMap}
        value={value}
        onValueChange={(next) => {
          if (typeof next === "string") onChange(next);
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
