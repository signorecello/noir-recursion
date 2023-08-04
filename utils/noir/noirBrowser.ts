// TODO use the JSON directly for now
// import { compile } from '@noir-lang/noir_wasm';
import { decompressSync } from 'fflate';
import {
  BarretenbergApiAsync,
  Crs,
  newBarretenbergApiAsync,
  RawBuffer,
} from '@aztec/bb.js/dest/browser/index.js';
import initACVM, { executeCircuit, compressWitness } from '@noir-lang/acvm_js';
import { ethers } from 'ethers'; // I'm lazy so I'm using ethers to pad my input
import circuit from '../../circuits/target/noirstarter.json';
import { Ptr } from '@aztec/bb.js/dest/node/types';

export class NoirBrowser {
  acir: string = '';
  acirBuffer: Uint8Array = Uint8Array.from([]);
  acirBufferUncompressed: Uint8Array = Uint8Array.from([]);

  api = {} as BarretenbergApiAsync;
  acirComposer = {} as Ptr;

  async init() {
    await initACVM();
    // TODO disabled until we get a fix for std
    // const compiled_noir = compile({
    //   entry_point: `${__dirname}/../../circuits/src/main.nr`,
    // });
    this.acirBuffer = Buffer.from(circuit.bytecode, 'base64');
    this.acirBufferUncompressed = decompressSync(this.acirBuffer);

    this.api = await newBarretenbergApiAsync(8);

    const [exact, total, subgroup] = await this.api.acirGetCircuitSizes(
      this.acirBufferUncompressed,
    );

    const subgroupSize = Math.pow(2, Math.ceil(Math.log2(total)));
    const crs = await Crs.new(subgroupSize + 1);
    await this.api.commonInitSlabAllocator(subgroupSize);
    await this.api.srsInitSrs(
      new RawBuffer(crs.getG1Data()),
      crs.numPoints,
      new RawBuffer(crs.getG2Data()),
    );

    this.acirComposer = await this.api.acirNewAcirComposer(subgroupSize);
  }

  async generateWitness(input: string[]): Promise<Uint8Array> {
    const initialWitness = new Map<number, string>();
    for (let i = 1; i <= input.length; i++) {
      initialWitness.set(i, input[i - 1]);
    }

    const witnessMap = await executeCircuit(this.acirBuffer, initialWitness, () => {
      throw Error('unexpected oracle');
    });

    const witnessBuff = compressWitness(witnessMap);
    return witnessBuff;
  }

  async generateProof(witness: Uint8Array) {
    const proof = await this.api.acirCreateProof(
      this.acirComposer,
      this.acirBufferUncompressed,
      decompressSync(witness),
      true,
    );
    return proof;
  }

  async verifyProof(proof: Uint8Array) {
    console.log('proving key init');
    await this.api.acirInitProvingKey(this.acirComposer, this.acirBufferUncompressed);
    console.log('proving key init ok');
    console.log('proof:');
    console.log(proof);
    const verified = await this.api.acirVerifyProof(this.acirComposer, proof, true);
    console.log('proof verified');
    return verified;
  }

  async destroy() {
    await this.api.destroy();
  }
}
