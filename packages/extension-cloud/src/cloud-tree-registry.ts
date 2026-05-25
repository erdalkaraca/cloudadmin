import type { CloudConnection, CloudTreeContributor, CloudTreeNodeRef } from './models';

class CloudTreeRegistry {
  private readonly treeContributors = new Map<string, CloudTreeContributor>();

  registerTreeContributor(contributor: CloudTreeContributor): void {
    this.treeContributors.set(contributor.providerId, contributor);
  }

  getTreeContributor(providerId: string): CloudTreeContributor | undefined {
    return this.treeContributors.get(providerId);
  }

  async getChildren(
    parent: CloudTreeNodeRef | null,
    connection: CloudConnection,
  ): Promise<CloudTreeNodeRef[]> {
    const contributor = this.treeContributors.get(connection.providerId);
    if (!contributor) return [];
    return contributor.getChildren(parent, connection);
  }
}

export const cloudTreeRegistry = new CloudTreeRegistry();
