/**
 * @licence GNU GPL v2+
 * @author Leszek Manicki <leszek.manicki@wikimedia.de>
 * @author Gabriel Birke <gabriel.birke@wikimedia.de>
 */
( function( deepCat, $, QUnit ) {
	QUnit.test( 'load DeepCat', function( assert ) {
		assert.ok( deepCat !== null, 'DeepCat is not null' );
	} );

	QUnit.test( 'getSearchTerms', function( assert ) {
		assert.deepEqual(
			deepCat.getSearchTerms( 'Foo' ),
			[ 'Foo' ],
			'getSearchTerms: a word not preceded by a keyword is a search term'
		);
		assert.deepEqual(
			deepCat.getSearchTerms( 'Foo Bar' ),
			[ 'Foo', 'Bar' ],
			'getSearchTerms: each word not preceded by a keyword is a single search term'
		);
		assert.deepEqual(
			deepCat.getSearchTerms( 'deepcat:Foo' ),
			[ 'deepcat:Foo' ],
			'getSearchTerms: a word preceded by a keyword is a search term'
		);
		assert.deepEqual(
			deepCat.getSearchTerms( 'deepcat: Foo' ),
			[ 'deepcat: Foo' ],
			'getSearchTerms: spaces following the keyword do not stop matching the search term'
		);
		assert.deepEqual(
			deepCat.getSearchTerms( 'deepcat:Foo Bar' ),
			[ 'deepcat:Foo', 'Bar' ],
			'getSearchTerms: only a single word preceded by a keyword is a search term'
		);
		assert.deepEqual(
			deepCat.getSearchTerms( 'Foo deepcat:Bar' ),
			[ 'Foo', 'deepcat:Bar' ],
			'getSearchTerms: only a single word preceded by a keyword is a search term'
		);
		assert.deepEqual(
			deepCat.getSearchTerms( 'deepcat:Foo deepcat: Bar' ),
			[ 'deepcat:Foo', 'deepcat: Bar' ],
			'getSearchTerms: each DeepCat search term must be preceded by a keyword'
		);
		assert.deepEqual(
			deepCat.getSearchTerms( 'deepcat: Foo Bar deepcat:Baz' ),
			[ 'deepcat: Foo', 'Bar', 'deepcat:Baz' ],
			'getSearchTerms: only a single word preceded by a keyword is a search term'
		);
		assert.deepEqual(
			deepCat.getSearchTerms( 'deepcat:"Foo Bar"' ),
			[ 'deepcat:"Foo Bar"' ],
			'getSearchTerms: multiple words in quotes are considered a single DeepCat search term'
		);
		assert.deepEqual(
			deepCat.getSearchTerms( 'deepcat:"Foo Bar" Baz' ),
			[ 'deepcat:"Foo Bar"', 'Baz' ],
			'getSearchTerms: only multiple words in quotes are considered a single multi-word DeepCat search term'
		);
		assert.deepEqual(
			deepCat.getSearchTerms( 'deepcat:"Foo Bar"Baz' ),
			[ 'deepcat:"Foo Bar"', 'Baz' ],
			'getSearchTerms: multiple words in quotes are considered a single DeepCat search term'
		);
		assert.deepEqual(
			deepCat.getSearchTerms( 'deepcat:' ),
			[ 'deepcat:' ],
			'getSearchTerms: empty DeepCat search terms are recognized'
		);
		assert.deepEqual(
			deepCat.getSearchTerms( 'deepcat: deepcat:' ),
			[ 'deepcat:', 'deepcat:' ],
			'getSearchTerms: repeating empty DeepCat search terms are recognized'
		);
		assert.deepEqual(
			deepCat.getSearchTerms( 'deepcat: "deepcat:"' ),
			[ 'deepcat: "deepcat:"' ],
			'getSearchTerms: match keyword as parameter when surrounded by colons'
		);
		assert.deepEqual(
			deepCat.getSearchTerms( 'Foo: Bar' ),
			[ 'Foo:', 'Bar' ],
			'getSearchTerms: not every word followed by colon is considered a keyword'
		);
		assert.deepEqual(
			deepCat.getSearchTerms( 'deepcat:a:b' ),
			[ 'deepcat:a:b' ],
			'getSearchTerms: DeepCat search terms may include colon'
		);
		assert.deepEqual(
			deepCat.getSearchTerms( 'deepcat:"a b' ),
			[ 'deepcat:"a', 'b' ],
			'getSearchTerms: Unmatched quote does not introduce multi-word DeepCat search term'
		);
		assert.deepEqual(
			deepCat.getSearchTerms( 'deepcat:a"b' ),
			[ 'deepcat:a"b' ],
			'getSearchTerms: Unmatched quote does not introduce multi-word search term'
		);
		assert.deepEqual(
			deepCat.getSearchTerms( 'deepcat:a" b' ),
			[ 'deepcat:a"', 'b' ],
			'getSearchTerms: Unmatched quote does not introduce multi-word search term'
		);
		assert.deepEqual(
			deepCat.getSearchTerms( 'deepcat:Kunst (Berlin OR Hamburg)' ),
			[ 'deepcat:Kunst', '(Berlin', 'OR', 'Hamburg)' ],
			'getSearchTerms: Match complexer terms with brackets'
		);
		assert.deepEqual(
			deepCat.getSearchTerms( 'deepcat:Physik intitle: System' ),
			[ 'deepcat:Physik', 'intitle:', 'System' ],
			'getSearchTerms: Match terms when used with other keywords'
		);
		assert.deepEqual(
			deepCat.getSearchTerms( '-deepcat:Kunst' ),
			[ '-deepcat:Kunst' ],
			'getSearchTerms: Match keyword with minus'
		);
	} );

	QUnit.test( 'computeResponses', function( assert ) {
		var responseForTerm0 = {
				result: [[1],[2],[3]],
				userparam: '{"negativeSearch":false,"searchTermNum":0}'
			},
			responseForTerm2 = {
				result: [[4],[5]],
				userparam: '{"negativeSearch":false,"searchTermNum":2}'
			},
			responseWithNegativeSearch = {
				result: [[6],[7]],
				userparam: '{"negativeSearch":true,"searchTermNum":0}'
			};
		assert.deepEqual(
			deepCat.computeResponses( [], []),
			[],
			'computeResponses: Empty response returns empty search terms'
		);
		assert.deepEqual(
			deepCat.computeResponses( [responseForTerm0], ['deepcat:a', 'b']),
			[ 'incategory:id:1|id:2|id:3', 'b' ],
			'computeResponses: deepcat terms are replaced with incategory search terms computed from response'
		);
		assert.deepEqual(
			deepCat.computeResponses( [responseForTerm2, responseForTerm0], ['deepcat:a', 'c', 'deepcat:b']),
			[ 'incategory:id:1|id:2|id:3', 'c', 'incategory:id:4|id:5' ],
			'computeResponses: Multiple responses are placed in the right order, regardless of response order'
		);
		assert.deepEqual(
			deepCat.computeResponses( [responseWithNegativeSearch], ['-deepcat:c', 'b']),
			[ '-incategory:id:6|id:7', 'b' ],
			'computeResponses: NegativeSearch in responses create minus prefix for incategory search terms'
		);
		// TODO test error handling for empty results when pull request https://github.com/wmde/DeepCat-Gadget/pull/39 is done.
	} );

	QUnit.test( 'computeErrors', function( assert ) {
		var oldAddErrorMsgField, lastError, testError,
			searchTerms = ['deepcat:a', 'b'];
		oldAddErrorMsgField = deepCat.addErrorMsgField;
		// mock function to check for side effects of computeErrors
		deepCat.addErrorMsgField = function (errors) {
			lastError = errors;
		};
		testError = [{statusMessage:'Graph not found', userparam: '{"searchTermNum":0}'}];
		assert.deepEqual(
			deepCat.computeErrors(testError, searchTerms),
			['', 'b'],
			'computeErrors: Clear search term if wiki is not supported.'
		);
		assert.deepEqual(
			lastError,
			[{mwMessage: 'deepcat-error-unknown-graph', parameter: null}],
			'computeErrors: "Graph not found" error creates correct message.'
		);
		testError = [{statusMessage:'RuntimeError: Category \'a\' not found in wiki', userparam: '{"searchTermNum":0}'}];
		assert.deepEqual(
			deepCat.computeErrors(testError, searchTerms),
			['', 'b'],
			'computeErrors: Clear search term if category is not found.'
		);
		assert.deepEqual(
			lastError,
			[{mwMessage: 'deepcat-error-notfound', parameter: 'a'}],
			'computeErrors: "Category x not found" error creates correct message and returns x.'
		);
		testError = [{statusMessage:'RuntimeError: Category \'\' not found in wiki', userparam: '{"searchTermNum":0}'}];
		assert.deepEqual(
			deepCat.computeErrors(testError, searchTerms),
			['', 'b'],
			'computeErrors: Clear search term if category is missing.'
		);
		assert.deepEqual(
			lastError,
			[{mwMessage: 'deepcat-missing-category', parameter: null}],
			'computeErrors: "Category not found" error creates correct message.'
		);
		// restore original function
		deepCat.addErrorMsgField = oldAddErrorMsgField;
	} );
}( mediaWiki.libs.deepCat, jQuery, QUnit ) );