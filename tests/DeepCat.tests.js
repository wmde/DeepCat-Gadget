/**
 * @license GNU GPL v2+
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

	QUnit.test( 'extractDeepCatCategory', function( assert ) {
		assert.deepEqual(
			deepCat.extractDeepCatCategory( 'deepcat:Physik' ).categoryString,
			'Physik',
			'extractDeepCatCategory: the keyword should be removed from the DeepCat-term'
		);
		assert.deepEqual(
			deepCat.extractDeepCatCategory( '  deepcat:   Physik' ).categoryString,
			'Physik',
			'extractDeepCatCategory: whitspaces around the keyword should be removed from the DeepCat-term'
		);
		assert.deepEqual(
			deepCat.extractDeepCatCategory( 'deepcat:"Geschichte_der_Physik"' ).categoryString,
			'Geschichte_der_Physik',
			'extractDeepCatCategory: double-quotes should be removed from the DeepCat-term'
		);
		assert.deepEqual(
			deepCat.extractDeepCatCategory( 'deepcat:"Geschichte der Physik"' ).categoryString,
			'Geschichte_der_Physik',
			'extractDeepCatCategory: spaces should be replaced with underscore in the DeepCat-term'
		);
		assert.deepEqual(
			deepCat.extractDeepCatCategory( 'deepcat:"Geschichte　der　Physik"' ).categoryString,
			'Geschichte_der_Physik',
			'extractDeepCatCategory: ideographic spaces should be replaced with underscore in the DeepCat-term'
		);
		assert.deepEqual(
			deepCat.extractDeepCatCategory( 'deepcat:"Geschichte　 _ _der　Physik"' ).categoryString,
			'Geschichte_der_Physik',
			'extractDeepCatCategory: mixed spaces/underscores should be replaced with one underscore in the DeepCat-term'
		);
		/* jshint -W100 */
		assert.deepEqual(
			deepCat.extractDeepCatCategory( 'deepcat:"Classical mechanics stubs‎"' ).categoryString,
			'Classical_mechanics_stubs',
			'extractDeepCatCategory: LTR-mark character should be removed from DeepCat-term'
		);
		/* jshint +W100 */
		assert.deepEqual(
			deepCat.extractDeepCatCategory( 'deepcat:"Waters\'_Edge_Park"' ).categoryString,
			'Waters\'_Edge_Park',
			'extractDeepCatCategory: single quotes should stay the same in the DeepCat-term'
		);
		assert.deepEqual(
			deepCat.extractDeepCatCategory( 'deepcat:"Springende Bälle"' ).categoryString,
			'Springende_Bälle',
			'extractDeepCatCategory: umlauts should stay the same in the DeepCat-term'
		);
		assert.deepEqual(
			deepCat.extractDeepCatCategory( 'deepcat:貓' ).categoryString,
			'貓',
			'extractDeepCatCategory: chinese characters should stay the same in the DeepCat-term'
		);
		assert.deepEqual(
			deepCat.extractDeepCatCategory( 'deepcat:Кошки' ).categoryString,
			'Кошки',
			'extractDeepCatCategory: cyrillic characters should stay the same in the DeepCat-term'
		);
		assert.deepEqual(
			deepCat.extractDeepCatCategory( 'deepcat:قطط' ).categoryString,
			'قطط',
			'extractDeepCatCategory: arabic characters should stay the same in the DeepCat-term'
		);
		assert.deepEqual(
			deepCat.extractDeepCatCategory( 'deepcat:Physik' ).depth,
			'15',
			'extractDeepCatCategory: defaut depth should be 15'
		);
		assert.deepEqual(
			deepCat.extractDeepCatCategory( 'deepcat:Physik~21' ).depth,
			'21',
			'extractDeepCatCategory: number after ~ should be parsed as depth'
		);
		assert.deepEqual(
			deepCat.extractDeepCatCategory( 'deepcat:Physik~foo' ).categoryString,
			'Physik~foo',
			'extractDeepCatCategory: text after ~ should not be parsed as depth'
		);
		assert.deepEqual(
			deepCat.extractDeepCatCategory( 'deepcat:Physik~foo' ).depth,
			'15',
			'extractDeepCatCategory: text after ~ should not be parsed as depth'
		);
		assert.deepEqual(
			deepCat.extractDeepCatCategory( 'deepcat:Physik~14~21' ).depth,
			'21',
			'extractDeepCatCategory: number after last ~ should be parsed as depth'
		);
		assert.deepEqual(
			deepCat.extractDeepCatCategory( 'deepcat:Physik~14~21' ).categoryString,
			'Physik~14',
			'extractDeepCatCategory: every before last ~ should be parsed as Category-Name'
		);
	} );

	QUnit.test( 'computeResponses', function( assert ) {
		var responseForTerm0 = {
				result: [ [ 1 ], [ 2 ], [ 3 ] ],
				userparam: '{"negativeSearch":false,"searchTermNum":0}'
			},
			responseForTerm2 = {
				result: [ [ 4 ], [ 5 ] ],
				userparam: '{"negativeSearch":false,"searchTermNum":2}'
			},
			responseWithNegativeSearch = {
				result: [ [ 6 ], [ 7 ] ],
				userparam: '{"negativeSearch":true,"searchTermNum":0}'
			},
			emptyResponse = {
				result: [],
				userparam: '{"negativeSearch":true,"searchTermNum":0}'
			},
			expectedErrors
			;
		assert.deepEqual(
			deepCat.computeResponses( [], [] ),
			[],
			'computeResponses: Empty response returns empty search terms'
		);
		assert.deepEqual(
			deepCat.computeResponses( [ responseForTerm0 ], [ 'deepcat:a', 'b' ] ),
			[ 'incategory:id:1|id:2|id:3', 'b' ],
			'computeResponses: deepcat terms are replaced with incategory search terms computed from response'
		);
		assert.deepEqual(
			deepCat.computeResponses( [ responseForTerm2, responseForTerm0 ], [ 'deepcat:a', 'c', 'deepcat:b' ] ),
			[ 'incategory:id:1|id:2|id:3', 'c', 'incategory:id:4|id:5' ],
			'computeResponses: Multiple responses are placed in the right order, regardless of response order'
		);
		assert.deepEqual(
			deepCat.computeResponses( [ responseWithNegativeSearch ], [ '-deepcat:c', 'b' ] ),
			[ '-incategory:id:6|id:7', 'b' ],
			'computeResponses: NegativeSearch in responses create minus prefix for incategory search terms'
		);
		deepCat.ResponseErrors.reset();
		assert.deepEqual(
			deepCat.computeResponses( [ emptyResponse ], [ '-deepcat:c', 'b' ] ),
			[ '', 'b' ],
			'computeResponses: Empty results in responses removes search term'
		);
		expectedErrors = deepCat.ResponseErrors.getErrors();
		assert.deepEqual(
			expectedErrors,
			[ { mwMessage: 'deepcat-error-unexpected-response', parameter: null } ],
			'computeResponses: Empty results in in responses create error message'
		);
	} );

	QUnit.test( 'computeErrors', function( assert ) {
		var oldAddErrorMsgField, lastError, testError,
			searchTerms = [ 'deepcat:a', 'b' ];
		oldAddErrorMsgField = deepCat.addErrorMsgField;
		// mock function to check for side effects of computeErrors
		deepCat.addErrorMsgField = function( errors ) {
			lastError = errors;
		};
		deepCat.ResponseErrors.reset();
		testError = [ { statusMessage: 'Graph not found', userparam: '{"searchTermNum":0}' } ];
		assert.deepEqual(
			deepCat.computeErrors( testError, searchTerms ),
			[ '', 'b' ],
			'computeErrors: Clear search term if wiki is not supported.'
		);
		assert.deepEqual(
			lastError,
			[ { mwMessage: 'deepcat-error-unknown-graph', parameter: null } ],
			'computeErrors: "Graph not found" error creates correct message.'
		);
		deepCat.ResponseErrors.reset();
		testError = [ { statusMessage: 'RuntimeError: Category \'a\' not found in wiki', userparam: '{"searchTermNum":0}' } ];
		assert.deepEqual(
			deepCat.computeErrors( testError, searchTerms ),
			[ '', 'b' ],
			'computeErrors: Clear search term if category is not found.'
		);
		assert.deepEqual(
			lastError,
			[ { mwMessage: 'deepcat-error-notfound', parameter: 'a' } ],
			'computeErrors: "Category x not found" error creates correct message and returns x.'
		);
		deepCat.ResponseErrors.reset();
		testError = [ { statusMessage: 'RuntimeError: Category \'\' not found in wiki', userparam: '{"searchTermNum":0}' } ];
		assert.deepEqual(
			deepCat.computeErrors( testError, searchTerms ),
			[ '', 'b' ],
			'computeErrors: Clear search term if category is missing.'
		);
		assert.deepEqual(
			lastError,
			[ { mwMessage: 'deepcat-missing-category', parameter: null } ],
			'computeErrors: "Category not found" error creates correct message.'
		);
		// restore original function
		deepCat.addErrorMsgField = oldAddErrorMsgField;
	} );
}( mediaWiki.libs.deepCat, jQuery, QUnit ) );
