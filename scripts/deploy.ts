import { writeFileSync } from 'fs';
import { ethers } from 'hardhat';

async function main() {
  // Deploy the verifier contract
  const MainVerifier = await ethers.getContractFactory(
    'circuits/main/contract/main/plonk_vk.sol:UltraVerifier',
  );
  const mainVerifier = await MainVerifier.deploy();
  const mainVerifierAddr = await mainVerifier.deployed();

  const RecursiveVerifier = await ethers.getContractFactory(
    'circuits/recursion/contract/recursion/plonk_vk.sol:UltraVerifier',
  );
  const recursiveVerifier = await RecursiveVerifier.deploy();
  const recursiveVerifierAddr = await recursiveVerifier.deployed();
  // Create a config object
  const config = {
    chainId: ethers.provider.network.chainId,
    mainVerifier: mainVerifierAddr.address,
    recursiveVerifier: recursiveVerifierAddr.address,
  };

  // Print the config
  console.log('Deployed at', config);
  writeFileSync('utils/addresses.json', JSON.stringify(config), { flag: 'w' });
  process.exit();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
