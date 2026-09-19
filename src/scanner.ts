import { join } from "node:path";
import { homedir } from "node:os";
import matter from "gray-matter";
import type { FileSystem } from "./file-system";

const home = homedir();

export const SKILL_PATHS = (worktree: string) => [
  join(worktree, ".opencode/skills"),
  join(home, ".config/opencode/skills"),
  join(home, ".opencode/skills"),
  join(worktree, ".claude/skills"),
  join(home, ".claude/skills"),
  join(worktree, ".agents/skills"),
  join(home, ".agents/skills"),
];

export type CommandMap = Record<
  string,
  { template: string; description: string }
>;

function isDirectory(
  entry: Awaited<ReturnType<FileSystem["readdir"]>>[number],
) {
  return entry.isDirectory() || entry.isSymbolicLink();
}

/**
 * Reads a single skill directory and returns a command map for every valid
 * SKILL.md found. Skills missing `name` or `description` frontmatter are
 * silently skipped.
 *
 * @param base - Path to the skill directory (e.g. `.opencode/skills`)
 * @param fs   - Filesystem abstraction
 * @returns A map of skill name → command definition
 */
export async function scanDir(
  base: string,
  fs: FileSystem,
): Promise<CommandMap> {
  let dirs: Awaited<ReturnType<FileSystem["readdir"]>>;
  try {
    dirs = await fs.readdir(base);
  } catch {
    return {};
  }

  const promises = [];

  for (const entry of dirs) {
    if (!isDirectory(entry)) continue;
    const mdPath = join(base, entry.name, "SKILL.md");

    promises.push(
      (async (mdPath: string): Promise<CommandMap> => {
        try {
          await fs.access(mdPath);
          const raw = await fs.readFile(mdPath, "utf-8");
          const { data, content } = matter(raw);
          if (data.name && data.description) {
            return {
              [data.name]: {
                template: content.trim(),
                description: data.description,
              },
            };
          }
          return {};
        } catch {
          return {};
        }
      })(mdPath),
    );
  }

  return (await Promise.all(promises)).reduce(
    (previous: CommandMap, next: CommandMap) => ({ ...previous, ...next }),
    {},
  );
}
