/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
'use strict';

import { readdirSync, copyFileSync, mkdirSync } from 'fs';
import path from 'path';

function copyDir(src, dest) {
	mkdirSync(dest, { recursive: true });
	
	const entries = readdirSync(src, { withFileTypes: true });
	
	for (const entry of entries) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);
		
		if (entry.isDirectory()) {
			copyDir(srcPath, destPath);
		} else {
			copyFileSync(srcPath, destPath);
		}
	}
}

copyDir('./src/web', './build/src/web');