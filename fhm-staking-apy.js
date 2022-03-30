const http = require('http');
const hostname = 'localhost';
const port = 3006;

const url = require('url');
const fetch = require('node-fetch');
const Web3 = require('web3');


const provider_ftm = 'https://rpc.ftm.tools';
const provider_movr = 'https://rpc.api.moonriver.moonbeam.network';

const sfhm_ftm = '0x5E983ff70DE345de15DbDCf0529640F14446cDfa';
const sfhm_movr = '';
const distributor_ftm = '0xCD12666f754aCefa1ee5477fA809911bAB915aa0';

const epochLength_ftm = 28800;

const ensure_apy = 70000;

//
// data inputs
//

async function circulatingSupply(provider, ca) {
    var web3 = new Web3(new Web3.providers.HttpProvider(provider));
    let minABI = [
        {
            "inputs": [],
            "name": "circulatingSupply",
            "outputs": [
                {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        }
    ];
    let contract = new web3.eth.Contract(minABI, ca);
    return Number(await contract.methods.circulatingSupply().call()) / Math.pow(10, 9);
}

async function rate(provider, ca) {
    var web3 = new Web3(new Web3.providers.HttpProvider(provider));
    let minABI = [
        {
            "inputs": [
                {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                }
            ],
            "name": "info",
            "outputs": [
                {
                    "internalType": "uint256",
                    "name": "rate",
                    "type": "uint256"
                },
                {
                    "internalType": "address",
                    "name": "recipient",
                    "type": "address"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        }
    ];
    let contract = new web3.eth.Contract(minABI, ca);
    const e = await contract.methods.info(0).call();
    return Number(e[0]);
}

async function nextRewardAt(provider, ca, rate) {
    var web3 = new Web3(new Web3.providers.HttpProvider(provider));
    let minABI = [
        {
            "inputs": [
                {
                    "internalType": "uint256",
                    "name": "_rate",
                    "type": "uint256"
                }
            ],
            "name": "nextRewardAt",
            "outputs": [
                {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        }
    ];
    let contract = new web3.eth.Contract(minABI, ca);
    return Number(await contract.methods.nextRewardAt(rate).call()) / Math.pow(10, 9);
}

//

async function blockTime(fantom) {
    const response = await fetch("https://"+ (fantom? "ftmscan.com" : "moonriver.moonscan.io") +  "/chart/blocktime?output=csv");
    const text = await response.text();
    const array = text.trim().split("\r\n");

    const last = array[array.length - 1];

    const items = last.split(",");
    return Number(items[items.length - 1].replaceAll('\"',''));
}

//
// handlers
//

async function ftm() {
    const cs = await circulatingSupply(provider_ftm, sfhm_ftm);
    const r = await rate(provider_ftm, distributor_ftm);
    const reward = await nextRewardAt(provider_ftm, distributor_ftm, r);
    const bt = await blockTime(true);

    const rebasesPerDay = (24 * 60 * 60) / (bt * epochLength_ftm);

    // 100 *(1+ 3020/500569)^(365*3.4602076124567476)
    const apy = Math.floor(100 * Math.pow(1 + reward / cs, 365 * rebasesPerDay));
    if (apy < ensure_apy) {
        console.log(`need to increase apy: ${apy}% to ${ensure_apy}%`);
    } else {
        console.log(`need to decrease apy: ${apy}% to ${ensure_apy}%`);
    }
}

async function main() {
   await ftm();
}

main();