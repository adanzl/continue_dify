/**
 * This is the entry point for the extension.
 */

import * as vscode from "vscode";

import { setupCa } from "../../../core/util/ca";

// import { extractMinimalStackTraceInfo } from "../../../core/util/extractMinimalStackTraceInfo";
// import { Telemetry } from "../../../core/util/posthog";
// import { SentryLogger } from "../../../core/util/sentry/SentryLogger";
// import { getExtensionVersion } from "./util/util";

export { default as buildTimestamp } from "./.buildTimestamp";

async function dynamicImportAndActivate(context: vscode.ExtensionContext) {
  await setupCa();
  const { activateExtension } = await import("./activation/activate");
  return await activateExtension(context);
}

export function activate(context: vscode.ExtensionContext) {
  return dynamicImportAndActivate(context).catch((e) => {
    console.error("Error activating extension: ", e);
    // Telemetry disabled
    // Telemetry.capture(
    //   "vscode_extension_activation_error",
    //   {
    //     stack: extractMinimalStackTraceInfo(e.stack),
    //     message: e.message,
    //   },
    //   false,
    //   true,
    // );
    void vscode.window
      .showWarningMessage(
        "Error activating the Continue Dify extension.",
        "View Logs",
        "Retry",
      )
      .then((selection) => {
        if (selection === "View Logs") {
          // Use built-in command since extension commands may not be registered yet
          void vscode.commands.executeCommand("workbench.action.toggleDevTools");
        } else if (selection === "Retry") {
          // Reload VS Code window
          void vscode.commands.executeCommand("workbench.action.reloadWindow");
        }
      });
  });
}

export function deactivate() {
  // Telemetry disabled
  // void Telemetry.capture(
  //   "deactivate",
  //   {
  //     extensionVersion: getExtensionVersion(),
  //   },
  //   true,
  // );

  // Telemetry.shutdownPosthogClient();
  // SentryLogger.shutdownSentryClient();
}
