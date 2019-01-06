# PyDcrData

PyDcrData is a dcrdata API client written in Python 3. 
To use, download `pydcrdata.py` to your script directory or somewhere in PYTHONPATH.

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

Be aware that depending on the version of dcrdata they are running, different servers might have different sets of endpoints.

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

# /tx/{txid}/in/{txinoutindex} - Get the first input to a transaction
txinoutindex = 0
dumpResponse( tx.in.get(txid, txinoutindex) )

# arguments can also be passed as keyword argument, in which case the 
# order doesn't matter, but don't mix positional and keyword.
thatOneBlock = "00000000000000000fe92d4a057bd4425c5f58fa9b4d5b34b6f2b596ff01b3c9"
dumpResponse( client.block.hash.get(blockhash=thatOneBlock) )
```