// Zod fragments shared across commands. Consolidating here keeps each
// command file focused on its own input/output shape.

import { z } from 'zod';

export const FormatFlag = z.enum(['json', 'md']).optional();

export const Args = z.array(z.string()).optional();

export const IdRef = z.string().min(1).optional();

export const UserRef = z.string().min(1).optional();

/** ISO date in YYYY-MM-DD form. */
export const DateFlag = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
  .optional();

/** Common base shape every command extends. `args` collects positional words after the verb path. */
export const CommonInput = z.object({ format: FormatFlag, args: Args }).strict();
