const fs = require('fs');
const path = require('path');

const { ethers } = require('ethers');
const { LitNodeClient } = require('@lit-protocol/lit-node-client');
const { encryptToJson, decryptFromJson } = require('@lit-protocol/encryption');
const { LitAccessControlConditionResource, createSiweMessageWithRecaps, generateAuthSig } = require('@lit-protocol/auth-helpers');
const { LitAbility } = require('@lit-protocol/types');

(async () => {
  const envPath = path.resolve(__dirname, '../../backend/.env');
  const envRaw = fs.readFileSync(envPath, 'utf8');
  for (const line of envRaw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const k = trimmed.slice(0, idx).trim();
    const v = trimmed.slice(idx + 1).trim();
    if (!(k in process.env)) process.env[k] = v;
  }
  const key = process.env.AMOY_TEST_DEVELOPER_KEY || process.env.DEVELOPER_KEY || process.env.AMOY_DEPLOYER_KEY;
  const rpc = process.env.AMOY_RPC_URL || process.env.RPC_URL || process.env.PUBLIC_AMOY_RPC_URL;
  const factoryAddress = process.env.FACTORY_ADDRESS;
  const backend = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 8080}`;
  if (!key || !rpc || !factoryAddress) throw new Error('Missing key/rpc/factory in backend .env');

  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(key, provider);
  const addr = await wallet.getAddress();

  const factoryAbi = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../backend/contracts/IntelPoolFactory.json'),'utf8')).abi;
  const poolAbi = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../backend/contracts/IntelPool.json'),'utf8')).abi;

  const factory = new ethers.Contract(factoryAddress, factoryAbi, wallet);
  const threshold = ethers.parseUnits('1', 6);
  const minContribution = ethers.parseUnits('1', 6);
  const deadline = BigInt(Math.floor(Date.now()/1000)+3600);
  const ciphertext = ethers.hexlify(ethers.toUtf8Bytes('integration-cipher-'+Date.now()));

  async function waitReceipt(hash, attempts = 30, delayMs = 2000) {
    for (let i = 0; i < attempts; i++) {
      try {
        const r = await provider.getTransactionReceipt(hash);
        if (r) return r;
      } catch {}
      await new Promise((r) => setTimeout(r, delayMs));
    }
    throw new Error(`No receipt for tx ${hash}`);
  }

  const tx = await factory.createPool(threshold, minContribution, deadline, ethers.getBytes(ciphertext));
  const receipt = await waitReceipt(tx.hash);
  let poolAddress = null;
  for (const log of receipt.logs) {
    try {
      const p = factory.interface.parseLog(log);
      if (p && p.name === 'PoolCreated') { poolAddress = p.args.pool; break; }
    } catch {}
  }
  if (!poolAddress) throw new Error('PoolCreated not found');
  console.log('pool', poolAddress);

  const nonceRes = await fetch(`${backend}/auth/nonce?address=${encodeURIComponent(addr)}`);
  const nonceBody = await nonceRes.json();
  const message = nonceBody.message;
  const sig = await wallet.signMessage(message);
  const verifyRes = await fetch(`${backend}/auth/verify`, {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({address:addr, signature:sig})});
  const verifyBody = await verifyRes.json();
  if (!verifyRes.ok) throw new Error('auth verify failed '+JSON.stringify(verifyBody));
  const token = verifyBody.token;
  const authHeaders = {'content-type':'application/json', authorization:`Bearer ${token}`};

  const createPayload = {
    id: poolAddress,
    threshold: '1',
    minContributionForDecrypt: '1',
    deadline: String(deadline),
    ciphertext,
    title: 'integration test pool',
    description: 'integration test'
  };
  const createRes = await fetch(`${backend}/pools`, {method:'POST', headers:authHeaders, body:JSON.stringify(createPayload)});
  const createBody = await createRes.json();
  if (!createRes.ok) throw new Error('backend pool create failed '+JSON.stringify(createBody));

  const lit = new LitNodeClient({ litNetwork: 'datil-dev', checkNodeAttestation:false, debug:false });
  await lit.connect();

  const payloadHex = '0x' + Buffer.from('0123456789abcdef0123456789abcdef').toString('hex');
  const conditions = [{
    conditionType: 'evmContract',
    contractAddress: poolAddress,
    chain: 'amoy',
    functionName: 'canDecrypt',
    functionParams: [':userAddress'],
    functionAbi: {
      name: 'canDecrypt', type: 'function', stateMutability: 'view',
      inputs: [{name:'contributor', type:'address', internalType:'address'}],
      outputs: [{name:'', type:'bool', internalType:'bool'}]
    },
    returnValueTest: { key:'', comparator:'=', value:'true' }
  }];

  const encryptedBlob = await encryptToJson({ chain:'amoy', string: payloadHex, evmContractConditions: conditions, litNodeClient: lit });
  const intelRes = await fetch(`${backend}/intel`, {method:'POST', headers:authHeaders, body:JSON.stringify({poolId:poolAddress, ciphertext, messageKit: encryptedBlob})});
  const intelBody = await intelRes.json();
  if (!intelRes.ok) throw new Error('upload intel failed '+JSON.stringify(intelBody));

  const getIntelRes = await fetch(`${backend}/intel/${poolAddress}`);
  const getIntel = await getIntelRes.json();
  if (!getIntelRes.ok) throw new Error('fetch intel failed '+JSON.stringify(getIntel));

  async function getSessionSigs() {
    return lit.getSessionSigs({
      chain: 'ethereum',
      expiration: new Date(Date.now()+1000*60*15).toISOString(),
      resourceAbilityRequests: [{resource: new LitAccessControlConditionResource('*'), ability: LitAbility.AccessControlConditionDecryption}],
      authNeededCallback: async (params) => {
        const toSign = await createSiweMessageWithRecaps({
          uri: params.uri,
          expiration: params.expiration,
          resources: params.resourceAbilityRequests,
          walletAddress: addr,
          nonce: params.nonce,
          litNodeClient: lit
        });
        return generateAuthSig({ signer: wallet, toSign });
      }
    });
  }

  let beforeUnlockFailed = false;
  try {
    const sessionSigs = await getSessionSigs();
    await decryptFromJson({ sessionSigs, litNodeClient: lit, parsedJsonData: JSON.parse(encryptedBlob) });
  } catch (e) {
    beforeUnlockFailed = true;
  }

  const pool = new ethers.Contract(poolAddress, poolAbi, wallet);
  const currency = await pool.currency();
  const erc20 = new ethers.Contract(currency, [
    'function balanceOf(address) view returns (uint256)',
    'function allowance(address,address) view returns (uint256)',
    'function approve(address,uint256) returns (bool)'
  ], wallet);
  const bal = await erc20.balanceOf(addr);
  if (bal < threshold) throw new Error('Insufficient USDC balance for contribution');
  const allowance = await erc20.allowance(addr, poolAddress);
  if (allowance < threshold) {
    const ap = await erc20.approve(poolAddress, threshold);
    await waitReceipt(ap.hash);
  }
  const c = await pool.contribute(threshold);
  await waitReceipt(c.hash);
  const unlocked = await pool.unlocked();

  let afterUnlockSucceeded = false;
  let decrypted = '';
  try {
    const sessionSigs = await getSessionSigs();
    const out = await decryptFromJson({ sessionSigs, litNodeClient: lit, parsedJsonData: JSON.parse(encryptedBlob) });
    decrypted = typeof out === 'string' ? out : '0x'+Buffer.from(out).toString('hex');
    afterUnlockSucceeded = true;
  } catch (e) {
    console.error('after unlock decrypt failed', e?.message || e);
  }

  const summary = {
    poolAddress,
    createPoolSucceeded: true,
    messageKitStored: !!getIntel.messageKit,
    beforeUnlockDecryptFailed: beforeUnlockFailed,
    unlocked: !!unlocked,
    afterUnlockDecryptSucceeded: afterUnlockSucceeded,
    decryptedEqualsPayload: decrypted.toLowerCase() === payloadHex.toLowerCase()
  };
  console.log(JSON.stringify(summary, null, 2));
})();
