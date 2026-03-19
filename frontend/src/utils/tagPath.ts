export interface TagPathNode {
  id: number;
  name: string;
  parent_id?: number | null;
  group_id?: number | null;
  group_name?: string | null;
  full_path?: string | null;
}

export interface TagGroupPathNode {
  id: number;
  name: string;
  parent_group_id?: number | null;
}

const normalizeTagPath = (path: string): string => {
  return path
    .replace(/\s*[\\/>]\s*/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();
};

const buildGroupPathLookup = (groups: TagGroupPathNode[]): Map<number, string> => {
  const byId = new Map<number, TagGroupPathNode>();
  const cache = new Map<number, string>();

  groups.forEach((group) => byId.set(group.id, group));

  const resolveGroupPath = (group: TagGroupPathNode, visiting: Set<number>): string => {
    const cached = cache.get(group.id);
    if (cached) return cached;

    if (visiting.has(group.id)) {
      return group.name;
    }

    visiting.add(group.id);

    let resolved = group.name;
    const parentId = group.parent_group_id ?? null;
    const parent = parentId ? byId.get(parentId) : undefined;

    if (parent) {
      const parentPath = resolveGroupPath(parent, visiting);
      resolved = `${parentPath}-${group.name}`;
    }

    visiting.delete(group.id);
    cache.set(group.id, resolved);
    return resolved;
  };

  groups.forEach((group) => {
    resolveGroupPath(group, new Set<number>());
  });

  return cache;
};

export const buildTagPathLookup = (
  tags: TagPathNode[],
  groups: TagGroupPathNode[] = []
): Map<number, string> => {
  const byId = new Map<number, TagPathNode>();
  const cache = new Map<number, string>();
  const groupPathLookup = buildGroupPathLookup(groups);

  tags.forEach((tag) => byId.set(tag.id, tag));

  const resolvePath = (tag: TagPathNode, visiting: Set<number>): string => {
    const cached = cache.get(tag.id);
    if (cached) return cached;

    if (visiting.has(tag.id)) {
      return tag.name;
    }

    visiting.add(tag.id);

    let resolved = tag.name;
    const parentId = tag.parent_id ?? null;
    const parent = parentId ? byId.get(parentId) : undefined;
    const groupPrefix = tag.group_id
      ? groupPathLookup.get(tag.group_id)
      : tag.group_name || undefined;
    const normalizedFullPath = tag.full_path ? normalizeTagPath(tag.full_path) : undefined;

    if (parent) {
      const parentPath = resolvePath(parent, visiting);
      resolved = `${parentPath}-${tag.name}`;
    } else if (groupPrefix) {
      resolved = `${groupPrefix}-${tag.name}`;
    } else if (normalizedFullPath) {
      resolved = normalizedFullPath;
    }

    visiting.delete(tag.id);
    cache.set(tag.id, resolved);
    return resolved;
  };

  tags.forEach((tag) => {
    resolvePath(tag, new Set<number>());
  });

  return cache;
};

export const getTagPathLabel = (tag: TagPathNode, pathLookup?: Map<number, string>): string => {
  const fromLookup = pathLookup?.get(tag.id);
  if (fromLookup) return fromLookup;

  if (tag.group_name) {
    return `${tag.group_name}-${tag.name}`;
  }

  if (tag.full_path) {
    const normalized = normalizeTagPath(tag.full_path);
    if (normalized) return normalized;
  }

  return tag.name;
};


