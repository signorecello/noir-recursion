// @ts-ignore
import { expect } from 'chai';
import ethers, { Contract } from 'ethers';
import path from 'path';
import { NoirNode } from '../utils/noir/noirNode';
import { execSync } from 'child_process';

import verifier from '../artifacts/circuits/recursion/contract/recursion/plonk_vk.sol/UltraVerifier.json';
import mainCircuit from '../circuits/main/target/main.json';
import recursiveCircuit from '../circuits/recursion/target/recursion.json';

// import { input } from '../input';
import { test, beforeAll, describe } from 'vitest';

describe('It compiles noir program code, receiving circuit bytes and abi object.', () => {
  let verifierContract: Contract;
  let correctProof: any;
  let provider = ethers.getDefaultProvider('http://127.0.0.1:8545');
  let deployerWallet = new ethers.Wallet(
    process.env.DEPLOYER_PRIVATE_KEY as unknown as string,
    provider,
  );

  beforeAll(async () => {
    const Verifier = new ethers.ContractFactory(verifier.abi, verifier.bytecode, deployerWallet);
    verifierContract = await Verifier.deploy();

    const verifierAddr = await verifierContract.deployed();
    console.log(`Verifier deployed to ${verifierAddr.address}`);
  });

  let recInput: string[] = [];

  it('Should generate valid proof for correct input', async () => {
    const noir = new NoirNode(mainCircuit);
    const input = [ethers.utils.hexZeroPad('0x1', 32), ethers.utils.hexZeroPad('0x2', 32)];
    await noir.init();
    const witness = await noir.generateWitness(input);
    const { proof, serialized } = await noir.generateProof(witness, 1, false);

    expect(proof instanceof Uint8Array).to.be.true;

    const { verified, vk, vkHash } = await noir.verifyProof(proof, false);
    expect(verified).to.be.true;
    expect(vk).to.be.of.length(114);
    expect(vkHash).to.be.a('string');

    recInput = [
      ...vk.map(e => e.toString()),
      ...serialized,
      ...[ethers.utils.hexZeroPad('0x2', 32)],
      vkHash.toString(),
      ...Array(16).fill('0x0000000000000000000000000000000000000000000000000000000000000000'),
    ];

    noir.destroy();
  });

  it('Should verify proof within a proof', async () => {
    const noir = new NoirNode(recursiveCircuit);
    const input = recInput;
    await noir.init();

    const witness = await noir.generateWitness(input);
    const { proof } = await noir.generateProof(witness, 0, true);
    expect(proof instanceof Uint8Array).to.be.true;
    console.log(proof);

    const { verified } = await noir.verifyProof(proof, true);
    console.log(verified);
    noir.destroy();
  });
});
