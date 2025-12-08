import { existsSync } from "fs";
import { resolve } from "path";
import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import * as dotenv from "dotenv";
import {
  initializeRegistry,
  getPlaybookRegistry,
  initializeLighthouseFromEnv,
  getSamplePlaybooks,
} from "../playbooks/index.js";

dotenv.config();

export default async function uploadPlaybookTask(
  taskArguments: any,
  hre: HardhatRuntimeEnvironment,
) {
  console.log("📤 Uploading Playbook to Community Storage\n");

  try {
    // Initialize
    initializeLighthouseFromEnv();
    const builtins = getSamplePlaybooks();
    await initializeRegistry(builtins);

    // Get file path from environment variable or first positional argument after task name
    let filePath = process.env.PLAYBOOK_FILE;

    if (!filePath) {
      // Try to get from process.argv after filtering out known Hardhat arguments
      const argv = process.argv.filter(
        (arg) => !arg.startsWith("--") && !arg.includes("hardhat"),
      );
      const taskIndex = argv.findIndex((arg) =>
        arg.includes("upload-playbook"),
      );
      filePath =
        taskIndex !== -1 && taskIndex + 1 < argv.length
          ? argv[taskIndex + 1]
          : undefined;
    }

    if (!filePath) {
      console.error("❌ Error: playbook file path is required\n");
      console.log("💡 Usage (Option 1 - Environment Variable):");
      console.log(
        "   PLAYBOOK_FILE=./playbooks/vault-security.yaml npx hardhat upload-playbook\n",
      );
      console.log("💡 Usage (Option 2 - Direct Command):");
      console.log("   Use the upload-playbook.js script:");
      console.log("   node upload-playbook.js ./playbooks/vault-security.yaml");
      process.exit(1);
    }

    // Resolve to absolute path
    const absolutePath = resolve(process.cwd(), filePath);

    if (!existsSync(absolutePath)) {
      throw new Error(`Playbook file not found: ${absolutePath}`);
    }

    console.log(`📄 File: ${absolutePath}\n`);

    const progressCallback = (progressData: any) => {
      const percentage =
        100 - ((progressData?.total / progressData?.uploaded) * 100 || 0);
      process.stdout.write(`\r   Progress: ${percentage.toFixed(2)}%`);
    };

    const registry = getPlaybookRegistry();
    const registered = await registry.uploadAndRegisterToLighthouse(
      absolutePath,
      undefined,
      progressCallback,
    );

    console.log(`\n\n✅ Playbook uploaded to community storage!\n`);
    console.log(`📋 Details:`);
    console.log(`   ID: ${registered.id}`);
    console.log(`   Name: ${registered.meta.name}`);
    console.log(`   Author: ${registered.meta.author || "unknown"}`);
    console.log(`   CID: ${registered.source.cid}`);
    console.log(`   URL: ${registered.source.location}\n`);
    console.log(`💡 Share this CID with others:`);
    console.log(`   ${registered.source.cid}\n`);
    console.log(`🔗 Anyone can now use this playbook:`);
    console.log(
      `   npx hardhat auditagent --playbook-cid ${registered.source.cid}`,
    );
  } catch (error) {
    console.error(
      `\n❌ Upload failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}
