/**
 * DeepCat Gadget for MediaWiki
 * using JSONP CatGraph interface https://github.com/wmde/catgraph-jsonp
 * report issues / feature requests https://github.com/wmde/DeepCat-Gadget
 * @licence GNU GPL v2+
 * @author Christoph Fischer < christoph.fischer@wikimedia.de >
 */

(function () {
	var keyString = 'deepCat:';
	var maxDepth = 10;
	var maxResults = 50;
	var deepCatInputString = '';
	var deepCatCategory = '';
	var deepCatSearchWord = '';
	var requestUrl = 'http://tools.wmflabs.org/catgraph-jsonp/gptest1wiki_ns14/traverse-successors%20Category:{0}%20' + maxDepth + '%20' + maxResults;

	$( function () {
		$( '#searchform, #search' ).on( 'submit', function ( e ) {
			var searchInput = $( this ).find( '[name="search"]' ).val();

			if ( searchInput.match( new RegExp( keyString ) ) ) {
				e.preventDefault();

				deepCatInputString = extractDeepCatInputString( searchInput );
				deepCatCategory = extractDeepCatCategory( deepCatInputString );
				deepCatSearchWord = extractDeepCatSearchWord( deepCatInputString );

				log( "deepCatInputString: " + deepCatInputString );
				log( "deepCatCategory: " + deepCatCategory );
				log( "deepCatSearchWord: " + deepCatSearchWord );

				//bugfix to sync search fields for better recovery of "deepCatSearch"
				substituteInputValues( searchInput );

				sendAjaxRequest( deepCatCategory );
			}
		} );

		var deepCatSearch = getUrlParameter( 'deepCatSearch' );

		if ( deepCatSearch && deepCatSearch.match( new RegExp( keyString ) ) ) {
			substituteInputValues( deepCatSearch.replace( /\+/g, ' ' ) );
		}

	} );

	function extractDeepCatInputString( input ) {
		return input.replace( new RegExp( '^' + keyString + '[\\s]*' ), '' ).trim();
	}

	function extractDeepCatCategory( input ) {
		var categoryString = input.replace( /^[\s]*(("[^"]*")|([^"]*))(.*)$/, '$1' ).trim();
		categoryString = categoryString.replace( / /g, '_' );
		return categoryString.replace( /"/g, '' );
	}

	function extractDeepCatSearchWord( input ) {
		return input.replace( /^[\s]*(("[^"]*")|([^"]*))(.*)$/, '$4' ).trim();
	}

	function sendAjaxRequest( searchString ) {
		$.ajax( {
			url: String.format( requestUrl, searchString ),
			dataType: 'jsonp',
			jsonp: 'callback',
			success: ajaxHandler,
			error: ajaxError
		} )
	}

	function ajaxHandler( data ) {
		log( "ajax request successful" );

		var searchString;

		if ( data['status'] === 'OK' ) {
			log( "graph request successful" );
			log( "statusMessage: " + data['statusMessage'] );

			searchString = 'incategory:id:' + data['result'].join( '|id:' );
			searchString += ' ' + deepCatSearchWord;
		} else {
			log( "graph request failed" );
			log( "statusMessage: " + data['statusMessage'] );

			searchString = 'incategory:' + deepCatInputString;
		}

		substituteSearchRequest( searchString );
		$( '#searchform' ).submit();
	}

	function ajaxError( data ) {
		log( "ajax request error: " + data );

		substituteSearchRequest( 'incategory:' + deepCatInputString );
		$( '#searchform' ).submit();
	}

	function substituteSearchRequest( searchString ) {
		$( '[name="search"]' ).attr( 'name', 'deepCatSearch' );
		$( '<input>' ).attr( {
			type: 'hidden',
			name: 'search',
			value: searchString
		} ).appendTo( '#searchform' );
	}

	function substituteInputValues( input ) {
		$( '[name="search"]' ).val( input );
	}

	function log( stuff ) {
		if ( console && console.log ) {
			console.log( stuff );
		}
	}

	String.format = function () {
		var s = arguments[0];
		for ( var i = 0; i < arguments.length - 1; i++ ) {
			var reg = new RegExp( "\\{" + i + "\\}", "gm" );
			s = s.replace( reg, arguments[i + 1] );
		}

		return s;
	}

	function getUrlParameter( sParam ) {
		var sPageURL = window.location.search.substring( 1 );
		var sURLVariables = sPageURL.split( '&' );
		for ( var i = 0; i < sURLVariables.length; i++ ) {
			var sParameterName = sURLVariables[i].split( '=' );
			if ( sParameterName[0] == sParam ) {
				return decodeURIComponent( sParameterName[1] );
			}
		}
	}
}());
