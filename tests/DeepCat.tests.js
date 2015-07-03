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
			[ 'deepcat:a', '"b' ],
			'getSearchTerms: Unmatched quote does not introduce multi-word search term'
		);
		assert.deepEqual(
			deepCat.getSearchTerms( 'deepcat:a" b' ),
			[ 'deepcat:a', '"', 'b' ],
			'getSearchTerms: Unmatched quote does not introduce multi-word search term'
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
    } );
}( mediaWiki.libs.deepCat, jQuery, QUnit ) );