import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";

import { HardhatUserConfig } from "hardhat/types";

const privatekey = process.env.WALLET_PRIVATE_KEY;
const accounts = privatekey ? [privatekey] : {mnemonic: "test test test test test test test test test test test junk"}

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 999999,
          },
          evmVersion: "istanbul",
        },
      },
    ],
  },
  networks: {
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts,
      gasPrice: 120 * 1000000000,
      chainId: 1,
    },
    localhost: {
    },
    hardhat: {
      forking: {
        enabled: process.env.FORKING === "true",
        url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
      },
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts,
      chainId: 4,
      gasPrice: 5000000000,
      gasMultiplier: 2
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts,
      chainId: 42,
      gasPrice: 20000000000,
      gasMultiplier: 2
    },
    devchain: {
      url: "https://rpc-dev.conv.finance",
      accounts,
      chainId: 10042,
    }
  },
};

export default config;
