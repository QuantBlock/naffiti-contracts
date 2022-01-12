import {BigNumber} from "ethers";

export const uint256Max: BigNumber = BigNumber.from(
    "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
);

export const NAFFITI = {
  mainnet: "0xd049206fB408a611E543791F2d8F102a8bC253dc",
  devchain: "0x90E4aA17f8Dd71BEb83485b084d276205a02b83C",
  rinkeby: "0x4884927BA594998B6ac8E51E7FFA242408Fe1101"
};

export const REWARD_DISPATCHER = {
  mainnet: "0xC041a45837259272b14259432aF9912255f01FE3",
  devchain: "",
  rinkeby: "0x2E095a5b80848C52Ac8a1316E40aEf967BA46589"
};

export const STAKING_POOLS = {
  mainnet: "0x5995383373DecBd673c2D3aB92e6118508f9B83e",
  devchain: "",
  rinkeby: "0xA069a780e3A3033D98cAbf83594e117e7a6d9AB8"
};

export const TOKEN_ESCROW = {
  mainnet: "",
  devchain: "",
};
