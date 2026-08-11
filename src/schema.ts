import { parse } from "yaml";
import { z } from "zod";

const Tech = z.object({ name: z.string().min(1), icon: z.string().min(1) });

export const ProfileYaml = z.object({
  sponsors: z.number().int().min(0),
  packages: z.number().int().min(0),
  current: z.object({
    doing: z.string().min(1),
    next: z.string().min(1),
  }),
  learned: z.array(Tech).default([]),
  learning: z.array(Tech).default([]),
  pages: z
    .array(
      z.object({
        title: z.string().min(1),
        url: z.string().url(),
        rating: z.number().int().min(1).max(5),
      })
    )
    .default([]),
  tracks: z
    .array(z.object({ title: z.string().min(1), artist: z.string().min(1) }))
    .default([]),
});

export type ProfileYaml = z.infer<typeof ProfileYaml>;

/**
 * Fails loudly. A half-valid file would render a half-drawn card, which is
 * worse than a red workflow run.
 */
export function parseProfileYaml(source: string): ProfileYaml {
  const raw = parse(source);
  const result = ProfileYaml.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`data/profile.yml is invalid:\n${issues}`);
  }
  return result.data;
}
