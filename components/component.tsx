import { useState, useEffect } from 'react';

import { toast } from 'react-toastify';
import React from 'react';
import { NoirBrowser } from '../utils/noir/noirBrowser';
import mainCircuit from '../circuits/main/target/main.json';
import recursiveCircuit from '../circuits/recursion/target/recursion.json';

import { ThreeDots } from 'react-loader-spinner';

function Component() {
  const [input, setInput] = useState({ x: '', y: '' });
  const [pending, setPending] = useState(false);
  const [mainNoir, setMainNoir] = useState(new NoirBrowser(mainCircuit));
  const [mainProof, setMainProof] = useState({ proof: Uint8Array.from([]), serialized: [''] });
  const [mainVerification, setMainVerification] = useState({
    verified: false,
    vk: [''],
    vkHash: '',
  });

  const [recursiveNoir, setRecursiveNoir] = useState(new NoirBrowser(recursiveCircuit));
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

  // Calculates proof
  const calculateMainProof = async () => {
    setPending(true);
    try {
      console.log('generate main proof');
      const witness = await mainNoir.generateWitness(['0x' + input.x, '0x' + input.y]);
      const { proof, serialized } = await mainNoir.generateProof(witness, 1, true);
      setMainProof({ proof, serialized });
      console.log('main proof generation end');
    } catch (err) {
      console.log(err);
      toast.error('Error generating main proof');
    }

    setPending(false);
  };

  // Calculates proof
  const calculateRecursiveProof = async () => {
    setPending(true);
    const recInput = [
      ...mainVerification.vk.map(e => e.toString()),
      ...mainProof.serialized,
      '0x0000000000000000000000000000000000000000000000000000000000000002',
      mainVerification.vkHash.toString(),
      ...Array(16).fill('0x0000000000000000000000000000000000000000000000000000000000000000'),
    ];

    console.log('generating recursive proof');
    console.log('input');
    console.log('LENGTH', recInput.length);

    const witness = await recursiveNoir.generateWitness(recInput);
    console.log('witness generated');
    const { proof, serialized } = await recursiveNoir.generateProof(witness, 0, false);
    setRecursiveProof({ proof, serialized });
    console.log('recursive proof generation end');

    setPending(false);
    console.log('proof:', proof);
    await verifyProof(recursiveNoir, recursiveProof.proof, true);
  };

  const verifyProof = async (
    noirInstance: NoirBrowser,
    proof: Uint8Array,
    isRecursive: boolean = false,
  ) => {
    try {
      console.log('verifying proof, instance:', noirInstance);
      const { verified, vk, vkHash } = await noirInstance.verifyProof(proof, isRecursive);
      console.log('verified?', verified);
      setMainVerification({ verified, vk, vkHash });
      noirInstance.destroy();
      toast.success('Proof verified!');
    } catch (err) {
      console.log(err);
      toast.error('Error verifying your proof');
    } finally {
      mainNoir.destroy();
    }
  };

  // Verify the main proof
  useEffect(() => {
    if (mainProof.proof.length > 0) {
      console.log('verifying main proof');
      verifyProof(mainNoir, mainProof.proof, true);
    }
  }, [mainProof]);

  // Prove the recursive proof
  useEffect(() => {
    if (mainVerification.verified) {
      console.log('calculating recursive proof');
      calculateRecursiveProof();
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
