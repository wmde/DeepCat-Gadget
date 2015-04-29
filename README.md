# DeepCat-Gadget

Gadget for MediaWiki installations allowing recursive category search via CatGraph using the corresponding JSONP interface.
https://github.com/wmde/catgraph-jsonp

### Prerequisites

MediaWiki installation with CirrusSearch and patch:
https://gerrit.wikimedia.org/r/#/c/191622/

### Testing

Can be currently done here (Test Wiki with limited content and categories): 
 - http://gptest1.wmflabs.org/

The Gadget is now per default activated in the MediaWiki:Common.js
 - http://gptest1.wmflabs.org/wiki/MediaWiki:Gadgets/DeepCat.js 

The default keyword to use the DeepCat-Search is "deepCat: [categoryname] [searchword]"
 - deepCat: Kunstgeschichte Monet
 - deepCat: "Geschichte der Physik" Newton