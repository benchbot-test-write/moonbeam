import { Keyring } from "@polkadot/api";
import { expect } from "chai";
import child_process from "child_process";

import { ALITH_PRIV_KEY } from "../../util/constants";
import { describeParachain } from "../../util/setup-para-tests";

// This test will run on local until the new runtime is available

const localVersion = child_process
  .execSync(`grep 'spec_version: [0-9]*' ../runtime/moonbase/src/lib.rs | grep -o '[0-9]*'`)
  .toString()
  .trim();
const alreadyReleased = child_process
  .execSync(
    `git tag -l -n 'runtime-[0-9]*' | cut -d' ' -f 1 | cut -d'-' -f 2 | grep "${localVersion}"`
  )
  .toString()
  .trim();
const previousRelease = child_process
  .execSync(
    `git tag -l -n 'runtime-[0-9]*' | cut -d' ' -f 1 | cut -d'-' -f 2 | sort -n -r ` +
      `| uniq | grep -A1 "${localVersion}" | tail -1`
  )
  .toString()
  .trim();

if (localVersion == alreadyReleased) {
  console.log(`${localVersion} already released. Trying to upgrade on top of it`);
}
const baseRuntime = localVersion == alreadyReleased ? localVersion : previousRelease;
console.log(`Using base runtime ${baseRuntime}`);

const RUNTIME_VERSION = "local";
describeParachain(
  `Runtime upgrade ${RUNTIME_VERSION}`,
  {
    parachain: {
      chain: "moonbase-local",
      runtime: `runtime-${baseRuntime}`,
      binary: "local",
    },
    relaychain: {
      binary: "local",
    },
  },
  (context) => {
    it("should not fail", async function () {
      // Expected to take 10 blocks for upgrade + 4 blocks to check =>
      // ~200000 + init 60000 + error marging 140000
      this.timeout(400000);
      const keyring = new Keyring({ type: "ethereum" });
      const alith = await keyring.addFromUri(ALITH_PRIV_KEY, null, "ethereum");

      process.stdout.write("Checking current runtime...");
      const currentVersion = await (
        (await context.polkadotApiParaone.query.system.lastRuntimeUpgrade()) as any
      ).unwrap();
      expect(currentVersion.toJSON()).to.deep.equal({
        specVersion: Number(baseRuntime),
        specName: "moonbase",
      });
      console.log(
        `✅ runtime ${currentVersion.specName.toString()} ${currentVersion.specVersion.toString()}`
      );

      await context.upgradeRuntime(alith, "moonbase", RUNTIME_VERSION);

      process.stdout.write(`Checking on-chain runtime version ${localVersion}...`);
      expect(
        await (await context.polkadotApiParaone.query.system.lastRuntimeUpgrade()).toJSON()
      ).to.deep.equal({
        specVersion: Number(localVersion),
        specName: "moonbase",
      });
      process.stdout.write("✅\n");

      process.stdout.write("Waiting extra block being produced...");
      await context.waitBlocks(4); // Make sure the new runtime is producing blocks
      process.stdout.write(`✅ total ${context.blockNumber} block produced\n`);
    });
  }
);
