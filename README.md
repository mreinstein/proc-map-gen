# proc-map-gen

procedural map generation based on cellular automata

![alt text](example.png "example connected cave")


Usage:

```javascript
import * as CaveGenerator from './index.js'


const c = CaveGenerator.init()
CaveGenerator.build(c)
CaveGenerator.connectCaves(c)
```

To see an interactive demo of this running, open `index.html`.


## debugging

Open chrome://inspect in the browser

Then:
```sh
node --inspect index.js
```


## references
This is a port of https://github.com/AndyStobirski/RogueLike/blob/master/csCaveGenerator.cs

The original blog that talks about this is gone but you can still see an archived copy at https://web.archive.org/web/20211024235813/http://www.evilscience.co.uk/a-c-algorithm-to-build-roguelike-cave-systems-part-1/

Eventually I'd like to apply some of the changes Kyzrati talks about in https://www.gridsagegames.com/blog/2014/06/mapgen-cellular-automata/ namely the "guided generation" and "U shape cave removal"
