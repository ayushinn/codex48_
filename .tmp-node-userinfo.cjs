const os = require("node:os");
os.userInfo = () => ({ username: process.env.USERNAME || "codex" });
