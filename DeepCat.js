/**
 * DeepCat Gadget for MediaWiki
 * using JSONP CatGraph interface https://github.com/wmde/catgraph-jsonp
 * report issues / feature requests https://github.com/wmde/DeepCat-Gadget
 * @licence GNU GPL v2+
 * @author Christoph Fischer < christoph.fischer@wikimedia.de >
 */

(function () {
	var keyString = 'deepCat:', maxDepth = 10, maxResults = 50, deepCatSearchTerms;
	var requestUrl = '//tools.wmflabs.org/catgraph-jsonp/gptest1wiki_ns14/traverse-successors%20Category:{0}%20' + maxDepth + '%20' + maxResults;

	$( function () {
		$( '#searchform, #search' ).on( 'submit', function ( e ) {
			var searchInput = $( this ).find( '[name="search"]' ).val();

			if ( matchesDeepCatKeyword( searchInput ) ) {
				deepCatSearchTerms = getSearchTerms( searchInput );

				e.preventDefault();

				log( "deepCatSearchTerms: " + deepCatSearchTerms );

				//bugfix to sync search fields for better recovery of "deepCatSearch"
				substituteInputValues( searchInput );

				sendAjaxRequests( deepCatSearchTerms );
			}
		} );

		//fake input field values
		var deepCatSearch = getUrlParameter( 'deepCatSearch' );

		if ( deepCatSearch && matchesDeepCatKeyword( deepCatSearch ) ) {
			deepCatSearch = deepCatSearch.replace( /\+/g, ' ' );

			substituteInputValues( deepCatSearch );
			substituteTitle( deepCatSearch );
			appendToSearchLinks( deepCatSearch );
		}
	} );

	function sendAjaxRequests( searchTerms ) {
		var requests = [];
		addAjaxThrobber();

		for ( var i = 0; i < searchTerms.length; i++ ) {
			if ( matchesDeepCatKeyword( searchTerms[i] ) ) {
				requests.push( getAjaxRequest( searchTerms[i], i ) );
			}
		}

		$.when.apply( this, requests ).done( receiveAjaxResponses );
	}

	function getAjaxRequest( searchTerm, num ) {
		var categoryString = extractDeepCatCategory( searchTerm );
		var userParameter = {
			negativeSearch: ( searchTerm.charAt( 0 ) === '-' ),
			searchTermNum: ( num )
		};

		return $.ajax( {
			url: String.format( requestUrl, categoryString ),
			data: { userparam: JSON.stringify( userParameter ) },
			dataType: 'jsonp',
			jsonp: 'callback',
			error: fatalAjaxError
		} )
	}

	function receiveAjaxResponses() {
		var responses = [];
		removeAjaxThrobber();

		//single request leads to different variable structure
		if ( typeof arguments[1] === 'string' ) {
			arguments = [arguments];
		}

		for ( var i = 0; i < arguments.length; i++ ) {
			var ajaxResponse = arguments[i][0];

			if ( arguments[i][1] !== 'success' ) {
				ajaxError( arguments[i] );
				return;
			} else if ( ajaxResponse['status'] !== 'OK' ) {
				graphError( ajaxResponse );
				return;
			}

			ajaxSuccess( ajaxResponse );
			responses.push( ajaxResponse );
		}

		substituteSearchRequest( composeNewSearchString( responses ) );
		$( '#searchform' ).submit();
	}

	function composeNewSearchString( responses ) {
		var newSearchTerms = deepCatSearchTerms;

		for ( var i = 0; i < responses.length; i++ ) {
			var userParameters = JSON.parse( responses[i]['userparam'] );
			var newSearchTermString = '';

			if ( userParameters['negativeSearch'] ) {
				newSearchTermString += '-';
			}
			newSearchTermString += 'incategory:id:' + responses[i]['result'].join( '|id:' ) + ' ';

			newSearchTerms[userParameters['searchTermNum']] = newSearchTermString;
		}

		return newSearchTerms.join( ' ' );
	}

	function ajaxSuccess( data ) {
		log( "graph & ajax request successful" );
		log( "statusMessage: " + data['statusMessage'] );
	}

	function graphError( data ) {
		log( "graph request failed" );
		log( "statusMessage: " + data['statusMessage'] );

		substituteSearchRequest( ' ' );
		$( '#searchform' ).submit();
	}

	function ajaxError( data ) {
		log( "ajax request error: " + JSON.stringify( data ) );

		substituteSearchRequest( ' ' );
		$( '#searchform' ).submit();
	}

	function fatalAjaxError( data, error ) {
		ajaxError( error );
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

	function searchTermRegExp( keyword ) {
		return new RegExp( '(-?' + keyword + '([\\s]*)(("[^"]+")|([^"\\s\\)\\(]+)))|([^\\s]+)', 'g' );
	}

	function substituteTitle( input ) {
		loadMessages( 'searchresults-title' ).done( function () {
			$( document ).prop( 'title', mw.msg( 'searchresults-title', input ) );
		} );
	}

	function appendToSearchLinks( input ) {
		$( '.mw-prevlink, .mw-numlink, .mw-nextlink' ).each( function () {
			var _href = $( this ).attr( "href" );
			$( this ).attr( "href", _href + '&deepCatSearch=' + input );
		} );
	}

	function getSearchTerms( input ) {
		return input.match( searchTermRegExp( keyString ) );
	}

	function matchesDeepCatKeyword( input ) {
		return input.match( new RegExp( keyString ) )
	}

	function extractDeepCatCategory( searchTerm ) {
		var categoryString = searchTerm.replace( new RegExp( '-?' + keyString + '([\\s]*)' ), '' );
		categoryString = categoryString.replace( / /g, '_' );
		return categoryString.replace( /"/g, '' );
	}

	function addAjaxThrobber() {
		$( '#searchButton, #mw-searchButton' ).addClass( 'deep-cat-throbber-small' );
		$( '#searchText' ).addClass( 'deep-cat-throbber-big' );
	}

	function removeAjaxThrobber() {
		$( '#searchButton, #mw-searchButton' ).removeClass( 'deep-cat-throbber-small' );
		$( '#searchText' ).removeClass( 'deep-cat-throbber-big' );
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
	};

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

	/** @return instance of jQuery.Promise */
	function loadMessages( messages ) {
		return new mw.Api().get( {
			action: 'query',
			meta: 'allmessages',
			amlang: mw.config.get( 'wgUserLanguage' ),
			ammessages: messages
		} ).done( function ( data ) {
			$.each( data.query.allmessages, function ( index, message ) {
				if ( message.missing !== '' ) {
					mw.messages.set( message.name, message['*'] );
				}
			} );
		} );
	}
}());
