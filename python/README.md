# PyDcrData

PyDcrData is a dcrdata API client written in Python 3. 
To use, put `pydcrdata.py` in your script directory or somewhere in PYTHONPATH.

The constructor takes a single argument, which is the path to a dcrdata server, including 
protocol, e.g. `https://explorer.dcrdata.org`. The available endpoints are gathered from 
the server when the client is created. 

```
from pydcrdata import DcrDataClient
import json

client = DcrDataClient("https://explorer.dcrdata.org")
bestBlock = client.block.best.get()
print(json.dumps(bestBlock, indent=4, sort_keys=True))
``` 

You can print an endpoint guide to the console with  `client.endpointGuide()`,

or a Python list of URLs is returned from `client.endpointList()`.

Depending on the version of dcrdata they are running, different servers might have different sets of endpoints.

### Examples

```
def dumpResponse(obj):
	print(json.dumps(obj, indent=4, sort_keys=True))

blockhash = "00000000000000000fe92d4a057bd4425c5f58fa9b4d5b34b6f2b596ff01b3c9"
txid = "355a6752539486503031d1a0bb62a3c53f83a4cad0765979510742b72b064f75"

# /block/hash/{blockhash} - Get data for a block with it's hash.
dumpResponse( client.block.hash.get(blockhash) )

# /block/hash/{blockhash}/verbose - Same thing, but more info.
dumpResponse( client.block.hash.verbose.get(blockhash) )

# /block/range/{idx0}/{idx}/{step}/size - Get the size of every 10th block from 299900 to 300000.
idx0 = 299900
idx = 300000
step = 10
dumpResponse( client.block.range.size.get(idx0, idx, step) )

# /tx/{txid}/in/{txinoutindex} - Get a single input to a transaction
txinoutindex = 0
dumpResponse( tx.in.get(txid, txinoutindex) )

# arguments can also be passed as keyword argument, in which case the 
# order doesn't matter, but don't mix positional and keyword.
thatOneBlock = "00000000000000000fe92d4a057bd4425c5f58fa9b4d5b34b6f2b596ff01b3c9"
dumpResponse( client.block.hash.get(blockhash=thatOneBlock) )
```
### Example endpoint guide
```
address.amountflow.get(address, chartgrouping)  ->  /address/{address}/amountflow/{chartgrouping}
address.count.get(address, N)  ->  /address/{address}/count/{N}
address.count.raw.get(address, N)  ->  /address/{address}/count/{N}/raw
address.count.skip.get(address, N, M)  ->  /address/{address}/count/{N}/skip/{M}
address.count.skip.raw.get(address, N, M)  ->  /address/{address}/count/{N}/skip/{M}/raw
address.raw.get(address)  ->  /address/{address}/raw
address.totals.get(address)  ->  /address/{address}/totals
address.types.get(address, chartgrouping)  ->  /address/{address}/types/{chartgrouping}
address.unspent.get(address, chartgrouping)  ->  /address/{address}/unspent/{chartgrouping}
block.best.get()  ->  /block/best
block.best.hash.get()  ->  /block/best/hash
block.best.header.get()  ->  /block/best/header
block.best.height.get()  ->  /block/best/height
block.best.pos.get()  ->  /block/best/pos
block.best.size.get()  ->  /block/best/size
block.best.subsidy.get()  ->  /block/best/subsidy
block.best.tx.get()  ->  /block/best/tx
block.best.tx.count.get()  ->  /block/best/tx/count
block.best.verbose.get()  ->  /block/best/verbose
block.hash.get(blockhash)  ->  /block/hash/{blockhash}
block.hash.header.get(blockhash)  ->  /block/hash/{blockhash}/header
block.hash.height.get(blockhash)  ->  /block/hash/{blockhash}/height
block.hash.pos.get(blockhash)  ->  /block/hash/{blockhash}/pos
block.hash.size.get(blockhash)  ->  /block/hash/{blockhash}/size
block.hash.subsidy.get(blockhash)  ->  /block/hash/{blockhash}/subsidy
block.hash.tx.get(blockhash)  ->  /block/hash/{blockhash}/tx
block.hash.tx.count.get(blockhash)  ->  /block/hash/{blockhash}/tx/count
block.hash.verbose.get(blockhash)  ->  /block/hash/{blockhash}/verbose
block.range.get(idx0, idx)  ->  /block/range/{idx0}/{idx}
block.range.size.get(idx0, idx)  ->  /block/range/{idx0}/{idx}/size
block.range.get(idx0, idx, step)  ->  /block/range/{idx0}/{idx}/{step}
block.range.size.get(idx0, idx, step)  ->  /block/range/{idx0}/{idx}/{step}/size
block.hash.get(idx)  ->  /block/{idx}/hash
block.header.get(idx)  ->  /block/{idx}/header
block.pos.get(idx)  ->  /block/{idx}/pos
block.size.get(idx)  ->  /block/{idx}/size
block.subsidy.get(idx)  ->  /block/{idx}/subsidy
block.tx.get(idx)  ->  /block/{idx}/tx
block.tx.count.get(idx)  ->  /block/{idx}/tx/count
block.verbose.get(idx)  ->  /block/{idx}/verbose
mempool.sstx.get()  ->  /mempool/sstx
mempool.sstx.details.get()  ->  /mempool/sstx/details
mempool.sstx.details.get(N)  ->  /mempool/sstx/details/{N}
mempool.sstx.fees.get()  ->  /mempool/sstx/fees
mempool.sstx.fees.get(N)  ->  /mempool/sstx/fees/{N}
stake.diff.get()  ->  /stake/diff
stake.diff.b.get(idx)  ->  /stake/diff/b/{idx}
stake.diff.current.get()  ->  /stake/diff/current
stake.diff.estimates.get()  ->  /stake/diff/estimates
stake.diff.r.get(idx0, idx)  ->  /stake/diff/r/{idx0}/{idx}
stake.pool.get()  ->  /stake/pool
stake.pool.b.get(idx)  ->  /stake/pool/b/{idx}
stake.pool.b.full.get(idxorhash)  ->  /stake/pool/b/{idxorhash}/full
stake.pool.full.get()  ->  /stake/pool/full
stake.pool.r.get(idx0, idx)  ->  /stake/pool/r/{idx0}/{idx}
stake.vote.get()  ->  /stake/vote
stake.vote.info.get()  ->  /stake/vote/info
ticketpool.bydate.get(tp)  ->  /ticketpool/bydate/{tp}
ticketpool.charts.get()  ->  /ticketpool/charts
tx.decoded.get(txid)  ->  /tx/decoded/{txid}
tx.hex.get(txid)  ->  /tx/hex/{txid}
tx.in.get(txid)  ->  /tx/{txid}/in
tx.in.get(txid, txinoutindex)  ->  /tx/{txid}/in/{txinoutindex}
tx.out.get(txid)  ->  /tx/{txid}/out
tx.out.get(txid, txinoutindex)  ->  /tx/{txid}/out/{txinoutindex}
tx.trimmed.get(txid)  ->  /tx/{txid}/trimmed
tx.vinfo.get(txid)  ->  /tx/{txid}/vinfo
txs.trimmed.get()  ->  /txs/trimmed
```