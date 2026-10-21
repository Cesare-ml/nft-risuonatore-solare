#!/usr/bin/env node
/**
 * Solar Resonator Polygon ERC-1155 audit. READ ONLY.
 * Uses only: eth_chainId, eth_blockNumber, eth_getCode, eth_call, eth_getLogs,
 * and optional HTTPS GET for a public, verified ABI.
 * No wallet, private keys, transaction encoding, signing, or writes to chain.
 *
 * Node.js >= 18.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOT = resolve(ROOT, 'data/opensea/observed-2026-10-21.json');
const CONTRACT = '0xead98e12d3836562ea39c6a6ca5ef1292359a862';
const CHAIN_ID = 137;
const DEFAULT_RPC = 'https://polygon.drpc.org'; // Polygon official docs, 2026.
const ZERO_TOPIC = '0x' + '0'.repeat(64);
const SINGLE = '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62';
const BATCH = '0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb';

function argsOf(argv) {
  const opts = { from: null, to: null, out: null, abi: null, selfTest: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--self-test') { opts.selfTest = true; continue; }
    if (a === '--help') { opts.help = true; continue; }
    const mapping = { '--from-block': 'from', '--to-block': 'to', '--out': 'out', '--abi': 'abi' };
    if (!mapping[a]) throw new Error('Unknown argument: ' + a);
    const val = argv[++i];
    if (!val || val.startsWith('--')) throw new Error('Missing value for ' + a);
    opts[mapping[a]] = (a.endsWith('block')) ? Number(val) : val;
  }
  for (const k of ['from', 'to']) {
    if (opts[k] !== null && (!Number.isSafeInteger(opts[k]) || opts[k] < 0)) {
      throw new Error(k + ' must be a non-negative integer');
    }
  }
  return opts;
}

function encodeUint(value) {
  const v = BigInt(value);
  if (v < 0n) throw new Error('Negative uint');
  return v.toString(16).padStart(64, '0');
}
function decodeWord(hex, byteOffset) {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const p = Number(byteOffset) * 2;
  if (!Number.isSafeInteger(p) || p < 0 || p + 64 > clean.length) {
    throw new Error('Truncated ABI word at offset ' + byteOffset);
  }
  return BigInt('0x' + clean.slice(p, p + 64));
}
function decodeAbiString(hex) {
  if (!/^0x[0-9a-fA-F]*$/.test(hex)) throw new Error('Invalid ABI hex string');
  const offset = Number(decodeWord(hex, 0));
  if (offset % 32 !== 0 || offset < 32 || offset > 131072) throw new Error('Bad string offset');
  const len = Number(decodeWord(hex, offset));
  if (!Number.isSafeInteger(len) || len > 65536) throw new Error('Unreasonable ABI string length');
  const clean = hex.slice(2);
  const data = clean.slice((offset + 32) * 2, (offset + 32 + len) * 2);
  if (data.length !== len * 2) throw new Error('Truncated ABI string');
  return Buffer.from(data, 'hex').toString('utf8');
}
function expand1155Uri(uri, id) {
  return uri.replace(/\{id\}/gi, BigInt(id).toString(16).padStart(64, '0'));
}
function arrayOfUint(hex, offset) {
  const len = Number(decodeWord(hex, offset));
  if (!Number.isSafeInteger(len) || len < 0 || len > 10000) throw new Error('Invalid array length');
  const arr = [];
  for (let i = 0; i < len; i++) arr.push(decodeWord(hex, offset + 32 + i * 32).toString());
  return arr;
}
function parseMintLog(log) {
  if (!Array.isArray(log.topics) || log.topics.length !== 4 ||
      log.topics[2]?.toLowerCase() !== ZERO_TOPIC) return [];
  const typ = log.topics[0]?.toLowerCase();
  const shared = {
    transaction_hash: log.transactionHash,
    block_number: parseInt(log.blockNumber, 16),
    recipient: '0x' + log.topics[3].slice(-40).toLowerCase()
  };
  if (typ === SINGLE) {
    return [{ ...shared, token_id: decodeWord(log.data, 0).toString(),
              quantity: decodeWord(log.data, 32).toString() }];
  }
  if (typ === BATCH) {
    const ids = arrayOfUint(log.data, Number(decodeWord(log.data, 0)));
    const counts = arrayOfUint(log.data, Number(decodeWord(log.data, 32)));
    if (ids.length !== counts.length) throw new Error('ERC1155 batch arrays differ in size');
    return ids.map((id, i) => ({ ...shared, token_id: id, quantity: counts[i] }));
  }
  return [];
}
function encodeInterface(id) {
  if (!/^0x[0-9a-f]{8}$/i.test(id)) throw new Error('Invalid interface ID');
  return '0x01ffc9a7' + id.slice(2).toLowerCase().padEnd(64, '0');
}
function selfTest() {
  assert.equal(encodeUint(22).length, 64);
  assert.equal(expand1155Uri('ipfs://x/{id}.json', 19),
               'ipfs://x/' + encodeUint(19) + '.json');
  const text = 'ipfs://test/metadata.json';
  const payload = '0x' + encodeUint(32) + encodeUint(Buffer.byteLength(text)) +
                  Buffer.from(text).toString('hex').padEnd(64, '0');
  assert.equal(decodeAbiString(payload), text);
  const fake = { topics: [SINGLE, ZERO_TOPIC, ZERO_TOPIC, '0x' + '0'.repeat(24) + 'a'.repeat(40)],
                 data: '0x' + encodeUint(4) + encodeUint(2),
                 transactionHash: '0x' + '1'.repeat(64), blockNumber: '0x10' };
  const event = parseMintLog(fake);
  assert.equal(event.length, 1);
  assert.equal(event[0].token_id, '4');
  assert.equal(event[0].quantity, '2');
  assert.equal(parseMintLog({ ...fake, topics: [SINGLE, ZERO_TOPIC, '0x' + '1'.repeat(64), fake.topics[3]] }).length, 0);
  const fakeBatch = { ...fake, topics: [BATCH, ZERO_TOPIC, ZERO_TOPIC, fake.topics[3]],
      data: '0x' + encodeUint(64) + encodeUint(160) + encodeUint(2) +
            encodeUint(3) + encodeUint(4) + encodeUint(2) + encodeUint(7) + encodeUint(8) };
  const two = parseMintLog(fakeBatch);
  assert.deepEqual(two.map(x => x.token_id), ['3', '4']);
  assert.deepEqual(two.map(x => x.quantity), ['7', '8']);
  assert.equal(encodeInterface('0xd9b67a26').length, 74);
  console.log('SELF-TEST OK — ABI string, ERC1155 URI, TransferSingle/TransferBatch, interface encoding');
}

function timeoutFetch(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(25000) });
}
async function rpc(method, params, url) {
  const res = await timeoutFetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  if (!res.ok) throw new Error('RPC ' + method + ': HTTP ' + res.status);
  const body = await res.json();
  if (body.error) throw new Error('RPC ' + method + ': ' + JSON.stringify(body.error));
  if (body.result === undefined) throw new Error('RPC returned no result for ' + method);
  return body.result;
}
async function callRead(url, data) {
  return rpc('eth_call', [{ to: CONTRACT, data }, 'latest'], url);
}
async function tryInterface(url, interfaceId) {
  try {
    const raw = await callRead(url, encodeInterface(interfaceId));
    return { value: BigInt(raw) === 1n, error: null };
  } catch (e) {
    return { value: null, error: String(e.message) };
  }
}
async function tryUri(url, id) {
  try {
    const raw = await callRead(url, '0x0e89341c' + encodeUint(id));
    const uri = decodeAbiString(raw);
    return { token_id: String(id), raw_uri: uri,
             resolved_uri: expand1155Uri(uri, id), error: null,
             note: 'uri(id) does NOT prove token existence under ERC-1155' };
  } catch (e) {
    return { token_id: String(id), raw_uri: null, resolved_uri: null, error: String(e.message) };
  }
}
async function tryTotalSupply(url, id) {
  try {
    // Solidity selector for totalSupply(uint256), present in the verified implementation ABI.
    const raw = await callRead(url, '0xbd85b039' + encodeUint(id));
    if (!/^0x[0-9a-fA-F]{64}$/.test(raw)) throw new Error('Unexpected totalSupply return data');
    return { token_id: String(id), current_supply: BigInt(raw).toString(), error: null };
  } catch (e) {
    return { token_id: String(id), current_supply: null, error: String(e.message) };
  }
}

function normalizeAbi(payload) {
  const candidate = payload?.abi ?? payload?.result ?? payload;
  const parsed = typeof candidate === 'string' ? JSON.parse(candidate) : candidate;
  if (!Array.isArray(parsed) || !parsed.some(x => x?.type === 'function')) {
    throw new Error('No usable function ABI');
  }
  return parsed;
}
async function loadAbi(abiPath, lookupAddress = CONTRACT) {
  if (abiPath) {
    return { source: 'user_supplied_abi', verified: null,
             abi: normalizeAbi(JSON.parse(await readFile(resolve(abiPath), 'utf8'))) };
  }
  try {
    const res = await timeoutFetch('https://polygon.blockscout.com/api/v2/smart-contracts/' + lookupAddress,
      { headers: { accept: 'application/json' } });
    if (res.ok) {
      const value = await res.json();
      return { source: 'polygon_blockscout_api', verified: value.is_verified === true,
               proxy: value.is_proxy ?? null, implementations: value.implementations ?? null,
               abi: normalizeAbi(value) };
    }
  } catch { /* fall through */ }
  // Sourcify API v2 (v1 was switched off in July 2026). One verified contract lookup.
  try {
    const lookup = 'https://sourcify.dev/server/v2/contract/137/' + lookupAddress + '?fields=abi';
    const res = await timeoutFetch(lookup, { headers: { accept: 'application/json' } });
    if (res.ok) {
      const value = await res.json();
      if (value.match && value.abi) {
        return { source: 'sourcify_v2_polygon', verified: true, verification_match: value.match,
                 abi: normalizeAbi(value) };
      }
    }
  } catch { /* fall through */ }
  if (process.env.ETHERSCAN_API_KEY) {
    try {
      const u = new URL('https://api.etherscan.io/v2/api');
      for (const [k, v] of Object.entries({
        chainid: '137', module: 'contract', action: 'getabi',
        address: lookupAddress, apikey: process.env.ETHERSCAN_API_KEY
      })) u.searchParams.set(k, v);
      const res = await timeoutFetch(u);
      if (res.ok) {
        const j = await res.json();
        if (j.status === '1') return { source: 'etherscan_v2_polygon', verified: true,
                                     abi: normalizeAbi(j.result) };
      }
    } catch { /* unavailable */ }
  }
  return { source: 'unavailable', verified: null, abi: null,
           note: 'Obtain verified ABI from explorer, or pass --abi path. Mint function/roles unverified.' };
}
async function tryOwner(url) {
  try {
    const raw = await callRead(url, '0x8da5cb5b'); // Ownable.owner() if implemented
    if (!/^0x[0-9a-fA-F]{64}$/.test(raw)) throw new Error('Unexpected owner() return data');
    const addr = '0x' + raw.slice(-40).toLowerCase();
    if (addr === '0x' + '0'.repeat(40)) throw new Error('Zero address owner()');
    return { value: addr, error: null,
      warning: 'owner() response alone does not prove permission to mint new token IDs' };
  } catch (e) {
    return { value: null, error: String(e.message) };
  }
}
function detectMinimalProxy(code) {
  const match = code.match(/^0x363d3d373d3d3d363d73([0-9a-f]{40})5af43d82803e903d91602b57fd5bf3$/i);
  return match ? { type: 'EIP-1167 standard minimal proxy', implementation: '0x' + match[1].toLowerCase() }
    : { type: 'unknown/not EIP-1167 exact runtime', implementation: null };
}

function abiSummary(abiResult) {
  if (!abiResult.abi) return { ...abiResult, functions: [], candidates: [] };
  const functions = abiResult.abi.filter(x => x.type === 'function')
    .map(x => ({ name: x.name, signature: x.name + '(' + (x.inputs || []).map(p => p.type).join(',') + ')',
                 mutability: x.stateMutability || (x.constant ? 'view' : 'unknown') }));
  return { source: abiResult.source, verified: abiResult.verified,
           proxy: abiResult.proxy ?? null, implementations: abiResult.implementations ?? null,
           functions, candidates: functions.filter(x => /mint|create|issue|role|owner|admin|permission|uri|supply|claim/i.test(x.name)),
           warning: 'A function name or ABI is NOT proof of access, mint safety or compatibility. Check implementation, roles and signer.' };
}
async function mintLogs(url, from, to) {
  if (to < from) throw new Error('to-block precedes from-block');
  if (to - from + 1 > 100000) {
    throw new Error('Limit 100000 blocks/run. Split explicit --from-block / --to-block windows to avoid provider overload.');
  }
  const events = [];
  for (let b = from; b <= to; b += 2000) {
    const end = Math.min(b + 1999, to);
    const logs = await rpc('eth_getLogs', [{
      address: CONTRACT, fromBlock: '0x' + b.toString(16), toBlock: '0x' + end.toString(16),
      topics: [[SINGLE, BATCH], null, ZERO_TOPIC]
    }], url);
    for (const log of logs) events.push(...parseMintLog(log));
  }
  return events;
}

async function main() {
  const opts = argsOf(process.argv.slice(2));
  if (opts.help) {
    console.log('Polygon audit READ ONLY\n  npm run nft:chain:test\n  npm run nft:chain:audit\n  npm run nft:chain:audit -- --from-block N --to-block M --out reports/polygon-audit.json\n  npm run nft:chain:audit -- --abi path/to/verified-abi.json\nEnvironment: POLYGON_RPC_URL (optional), ETHERSCAN_API_KEY (optional, used only to fetch verified ABI).');
    return;
  }
  if (opts.selfTest) return selfTest();
  const snapshot = JSON.parse(await readFile(SNAPSHOT, 'utf8'));
  assert.equal(snapshot.collection.contract_address.toLowerCase(), CONTRACT);
  assert.equal(snapshot.collection.chain, 'polygon');
  assert.equal(snapshot.items.length, 19);
  const ids = [...new Set(snapshot.items.map(x => String(x.token_id)))];
  const url = process.env.POLYGON_RPC_URL || DEFAULT_RPC;
  const chainId = Number(BigInt(await rpc('eth_chainId', [], url)));
  if (chainId !== CHAIN_ID) throw new Error('WRONG CHAIN ' + chainId + '; required Polygon mainnet chain 137');
  const currentBlock = parseInt(await rpc('eth_blockNumber', [], url), 16);
  const code = await rpc('eth_getCode', [CONTRACT, 'latest'], url);
  if (!/^0x[0-9a-f]+$/i.test(code) || code === '0x') {
    throw new Error('Contract bytecode not found at expected address');
  }
  const iface = {
    erc165: await tryInterface(url, '0x01ffc9a7'),
    erc1155: await tryInterface(url, '0xd9b67a26'),
    erc1155_metadata_uri: await tryInterface(url, '0x0e89341c')
  };
  const uris = [];
  for (const id of ids) uris.push(await tryUri(url, id)); // sequential for public RPC rate limits
  const proxyDetection = detectMinimalProxy(code);
  const implementationCode = proxyDetection.implementation
    ? await rpc('eth_getCode', [proxyDetection.implementation, 'latest'], url) : null;
  const implementationBytes = implementationCode && implementationCode !== '0x'
    ? (implementationCode.length - 2) / 2 : null;
  const ownerProbe = await tryOwner(url);
  const abiLookupAddress = proxyDetection.implementation || CONTRACT;
  const abi = abiSummary(await loadAbi(opts.abi, abiLookupAddress));
  abi.lookup_address = abiLookupAddress;
  const hasSupplyMethod = abi.functions.some(f => f.signature === 'totalSupply(uint256)');
  const supplies = [];
  if (hasSupplyMethod) for (const id of [...ids, '20']) supplies.push(await tryTotalSupply(url, id));
  const to = opts.to ?? currentBlock;
  if (to > currentBlock) throw new Error('--to-block beyond current latest block');
  const mintEvents = opts.from === null ? null : await mintLogs(url, opts.from, to);
  const known = new Set(ids);
  const unknownEvents = mintEvents?.filter(e => !known.has(e.token_id)) ?? [];
  const report = {
    generated_at: new Date().toISOString(), read_only: true,
    chain: 'polygon', chain_id: chainId, contract: CONTRACT,
    rpc_provider: 'configured endpoint (URL and secrets deliberately omitted)',
    checked_block: currentBlock, contract_code_size_bytes: (code.length - 2) / 2,
    proxy_detection: proxyDetection, implementation_code_size_bytes: implementationBytes,
    owner_probe: ownerProbe,
    observed_opensea_token_ids: ids, observed_distinct_artwork_ids:
      new Set(snapshot.items.map(x => x.artwork_id)).size,
    interfaces: iface, token_uris: uris, current_supply_by_token_id: supplies, abi,
    minted_transfer_events: mintEvents,
    mint_event_scan: opts.from === null
      ? { complete: false, status: 'not_requested', instruction: 'Provide deployment --from-block and explicit --to-block. Scan all windows to reconstruct full history.' }
      : { complete: false, status: 'partial_explicit_block_window', from_block: opts.from, to_block: to,
          event_count: mintEvents.length, event_token_ids_absent_from_opensea_snapshot: unknownEvents },
    assessment: {
      can_mint_programmatically_in_existing_contract: 'UNVERIFIED',
      creator_mint_permissions: 'UNVERIFIED',
      token_supply: 'UNVERIFIED unless complete mint + burn history or contract totalSupply is audited',
      warning: 'Do not sign a transaction, assume an empty uri means unminted, or auto-mint from this report.'
    }
  };
  const output = JSON.stringify(report, null, 2) + '\n';
  if (opts.out) {
    const path = resolve(opts.out);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, output, 'utf8');
    console.error('Read-only audit report written to ' + path);
  } else {
    process.stdout.write(output);
  }
}
main().catch(err => { console.error('AUDIT FAILED: ' + String(err.message)); process.exitCode = 1; });
