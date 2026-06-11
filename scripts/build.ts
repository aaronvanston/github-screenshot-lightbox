import { USERSCRIPT_BANNER } from "../src/meta";

const proc = Bun.spawn({
  cmd: [
    "bun",
    "build",
    "src/index.ts",
    "--outfile",
    "github-screenshot-lightbox.user.js",
    "--target",
    "browser",
    "--format",
    "iife",
    "--banner",
    USERSCRIPT_BANNER,
  ],
  stdout: "inherit",
  stderr: "inherit",
});

const exitCode = await proc.exited;
if (exitCode !== 0) {
  process.exit(1);
}
