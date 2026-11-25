import {
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const backend = realpathSync(dirname(fileURLToPath(import.meta.url)));
const cache = join(backend, ".wrangler");
const sourceRoot = join(cache, "marai-src");

if (!existsSync(join(backend, "python_modules", "_workers_sdk_patch_loader.pth"))) {
  throw new Error("Worker dependencies are missing. Run npm run worker:sync in backend.");
}

mkdirSync(cache, { recursive: true });
if (
  realpathSync(cache) !== cache ||
  (existsSync(sourceRoot) && realpathSync(sourceRoot) !== sourceRoot)
) {
  throw new Error("The Worker staging directory must stay inside backend/.wrangler.");
}

rmSync(sourceRoot, { recursive: true, force: true });
mkdirSync(sourceRoot);

cpSync(join(backend, "app"), join(sourceRoot, "app"), {
  recursive: true,
  filter(source) {
    const name = basename(source);
    if (name.startsWith(".") || name === "__pycache__") return false;

    const entry = lstatSync(source);
    return entry.isDirectory() || (entry.isFile() && name.endsWith(".py"));
  },
});
copyFileSync(join(backend, "worker.py"), join(sourceRoot, "worker.py"));
