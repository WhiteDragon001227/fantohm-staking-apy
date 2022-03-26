const http = require('http');
const hostname = 'localhost';
const port = 3004;

const url = require('url');
const fetch = require('node-fetch');
const Web3 = require('web3');

const provider_ftm = 'https://rpc.ftm.tools';
const provider_movr = 'https://rpc.api.moonriver.moonbeam.network';

//
// data inputs
//

async function totalSupply(provider, ca) {
    var web3 = new Web3(new Web3.providers.HttpProvider(provider));
    let minABI = [
        {
            "inputs": [],
            "name": "totalSupply",
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
    return Number(await contract.methods.totalSupply().call());
}

async function balanceOf(provider, ca, address) {
    var web3 = new Web3(new Web3.providers.HttpProvider(provider));
    let minABI = [
        {
            "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
            "name": "balanceOf",
            "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
            "stateMutability": "view",
            "type": "function"
        }
    ];
    let contract = new web3.eth.Contract(minABI, ca);
    return Number(await contract.methods.balanceOf(address).call());
}

async function OHMCirculatingSupply(provider, ca) {
	const web3 = new Web3(new Web3.providers.HttpProvider(provider));
	let minABI = [
		{
			"inputs": [],
			"name": "OHMCirculatingSupply",
			"outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
			"stateMutability": "view",
			"type": "function"
		}
	];
	let contract = new web3.eth.Contract(minABI, ca);
	return Number(await contract.methods.OHMCirculatingSupply().call());
}

async function fetchFhmCircularSupply(res) {
    const ftmSupply = await getFtmSupply();
    const moonSupply = await getMoonSupply();
    const totalCircularSupply = (ftmSupply + moonSupply) / 10 ** 9

    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('' + totalCircularSupply);
}

async function getFtmSupply(res) {
	try {
		return await OHMCirculatingSupply(provider_ftm, '0x59EC309001Ec92879790dbdd94d9180B8bCAe908');
	} catch (e) {
		fail(e, res);
	}
}

async function getMoonSupply() {
	try {
		return await OHMCirculatingSupply(provider_movr, '0x9DC084Fd82860cDb4ED2b2BF59F1076F47B03Bd6');
	} catch (e) {
		fail(e, res);
	}
}

function isCacheValid(entry) {
    if (!entry || !entry.valid) return false;
    else if (new Date().getTime() <= entry.valid) return true;
    return false;
}

function json(json, res) {
    res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*'});
    res.end(JSON.stringify(json));
}

function data(msg, res) {
    res.writeHead(200, {'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*'});
    res.end('' + msg);
}

function fail(msg, res) {
    res.writeHead(500, {'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*'});
    res.end('' + msg);
}

//
// handlers
//

function handleDogira(queryObject, res) {
    if (queryObject.action === "circularSupply") {
        data(Number(1000000000), res);
    } else if (queryObject.action === "marketCap") {
        fetch('https://api.coingecko.com/api/v3/simple/price?ids=dogira&vs_currencies=usd')
            .then(d => d.json())
            .then(d => {
                let elem = d["dogira"];
                if (!elem) {
                    fail("Not found price from cg!", res);
                    return;
                }

                elem = elem["usd"];
                if (!elem) {
                    fail("Not found price from cg!", res);
                    return;
                }

                const mc = Number(elem) * Number(1000000000);
                data(mc, res);
            });
    } else {
        fail("Unknown action, use action=marketCap or action=circularSupply", res);
    }
}

//
//
//

async function fetchUsdbCircularSupply(res) {
    const ftmCa = "0x6Fc9383486c163fA48becdEC79d6058f984f62cA";
	let supply = await totalSupply(provider_ftm, ftmCa);
	let treasuryBalance = await balanceOf(provider_ftm, ftmCa, "0xA3b52d5A6d2f8932a5cD921e09DA840092349D71");
	let daoBalance = await balanceOf(provider_ftm, ftmCa, "0x34F93b12cA2e13C6E64f45cFA36EABADD0bA30fC");
	let totalCirculatingSupply = (supply - treasuryBalance - daoBalance) / 10**18;

	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.end('' + totalCirculatingSupply);
}

function handleFantohm(queryObject, res) {
    if (queryObject.action === "circularSupply") {
        fetchFhmCircularSupply(res);
    }
}

function handleUsdBalance(queryObject, res) {
    if (queryObject.action === "circularSupply") {
        fetchUsdbCircularSupply(res);
    }
}

const validCacheTime = 60 * 1000;
const coingeckoTokenPriceCache = new Map();

function handleCoingeckoTokenPrice(queryObject, res) {
    const chain = queryObject.chain;
    const ca = queryObject.ca;
    if (!chain || !ca) return fail("Unknown chain or ca", res);

    const cacheKey = chain + "_" + ca;
    const cacheEntry = coingeckoTokenPriceCache.get(cacheKey);
    if (isCacheValid(cacheEntry)) return json(cacheEntry.data, res);

    fetch(`https://api.coingecko.com/api/v3/simple/token_price/${chain}?contract_addresses=${ca}&vs_currencies=usd`)
        .then(d => d.json())
        .then(d => {
            const _valid = new Date().getTime() + validCacheTime;
            d["valid"] = _valid;

            // put to cache
            coingeckoTokenPriceCache.set(cacheKey, {
                valid: _valid,
                data: d,
            });

            // serve
            json(d, res);
        })
        .catch(e => fail(e, res));
}

const coingeckoPriceCache = new Map();

function handleCoingeckoPrice(queryObject, res) {
    const id = queryObject.id;
    if (!id) return fail("Unknown id", res);

    const cacheKey = id;
    const cacheEntry = coingeckoPriceCache.get(cacheKey);
    if (isCacheValid(cacheEntry)) return json(cacheEntry.data, res);

    fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`)
        .then(d => d.json())
        .then(d => {
            const _valid = new Date().getTime() + validCacheTime;
            d["valid"] = _valid;

            // put to cache
            coingeckoPriceCache.set(cacheKey, {
                valid: _valid,
                data: d,
            });

            // serve
            json(d, res);
        })
        .catch(e => fail(e, res))
}

const server = http.createServer(function (req, res) {
    try {
        // parse query
        const queryObject = url.parse(req.url, true).query;

        // handle query for token
        if (queryObject.token) {
            if (queryObject.token === "dogira-matic" || queryObject.token === "dogira-eth") {
                return handleDogira(queryObject, res);
            } else if (queryObject.token === "fantohm") {
                return handleFantohm(queryObject, res);
            } else if (queryObject.token === "usdbalance") {
                return handleUsdBalance(queryObject, res);
            } else {
                return fail("Unknown token", res);
            }
        }

        // nothing about particular token API, just for the prices
        else if (queryObject.action) {
            if (queryObject.action === "coingeckoTokenPrice") {
                return handleCoingeckoTokenPrice(queryObject, res);
            } else if (queryObject.action === "coingeckoPrice") {
                return handleCoingeckoPrice(queryObject, res);
            }
        }
        // fail
        else {
            return fail("Unknown action", res);
        }
    } catch (e) {
        console.log("unable to handle request", e);
    }
});

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});
