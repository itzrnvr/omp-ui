/**
 * Path override for the OMP session lister.
 *
 * A present-but-empty override means "unset", the same way the CLI reads an
 * empty environment variable. Written as a zod schema so the override and
 * the environment are parsed by one contract instead of ad hoc checks.
 */

import { z } from 'zod'

const nonEmptyString = z.string().min(1)

/**
 * The OMP home directory: the override when set, then `OMP_HOME`, then the
 * user's home plus `.omp`. Returns a resolved absolute path.
 */
export const resolveOmpHome = (override, env) => {
  const fromOverride = nonEmptyString.safeParse(override)
  if (fromOverride.success) return fromOverride.data
  const fromEnv = nonEmptyString.safeParse(env.OMP_HOME)
  if (fromEnv.success) return fromEnv.data
  const userHome = nonEmptyString.safeParse(env.USERPROFILE)
  return userHome.success ? `${userHome.data}/.omp` : '.omp'
}
