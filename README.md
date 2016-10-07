# DeepCat-Gadget

Gadget for MediaWiki installations allowing recursive category search via CatGraph using the corresponding [JSONP interface](https://github.com/wmde/catgraph-jsonp).

[![Build Status](https://travis-ci.org/wmde/DeepCat-Gadget.svg?branch=master)](https://travis-ci.org/wmde/DeepCat-Gadget)

### Prerequisites

This MediaWiki Gadget only works for wikis covered by [Catgraph](https://wikitech.wikimedia.org/wiki/Nova_Resource:Catgraph).

### Full customized installation

To have your own private version of the gadget follow these steps:

Save the contents of `DeepCat.js`, `DeepCat.hintbox.css` and `DeepCat.throbber.css` to your namespace. e.g.:
- `User:USERNAME/Gadgets/DeepCat.js`
- `User:USERNAME/Gadgets/DeepCat.hintbox.css` 
- `User:USERNAME/Gadgets/DeepCat.throbber.css`

Edit the `cssPath` variable in `DeepCat.js` to the full path where the files can be found e.g.:
```
cssPath = '//de.wikipedia.org/w/index.php?title=User:USERNAME/Gadgets/',
```

Add the main script to your `User:USERNAME/common.js` e.g.:
```
importScript( 'User:USERNAME/Gadgets/DeepCat.js' );
```

### Official version on Wikipedia

The current official release of the gadget can be found on de.wikipedia.org and can be used by adding the following line to your `User:USERNAME/common.js`: 
```
mw.loader.load( "//de.wikipedia.org/w/index.php?title=MediaWiki:Gadget-DeepCat.js&action=raw&ctype=text/javascript" );
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
