#!/usr/bin/env node
// Thin shim. The TypeScript build emits out/cli.js; this file is what npm
// links into the user's PATH.
require("../out/cli.js");
