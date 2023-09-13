import { useState, useEffect } from 'react';

import { toast } from 'react-toastify';
import React from 'react';
import { Noir } from '../utils/noir';
import mainCircuit from '../circuits/main/target/main.json';
import recursiveCircuit from '../circuits/recursion/target/recursion.json';

import { ThreeDots } from 'react-loader-spinner';

function Component() {
  const [input, setInput] = useState({ x: '', y: '' });
  const [pending, setPending] = useState(false);
  const [mainNoir, setMainNoir] = useState(new Noir(mainCircuit));
  const [mainProof, setMainProof] = useState({ proof: Uint8Array.from([]), serialized: [''] });
  const [mainVerification, setMainVerification] = useState({
    verified: false,
    vk: [''],
    vkHash: '',
  });

  const [recursiveNoir, setRecursiveNoir] = useState(new Noir(recursiveCircuit));
  const [recursiveProof, setRecursiveProof] = useState({
    proof: Uint8Array.from([]),
    serialized: [''],
  });
  const [recursiveVerification, setRecursiveVerification] = useState({
    verified: false,
    vk: [''],
    vkHash: '',
  });

  // Handles input state
  const handleChange = e => {
    e.preventDefault();
    setInput({ ...input, [e.target.name]: e.target.value });
  };

  // Calculates the inner proof. This will be verified in another Noir circuit.
  //
  // This proof does not have any inputs related to recursion.
  // The variable `y` is public.
  const calculateMainProof = async () => {
    setPending(true);
    try {
      console.log('generating witnesses for inner proof');
      // Generates the intermediate witness values from the initial witness values
      // that are fed in via the text box.
      const xValue = '0x0000000000000000000000000000000000000000000000000000000000000001';
      const yValue = '0x0000000000000000000000000000000000000000000000000000000000000002';

      const witness = await mainNoir.generateWitness([xValue, yValue]);
      console.log('witnesses generated: ', witness);

      // There is one public input to the circuit, this is the `y` variable.
      const numPublicInputs = 1;

      // Generate the proof based off of the intermediate witness values.
      console.log('generating inner proof');
      const innerProof = await mainNoir.generateInnerProof(witness);
      console.log('inner proof generated: ', mainProof);

      // Verify the same proof, not inside of a circuit
      console.log('verifying inner proof (out of circuit)');
      const verified = await mainNoir.verifyInnerProof(innerProof);
      console.log('inner proof verified as', verified);

      // Now we will take that inner proof and verify it in an outer proof.
      console.log("Preparing input for outer proof");
      const { proofAsFields, vkAsFields, vkHash } = await mainNoir.generateInnerProofArtifacts(innerProof, numPublicInputs);

      console.log("Proof as Fields", proofAsFields);
      console.log("Vk as Fields", vkAsFields);
      console.log("Vk Hash", vkHash);
      const aggregationObject = Array(16).fill('0x0000000000000000000000000000000000000000000000000000000000000000');
      const recInput = [
        ...vkAsFields.map(e => e.toString()),
        ...proofAsFields,
        yValue,
        vkHash.toString(),
        ...aggregationObject,
      ];

      console.log("generate witnesses for outer circuit");
      const outerWitnesses = await recursiveNoir.generateWitness(recInput);
      console.log("witnesses generated for outer circuit", outerWitnesses);

      console.log("generating outer proof");
      const proof = await recursiveNoir.generateOuterProof(outerWitnesses);
      console.log("Outer proof generated: ", proof);

      console.log("Verifying outer proof");

      const outerProofVerified = await recursiveNoir.verifyOuterProof(proof);
      console.log("Outer proof verified as ", outerProofVerified);

    } catch (err) {
      console.log(err);
      toast.error('Error generating main proof');
    }

    setPending(false);
  };
  // Verify the main proof
  // useEffect(() => {
  //   if (mainProof.proof.length > 0) {
  //     console.log('verifying main proof');
  //     verifyProof(mainNoir, mainProof.proof, true);
  //   }
  // }, [mainProof]);

  // Prove the recursive proof
  useEffect(() => {
    if (mainVerification.verified) {
      console.log('calculating recursive proof');
      // calculateRecursiveProof();
    }
  }, [mainVerification]);

  const initNoir = async () => {
    console.log('init');
    setPending(true);

    setMainNoir(mainNoir);
    setRecursiveNoir(recursiveNoir);
    await mainNoir.init();
    await recursiveNoir.init();
    setPending(false);
  };

  useEffect(() => {
    initNoir();
  }, []);

  return (
    <div className="gameContainer">
      <h1>Example starter</h1>
      <h2>This circuit checks that x and y are different</h2>
      <p>Try it!</p>
      <input name="x" type={'text'} onChange={handleChange} value={input.x} />
      <input name="y" type={'text'} onChange={handleChange} value={input.y} />
      <button onClick={calculateMainProof}>Calculate proof</button>
      {pending && <ThreeDots wrapperClass="spinner" color="#000000" height={100} width={100} />}
    </div>
  );
}

export default Component;
