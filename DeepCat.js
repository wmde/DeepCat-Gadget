/**
 * DeepCat Gadget for MediaWiki
 * using JSONP CatGraph interface https://github.com/wmde/catgraph-jsonp
 * report issues / feature requests https://github.com/wmde/DeepCat-Gadget
 * @licence GNU GPL v2+
 * @author Christoph Fischer < christoph.fischer@wikimedia.de >
 */

( function( $, mw ) {
	var keyString = 'deepcat:',
		maxDepth = 10,
		maxResults = 50,
		ajaxTimeout = 10000,
		deepCatSearchTerms;
	var DBname = mw.config.get( 'wgDBname' );
	var requestUrl = '//tools.wmflabs.org/catgraph-jsonp/' + DBname +
		'_ns14/traverse-successors%20Category:{0}%20' + maxDepth + '%20' + maxResults;

	switch ( mw.config.get( 'wgUserLanguage' ) ) {
		case 'de':
		case 'de-at':
		case 'de-ch':
		case 'de-formal':
			mw.messages.set( {
				'deepcat-error-notfound': 'CatGraph konnte die Kategorie \'{0}\' nicht finden.',
				'deepcat-error-tooldown': 'CatGraph-Tool ist zur Zeit nicht erreichbar.',
				'deepcat-missing-category': 'Bitte gib eine Kategorie ein.'
			} );
			break;
		case 'en':
		default:
			mw.messages.set( {
				'deepcat-error-notfound': 'CatGraph could not find the category \'{0}\'.',
				'deepcat-error-tooldown': 'CatGraph-Tool is not reachable.',
				'deepcat-missing-category': 'Please insert a category.'
			} );
			break;
	}

	$( function() {
		$( '#searchform, #search' ).on( 'submit', function ( e ) {
			var searchInput = $( this ).find( '[name="search"]' ).val();

			if ( matchesDeepCatKeyword( searchInput ) ) {
				deepCatSearchTerms = getSearchTerms( searchInput );

				e.preventDefault();

				mw.log( "deepCatSearchTerms: " + deepCatSearchTerms );

				//bugfix to sync search fields for better recovery of "deepCatSearch"
				substituteInputValues( searchInput );

				sendAjaxRequests( deepCatSearchTerms );
			}
		} );

		refreshSearchTermMock();
		checkErrorMessage();
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
			url: stringFormat( requestUrl, categoryString ),
			data: { userparam: JSON.stringify( userParameter ) },
			timeout: ajaxTimeout,
			dataType: 'jsonp',
			jsonp: 'callback',
			error: fatalAjaxError
		} )
	}

	function receiveAjaxResponses() {
		var responses = [], errors = [];
		var newSearchTerms = deepCatSearchTerms;
		var i, ajaxResponse;

		removeAjaxThrobber();

		//single request leads to different variable structure
		if ( typeof arguments[1] === 'string' ) {
			arguments = [arguments];
		}

		for ( i = 0; i < arguments.length; i++ ) {
			ajaxResponse = arguments[i][0];

			if ( arguments[i][1] !== 'success' ) {
				ajaxError( arguments[i] );
				return;
			} else if ( ajaxResponse['status'] == 'OK' ) {
				ajaxSuccess( ajaxResponse );
				responses.push( ajaxResponse );
			} else {
				graphError( ajaxResponse );
				errors.push( ajaxResponse );
			}
		}

		newSearchTerms = computeResponses( responses, newSearchTerms )
		newSearchTerms = computeErrors( errors, newSearchTerms );

		substituteSearchRequest( newSearchTerms.join( ' ' ) );
		$( '#searchform' ).submit();
	}

	function computeResponses( responses, newSearchTerms ) {
		var i, userParameters, newSearchTermString;

		for ( i = 0; i < responses.length; i++ ) {
			userParameters = JSON.parse( responses[i]['userparam'] );
			newSearchTermString = '';

			if ( userParameters['negativeSearch'] ) {
				newSearchTermString += '-';
			}
			newSearchTermString += 'incategory:id:' + responses[i]['result'].join( '|id:' );

			newSearchTerms[userParameters['searchTermNum']] = newSearchTermString;
		}

		return newSearchTerms;
	}

	function computeErrors( errors, newSearchTerms ) {
		var errorMessages = [];
		var i, userParameters, categoryError;

		for ( i = 0; i < errors.length; i++ ) {
			userParameters = JSON.parse( errors[i]['userparam'] );
			categoryError = errors[i].statusMessage.match( /(RuntimeError: Category \')(.*)(\' not found in wiki.*)/ );

			if ( !categoryError ) {
			} else if ( categoryError[2].length === 0 ) {
				errorMessages.push(
					createErrorMessage( 'deepcat-missing-category', null )
				);
			} else if ( categoryError[2].length > 0 ) {
				errorMessages.push(
					createErrorMessage( 'deepcat-error-notfound', categoryError[2] )
				);
			}

			newSearchTerms[userParameters['searchTermNum']] = '';
		}

		addErrorMsgField( errorMessages );
		return newSearchTerms;
	}

	function createErrorMessage( mwMessage, parameter ) {
		return {
			mwMessage: mwMessage,
			parameter: parameter
		};
	}

	function ajaxSuccess( data ) {
		mw.log( "graph & ajax request successful" );
		mw.log( "statusMessage: " + data['statusMessage'] );
	}

	function graphError( data ) {
		mw.log( "graph request failed" );
		mw.log( "statusMessage: " + data['statusMessage'] );
	}

	function ajaxError( data ) {
		mw.log( "ajax request error: " + JSON.stringify( data ) );
		addErrorMsgField( [createErrorMessage( 'deepcat-error-tooldown', null )] );

		substituteSearchRequest( ' ' );
		$( '#searchform' ).submit();
	}

	function fatalAjaxError( data, error ) {
		removeAjaxThrobber();
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

	function addErrorMsgField( errorMessages ) {
		if ( errorMessages.length > 0 ) {
			$( '<input>' ).attr( {
				type: 'hidden',
				name: 'deepCatError',
				value: JSON.stringify( errorMessages )
			} ).appendTo( '#searchform' );
		}
	}

	function showErrorMessage( message ) {
		var output = mw.html.element( 'div', { class: 'searchresults' }, new mw.html.Raw(
			mw.html.element( 'div', { class: 'error' }, message )
		) );
		$( '#search' ).after( output );
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

	function checkErrorMessage() {
		var i, message;
		var deepCatErrors = mw.util.getParamValue( 'deepCatError' );

		if ( deepCatErrors ) {
			deepCatErrors = JSON.parse( deepCatErrors );
			deepCatErrors = deepCatErrors.reverse();

			for ( i = 0; i < deepCatErrors.length; i++ ) {
				if ( deepCatErrors[i].parameter ) {
					message = stringFormat( mw.msg( deepCatErrors[i].mwMessage ), deepCatErrors[i].parameter );
				} else {
					message = mw.msg( deepCatErrors[i].mwMessage );
				}
				showErrorMessage( message );
			}
		}
	}

	function refreshSearchTermMock() {
		var deepCatSearch = mw.util.getParamValue( 'deepCatSearch' );

		if ( deepCatSearch && matchesDeepCatKeyword( deepCatSearch ) ) {
			deepCatSearch = deepCatSearch.replace( /\+/g, ' ' );

			substituteInputValues( deepCatSearch );
			substituteTitle( deepCatSearch );
			appendToSearchLinks( deepCatSearch );
		}
	}

	function addAjaxThrobber() {
		$( '#searchButton, #mw-searchButton' ).addClass( 'deep-cat-throbber-small' );
		$( '#searchText' ).addClass( 'deep-cat-throbber-big' );
	}

	function removeAjaxThrobber() {
		$( '#searchButton, #mw-searchButton' ).removeClass( 'deep-cat-throbber-small' );
		$( '#searchText' ).removeClass( 'deep-cat-throbber-big' );
	}

	function stringFormat() {
		var s = arguments[0];
		for ( var i = 0; i < arguments.length - 1; i++ ) {
			s = s.replace( new RegExp( "\\{" + i + "\\}", "gm" ), arguments[i + 1] );
		}
		return s;
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
}( jQuery, mediaWiki ) );
