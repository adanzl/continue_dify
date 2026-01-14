const fs = require("fs");

const esbuild = require("esbuild");

const { writeBuildTimestamp } = require("./utils");

const flags = process.argv.slice(2);

const esbuildConfig = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "out/extension.js",
  external: ["vscode", "esbuild", "sqlite3", "./xhr-sync-worker.js"],
  format: "cjs",
  platform: "node",
  sourcemap: flags.includes("--sourcemap"),
  nodePaths: [
    "./node_modules",
    "../../core/node_modules"
  ],
  loader: {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ".node": "file",
  },

  // To allow import.meta.path for transformers.js
  // https://github.com/evanw/esbuild/issues/1492#issuecomment-893144483
  inject: ["./scripts/importMetaUrl.js"],
  define: { "import.meta.url": "importMetaUrl" },
  supported: { "dynamic-import": false },
  metafile: true,
  plugins: [
    {
      name: "on-end-plugin",
      setup(build) {
        build.onEnd((result) => {
          if (result.errors.length > 0) {
            console.error("Build failed with errors:", result.errors);
            throw new Error(result.errors);
          } else {
            try {
              // Ensure build directory exists
              if (!fs.existsSync("./build")) {
                fs.mkdirSync("./build", { recursive: true });
              }
              fs.writeFileSync(
                "./build/meta.json",
                JSON.stringify(result.metafile, null, 2),
              );
              
              // Copy xhr-sync-worker.js for jsdom
              const xhrWorkerSrc = "../../core/node_modules/jsdom/lib/jsdom/living/xhr/xhr-sync-worker.js";
              const xhrWorkerDest = "./out/xhr-sync-worker.js";
              if (fs.existsSync(xhrWorkerSrc)) {
                fs.copyFileSync(xhrWorkerSrc, xhrWorkerDest);
              }
              
              // Copy tree-sitter.wasm
              const treeSitterSrc = "../../core/vendor/tree-sitter.wasm";
              const treeSitterDest = "./out/tree-sitter.wasm";
              if (fs.existsSync(treeSitterSrc)) {
                fs.copyFileSync(treeSitterSrc, treeSitterDest);
              }
              
              // Copy .mjs worker files
              const mjsFiles = [
                "llamaTokenizerWorkerPool.mjs",
                "llamaTokenizer.mjs", 
                "tiktokenWorkerPool.mjs"
              ];
              mjsFiles.forEach(file => {
                const src = `../../core/llm/${file}`;
                const dest = `./out/${file}`;
                if (fs.existsSync(src)) {
                  fs.copyFileSync(src, dest);
                }
              });
            } catch (e) {
              console.error("Failed to write esbuild meta file", e);
            }
            console.log("VS Code Extension esbuild complete"); // used verbatim in vscode tasks to detect completion
          }
        });
      },
    },
  ],
};

void (async () => {
  // Create .buildTimestamp.js before starting the first build
  writeBuildTimestamp();
  // Bundles the extension into one file
  if (flags.includes("--watch")) {
    const ctx = await esbuild.context(esbuildConfig);
    await ctx.watch();
  } else if (flags.includes("--notify")) {
    const inFile = esbuildConfig.entryPoints[0];
    const outFile = esbuildConfig.outfile;

    // The watcher automatically notices changes to source files
    // so the only thing it needs to be notified about is if the
    // output file gets removed.
    if (fs.existsSync(outFile)) {
      console.log("VS Code Extension esbuild up to date");
      return;
    }

    fs.watchFile(outFile, (current, previous) => {
      if (current.size > 0) {
        console.log("VS Code Extension esbuild rebuild complete");
        fs.unwatchFile(outFile);
        process.exit(0);
      }
    });

    console.log("Triggering VS Code Extension esbuild rebuild...");
    writeBuildTimestamp();
  } else {
    await esbuild.build(esbuildConfig);
  }
})();
