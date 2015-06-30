/**
 * @licence GNU GPL v2+
 * @author Leszek Manicki <leszek.manicki@wikimedia.de>
 */
( function( DeepCat, $, QUnit ) {
	QUnit.test( 'load DeepCat', function( assert ) {
		assert.ok( DeepCat !== null, 'DeepCat is not null' );
	} );
}( DeepCat, jQuery, QUnit ) );