/**
 * This script is to verify contract on DevChain blockscout
 * 
 * Before running this script, one must flatter their contract before passing to Blockscout to verify. 
 * The following contract flattern tools was used, but other tools like poa-solidity-flattener (https://github.com/poanetwork/solidity-flattener) should also work.
 * https://github.com/bokkypoobah/SolidityFlattener
 * 
 * Steps:
 * 1. Flattern the contract (may need to remove duplicate license declaration)
 * Command with SolidityFlattener
 * solidityFlattener.pl --contractsdir=contracts --remapdir "@openzeppelin/contracts=../node_modules/@openzeppelin/contracts" --mainsol=XXX.sol
 * 2. Add the contract to CONTRACT_VERIFICATION_SETTING
 * 3. Run verifyContract function
 */

import * as fs from "fs";
import * as os from "os";
import fetch from "node-fetch";

const CONTRACT_VERIFICATION_SETTING = {
    "StakingPools": {
        compilerVersion: "v0.7.6+commit.7338295f",
        optimization: true,
        sourceFile: "./flatten/StakingPools_flattened.sol",
        detectCtorArgs: true,
        evmVersion: "istanbul",
        optimizationRuns: 999999,
    },
    "TokenEscrow": {
        compilerVersion: "v0.7.6+commit.7338295f",
        optimization: true,
        sourceFile: "./flatten/TokenEscrow_flattened.sol",
        detectCtorArgs: true,
        evmVersion: "istanbul",
        optimizationRuns: 999999,
    },
    "NaffitiToken": {
        compilerVersion: "v0.7.6+commit.7338295f",
        optimization: true,
        sourceFile: "./flatten/NaffitiToken_flattened.sol",
        detectCtorArgs: true,
        evmVersion: "istanbul",
        optimizationRuns: 999999,
    }
}

export async function verifyContract(
    contractName:string,
    address: string
    ): Promise<void> {
        const contractVerifySetting = CONTRACT_VERIFICATION_SETTING[contractName];
        const params: any = {
            addressHash: address,
            name: contractName,
            compilerVersion: contractVerifySetting.compilerVersion,
            optimization: contractVerifySetting.optimization,
            contractSourceCode: fs.readFileSync(contractVerifySetting.sourceFile).toString(),
            autodetectConstructorArguments: contractVerifySetting.detectCtorArgs
              ? "true"
              : undefined,
            evmVersion: contractVerifySetting.evmVersion,
            optimizationRuns: contractVerifySetting.optimizationRuns,
          };
    
    const explorerUrl = "https://explorer-dev.conv.finance";
    
    const verifyRes = await fetch(
    `${explorerUrl}/api?module=contract&action=verify`,
    {
        method: "POST",
        body: JSON.stringify(params),
        headers: {
        "Content-Type": "application/json",
        },
    }
    );

    if (verifyRes.status !== 200) {
    console.error(
        `Unexpected contract verification response trying to verify ${contractName} at ${address}: ${verifyRes.status}`
    );
    console.error(`Response:${os.EOL}${await verifyRes.text()}`);

    throw new Error(
        `Unexpected contract verification response trying to verify ${contractName} at ${address}: ${verifyRes.status}`
    );
    }
}

async function main() {
    // await verifyContract("StakingPools", "0xD1Bf9dF525eF0Ff08a08A6C96285036787c72108");
    // console.log("Staking Pool Contract is verified")
    await verifyContract("TokenEscrow", "0x335Ed947bd7dd8Da6e7eaBdCcC4C0bF14A32043C");
    console.log("TokenEscrow Contract is verified")
    // await verifyContract("NaffitiToken", "0x90E4aA17f8Dd71BEb83485b084d276205a02b83C");
    // console.log("NaffitiToken Contract is verified")
}

main();
