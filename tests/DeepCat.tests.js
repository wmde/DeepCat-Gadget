/**
 * @licence GNU GPL v2+
 * @author Leszek Manicki <leszek.manicki@wikimedia.de>
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
}( mediaWiki.libs.deepCat, jQuery, QUnit ) );