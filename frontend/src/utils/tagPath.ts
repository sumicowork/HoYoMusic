export interface TagPathNode {
  id: number;
  name: string;
  parent_id?: number | null;
  full_path?: string | null;
}

const normalizeTagPath = (path: string): string => {
  return path
    .replace(/\s*[\\/>]\s*/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

export const buildTagPathLookup = (tags: TagPathNode[]): Map<number, string> => {
  const byId = new Map<number, TagPathNode>();
  const cache = new Map<number, string>();

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

    if (parent) {
      const parentPath = resolvePath(parent, visiting);
      resolved = `${parentPath}-${tag.name}`;
    } else if (tag.full_path) {
      const normalized = normalizeTagPath(tag.full_path);
      if (normalized) {
        resolved = normalized;
      }
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

  if (tag.full_path) {
    const normalized = normalizeTagPath(tag.full_path);
    if (normalized) return normalized;
  }

  return tag.name;
};


