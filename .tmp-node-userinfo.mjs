import os from "node:os";
import { syncBuiltinESMExports } from "node:module";
os.userInfo = () => ({ username: process.env.USERNAME || "codex" });
syncBuiltinESMExports();
