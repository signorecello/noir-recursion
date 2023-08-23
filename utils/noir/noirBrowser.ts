import { decompressSync } from 'fflate';
import {
  BarretenbergApiAsync,
  Crs,
  newBarretenbergApiAsync,
  RawBuffer,
} from '@aztec/bb.js/dest/browser/index.js';
import initACVM, { executeCircuit, compressWitness } from '@noir-lang/acvm_js';
import { ethers } from 'ethers'; // I'm lazy so I'm using ethers to pad my input
import { Ptr, Fr } from '@aztec/bb.js/dest/node/types';

export class NoirBrowser {
  circuit: any;
  acir: string = '';
  acirBuffer: Uint8Array = Uint8Array.from([]);
  acirBufferUncompressed: Uint8Array = Uint8Array.from([]);

  api = {} as BarretenbergApiAsync;
  acirComposer = {} as Ptr;

  constructor(circuit: Object) {
    this.circuit = circuit;
  }

  async init() {
    await initACVM();
    this.acirBuffer = Buffer.from(this.circuit.bytecode, 'base64');
    this.acirBufferUncompressed = decompressSync(this.acirBuffer);

    this.api = await newBarretenbergApiAsync(4);

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
    // await this.api.acirInitProvingKey(this.acirComposer, this.acirBufferUncompressed);
    // const exp = await this.api.binder.wasm.exports();
  }

  async generateWitness(input: any): Promise<Uint8Array> {
    const initialWitness = new Map<number, string>();
    for (let i = 1; i <= input.length; i++) {
      initialWitness.set(i, ethers.utils.hexZeroPad(input[i - 1], 32));
    }

    const witnessMap = await executeCircuit(this.acirBuffer, initialWitness, () => {
      throw Error('unexpected oracle');
    });

    const witnessBuff = compressWitness(witnessMap);

    return witnessBuff;
  }

  async generateProof(witness: Uint8Array, numOfInputs: number = 0, recursive: boolean) {
    const proof = await this.api.acirCreateProof(
      this.acirComposer,
      this.acirBufferUncompressed,
      decompressSync(witness),
      recursive,
    );

    const serialized = await this.api.acirSerializeProofIntoFields(
      this.acirComposer,
      proof,
      numOfInputs,
    );

    return { proof, serialized: serialized.map(p => p.toString()) };
  }

  async verifyProof(proof: Uint8Array, recursive: boolean) {
    // await this.api.acirInitVerificationKey(this.acirComposer);

    const verified = await this.api.acirVerifyProof(this.acirComposer, proof, recursive);

    const vk = await this.api.acirSerializeVerificationKeyIntoFields(this.acirComposer);
    return { verified, vk: vk[0].map(vk => vk.toString()), vkHash: vk[1].toString() };
  }

  async destroy() {
    await this.api.destroy();
  }
}
