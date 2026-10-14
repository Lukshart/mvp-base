import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const projectId = "tesis-inventario-ia";
const dataDirectoryName = ".firebase-emulator-data";
const dataDirectory = resolve(dataDirectoryName);
const metadataFile = resolve(
  dataDirectory,
  "firebase-export-metadata.json"
);

function findLatestLocalBackup() {
  return readdirSync(resolve("."), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("firebase-export-"))
    .map((entry) => {
      const backupDirectory = resolve(entry.name);
      return {
        directory: backupDirectory,
        hasMetadata: existsSync(
          resolve(backupDirectory, "firebase-export-metadata.json")
        ),
        modifiedAt: statSync(backupDirectory).mtimeMs,
      };
    })
    .filter((backup) => backup.hasMetadata)
    .sort((left, right) => right.modifiedAt - left.modifiedAt)[0];
}

if (!existsSync(metadataFile)) {
  const latestBackup = findLatestLocalBackup();

  if (latestBackup) {
    mkdirSync(dataDirectory, { recursive: true });
    cpSync(latestBackup.directory, dataDirectory, {
      recursive: true,
      force: false,
      errorOnExist: false,
    });
    console.log(
      `Se restauró automáticamente la persistencia local desde ${latestBackup.directory}.`
    );
  }
}

const args = [
  "emulators:start",
  "--only",
  "auth,firestore,functions,storage",
  "--project",
  projectId,
  `--export-on-exit=${dataDirectoryName}`,
];

if (existsSync(metadataFile)) {
  args.push(`--import=${dataDirectoryName}`);
}

const child = spawn("firebase", args, {
  shell: process.platform === "win32",
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error("No fue posible iniciar Firebase Emulator Suite:", error.message);
  process.exitCode = 1;
});

child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
