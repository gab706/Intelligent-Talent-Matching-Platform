/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
export function getUserAccountType(user: {
	candidate?: unknown;
	employer?: unknown;
}): 1 | 2 | 3 {
	if (user.candidate && user.employer)
		return 3;

	if (user.employer)
		return 2;

	return 1;
}
