import {
  SIDEBAR_MAIN,
  TOPIC_CONTRIBUTEIONS_CHANGED,
  contributionRegistry,
  publish,
  type Contribution,
} from '@eclipse-docks/core';

export type SidebarTabRemap = {
  name: string;
  targets: string[];
};

/** Sidebar tab order: first entry in `remaps` is leftmost / default-active. */
export function installSidebarTabOrder(remaps: SidebarTabRemap[]): void {
  const order = remaps.map((r) => r.name).filter((name): name is string => !!name);
  if (order.length === 0) return;

  const getContributions = contributionRegistry.getContributions.bind(contributionRegistry);
  contributionRegistry.getContributions = <T extends Contribution>(target: string): T[] => {
    const list = getContributions<T>(target);
    if (target !== SIDEBAR_MAIN) return list;
    return sortByNameOrder(list, order);
  };

  publish(TOPIC_CONTRIBUTEIONS_CHANGED, {
    target: SIDEBAR_MAIN,
    contributions: contributionRegistry.getContributions(SIDEBAR_MAIN),
  });
}

function sortByNameOrder<T extends Contribution>(list: T[], order: string[]): T[] {
  const rank = new Map(order.map((name, index) => [name, index]));
  const fallback = order.length;
  return [...list].sort((a, b) => {
    const aRank = rank.get(a.name ?? '') ?? fallback;
    const bRank = rank.get(b.name ?? '') ?? fallback;
    if (aRank !== bRank) return aRank - bRank;
    return (a.label ?? a.name ?? '').localeCompare(b.label ?? b.name ?? '');
  });
}
