# DeepCat-Gadget

Gadget for MediaWiki installations allowing recursive category search via CatGraph using the corresponding JSONP interface.
https://github.com/wmde/catgraph-jsonp

[![Build Status](https://travis-ci.org/wmde/DeepCat-Gadget.svg?branch=master)](https://travis-ci.org/wmde/DeepCat-Gadget)

### Prerequisites

MediaWiki installation with CirrusSearch

### Installation

Save contents of DeepCat.js and DeepCat.css to your namespace
- e.g. User:USERNAME/Gadgets/DeepCat.js & User:USERNAME/Gadgets/DeepCat.css

Add scripts to your User:USERNAME/common.js
```
importScript( 'User:USERNAME/Gadgets/DeepCat.js' );
importStylesheet(  'User:USERNAME/Gadgets/DeepCat.css' );
```

### Testing

The current official release of the gadget can be found on wikipedia.org 
```
$.when( mw.loader.using( [ 'mediawiki.api.messages', 'mediawiki.jqueryMsg' ] ), $.ready ).done( function() {
    mw.loader.load( "//de.wikipedia.org/w/index.php?title=User:Christoph Fischer (WMDE)/Gadgets/DeepCat.js&action=raw&ctype=text/javascript" );
    mw.loader.load( "//de.wikipedia.org/w/index.php?title=User:Christoph Fischer (WMDE)/Gadgets/DeepCat.css&action=raw&ctype=text/css" , "text/css" );
} );
```

### Usage

The default keyword to use the DeepCat-Search is "deepcat:" and can be combined with a term in Cirrus-Syntax

- 'deepcat:[category]'
- 'deepcat:Kunstgeschichte' 
- 'deepcat:Kunstgeschichte deepCat:Maler'
- 'deepcat:Kunstgeschichte Monet'
- '-Monet deepcat:Kunstgeschichte'
- 'intitle:System deepcat:Physik'
- 'deepcat:Physik -intitle:System'
- 'deepcat:Physik prefix:Sys'
- 'deepcat:"Geschichte der Physik" Newton'
- 'deepcat:Physik "Homogenes System"'
- 'deepcat:"Geschichte der Physik" -deepcat:Kunstgeschichte'

### Unit Tests

There are some unit tests under `tests` directory. Tests may be run be by opening `tests/index.html` in a browser or from the command line e.g. using [node-qunit-phantomjs](https://github.com/jonkemp/node-qunit-phantomjs):
```bash
$ node-qunit-phantomjs ./tests/index.html
```

### Reporting Issues

Please report bugs and feature requests on [Phabricator](https://phabricator.wikimedia.org/maniphest/task/create/?projects=tcb-team,deepcat-gadget&title=%5BDeepCat-Gadget%5D).
