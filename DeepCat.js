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
		deepCatSearchTerms,
		requestUrl = '//tools.wmflabs.org/catgraph-jsonp/' + mw.config.get( 'wgDBname' )
			+ '_ns14/traverse-successors%20Category:{0}%20' + maxDepth + '%20' + maxResults;

	switch ( mw.config.get( 'wgUserLanguage' ) ) {
		case 'de':
		case 'de-at':
		case 'de-ch':
		case 'de-formal':
			mw.messages.set( {
				'deepcat-error-notfound': 'Die Kategorie \'{0}\' konnte nicht gefunden werden.',
				'deepcat-error-tooldown': 'CatGraph-Tool ist zur Zeit nicht erreichbar.',
				'deepcat-error-unknown-graph': 'Dieses Wiki wird von CatGraph nicht unterst&uuml;tzt.',
				'deepcat-missing-category': 'Bitte gib eine Kategorie ein.',
				'deepcat-hintbox-close': 'Zunk&uuml;nftig ausblenden',
				'deepcat-hintbox-text': 'Momentane Einschränkung des DeepCat-Gadgets pro Suchbegriff:<br/>' +
										'Max. Kategoriensuchtiefe: ' + maxDepth + ' / Max. Kategorienanzahl: ' + maxResults + '<br/>' +
										'<a style="float:left" href="//de.wikipedia.org/wiki/Wikipedia_Diskussion:Umfragen/Technische_W%C3%BCnsche/Top_20#Prototyp_.E2.80.9EDeepcat.E2.80.9C-Gadget:_Einladung_zum_ersten_Testen" target="_blank">Weitere Informationen</a>',
				'deepcat-hintbox-small': 'Max. Kategoriensuchtiefe: ' + maxDepth + '<br/>Max. Kategorienanzahl: ' + maxResults + ''
			} );
			break;
		default:
			mw.messages.set( {
				'deepcat-error-notfound': 'CatGraph could not find the category \'{0}\'.',
				'deepcat-error-tooldown': 'CatGraph-Tool is not reachable.',
				'deepcat-error-unknown-graph': 'The Wiki is not supported by CatGraph.',
				'deepcat-missing-category': 'Please insert a category.',
				'deepcat-hintbox-close': 'Do not show again',
				'deepcat-hintbox-text': 'Current limits of the DeepCat-Gadgets per search word:<br/>' +
										'Max. search depth: ' + maxDepth + ' / Max. result categories: ' + maxResults + '<br/>' +
										'<a style="float:left" href="//de.wikipedia.org/wiki/Wikipedia_Diskussion:Umfragen/Technische_W%C3%BCnsche/Top_20#Prototyp_.E2.80.9EDeepcat.E2.80.9C-Gadget:_Einladung_zum_ersten_Testen"  target="_blank">Additional information</a>',
				'deepcat-hintbox-small': 'Max. category-depth: ' + maxDepth + '<br/>Max. categories: ' + maxResults + ''
			} );
			break;
	}

	$( function() {
		shouldHideHints = hasHintCookie();

		$( '#searchform, #search' ).on( 'submit', function( e ) {
			var searchInput = $( this ).find( '[name="search"]' ).val();

			if ( matchesDeepCatKeyword( searchInput ) ) {
				deepCatSearchTerms = getSearchTerms( searchInput );

				e.preventDefault();

				mw.log( 'deepCatSearchTerms: ' + deepCatSearchTerms );

				//bugfix to sync search fields for better recovery of "deepCatSearch"
				substituteInputValues( searchInput );

				sendAjaxRequests( deepCatSearchTerms );
			}
		} );

		if ( !shouldHideHints ) {
			addSearchFormHint();
			addSmallFormHint();

			$( '#searchText' ).on( 'keyup', function() {
				if ( matchesDeepCatKeyword( $( this ).val() ) && !shouldHideHints ) {
					$( '#deepcat-hintbox' ).slideDown();
				} else {
					$( '#deepcat-hintbox' ).slideUp();
				}
			} );

			$( '#searchInput' ).on( 'keyup', function() {
				if ( matchesDeepCatKeyword( $( this ).val() ) && !shouldHideHints ) {
					disableImeAndSuggestions();
					$( '#deepcat-smallhint' ).slideDown( 'fast' );
				} else {
					enableImeAndSuggestions();
					$( '#deepcat-smallhint' ).slideUp( 'fast' );
				}
			} );
		}

		if ( refreshSearchTermMock() ) {
			if( !shouldHideHints ) {
				$( '#deepcat-hintbox' ).show();
			}
			checkErrorMessage();
		}
	} );

	function sendAjaxRequests( searchTerms ) {
		var i,
			requests = [];

		addAjaxThrobber();

		for ( i = 0; i < searchTerms.length; i++ ) {
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
		var i,
			ajaxResponse,
			responses = [],
			errors = [],
			newSearchTerms = deepCatSearchTerms;

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
		var i,
			userParameters,
			newSearchTermString;

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
		var i,
			userParameters,
			categoryError,
			errorMessages = [];

		for ( i = 0; i < errors.length; i++ ) {
			userParameters = JSON.parse( errors[i]['userparam'] );
			categoryError = errors[i].statusMessage.match( /(RuntimeError: Category \')(.*)(\' not found in wiki.*)/ );

			if ( !categoryError ) {
				if ( 'Graph not found' == errors[i].statusMessage ) {
					errorMessages.push(
						createErrorMessage( 'deepcat-error-unknown-graph', null )
					);
				}
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
		mw.log( 'graph & ajax request successful' );
		mw.log( 'statusMessage: ' + data['statusMessage'] );
	}

	function graphError( data ) {
		mw.log( 'graph request failed' );
		mw.log( 'statusMessage: ' + data['statusMessage'] );
	}

	function ajaxError( data ) {
		mw.log( 'ajax request error: ' + JSON.stringify( data ) );
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
		loadMessages( 'searchresults-title' ).done( function() {
			$( document ).prop( 'title', mw.msg( 'searchresults-title', input ) );
		} );
	}

	function appendToSearchLinks( input ) {
		$( '.mw-prevlink, .mw-numlink, .mw-nextlink' ).each( function() {
			var _href = $( this ).attr( 'href' );
			$( this ).attr( 'href', _href + '&deepCatSearch=' + input );
		} );
	}

	/**
	 * @param {string} input
	 * @return {string[]}
	 */
	function getSearchTerms( input ) {
		return input.match( searchTermRegExp( keyString ) );
	}

	/**
	 * @param {string} input
	 * @return {boolean}
	 */
	function matchesDeepCatKeyword( input ) {
		return input.match( new RegExp( keyString ) )
	}

	/**
	 * @param {string} searchTerm
	 * @return {string}
	 */
	function extractDeepCatCategory( searchTerm ) {
		var categoryString = searchTerm.replace( new RegExp( '-?' + keyString + '([\\s]*)' ), '' );
		categoryString = categoryString.replace( / /g, '_' );
		return categoryString.replace( /"/g, '' );
	}

	function checkErrorMessage() {
		var deepCatErrors = mw.util.getParamValue( 'deepCatError' ),
			i,
			message;

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
			return true;
		}
		return false;
	}

	function addAjaxThrobber() {
		$( '#searchButton, #mw-searchButton' ).addClass( 'deep-cat-throbber-small' );
		$( '#searchText' ).addClass( 'deep-cat-throbber-big' );
	}

	function removeAjaxThrobber() {
		$( '#searchButton, #mw-searchButton' ).removeClass( 'deep-cat-throbber-small' );
		$( '#searchText' ).removeClass( 'deep-cat-throbber-big' );
	}

	function addSearchFormHint() {
		var hintBox = '<div id="deepcat-hintbox" style="display: none;">'
						+ '<img id="deepcat-info-img" src="//upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Information_icon4.svg/40px-Information_icon4.svg.png"/>  '
						+ '<div>'
							+ mw.msg( 'deepcat-hintbox-text' )
							+ '&nbsp;<a id="deepcat-hint-hide">' + mw.msg( 'deepcat-hintbox-close' ) + '</a>'
						+ '</div></div>';
		$( '#search' ).after( hintBox );
		$( '#deepcat-hint-hide' ).on( 'click', hideHints );
	}

	function addSmallFormHint() {
		var smallHintBox = '<div id="deepcat-smallhint">'
						+ '<img id="deepcat-smallhint-hide" title="' + mw.msg( 'deepcat-hintbox-close' ) + '" src="https://upload.wikimedia.org/wikipedia/commons/4/44/Curation_bar_icon_close.png">'
						+ mw.msg( 'deepcat-hintbox-small' )
						+ '</div>';
		$( '#searchform' ).after( smallHintBox );
		$( '#deepcat-smallhint-hide' ).on( 'click', hideHints );
	}

	function hasHintCookie() {
		return mw.cookie.get( "-deepcat-hintboxshown" ) == makeHintboxCookieToken( mw.msg( 'deepcat-hintbox-text' ) );
	}

	function hideHints() {
		shouldHideHints = true;

		$( '#deepcat-hintbox' ).hide();
		$( '#deepcat-smallhint' ).hide();
		enableImeAndSuggestions();

		mw.cookie.set( "-deepcat-hintboxshown", makeHintboxCookieToken( mw.msg( 'deepcat-hintbox-text' ) ), { 'expires': 60 * 60 * 24 * 7 * 4 /*4 weeks*/ } );
	}

	function disableImeAndSuggestions() {
		$( '.suggestions' ).css( 'z-index', -1 );
		$( '.imeselector' ).css( 'z-index', -1 );
	}

	function enableImeAndSuggestions() {
		$( '.suggestions' ).css( 'z-index', 'auto' );
		$( '.imeselector' ).css( 'z-index', 'auto' );
	}

	/**
	 * Hash function for generating hint box cookie token.
	 * @see http://erlycoder.com/49/javascript-hash-functions-to-convert-string-into-integer-hash-
	 * @param {string} str
	 * @return {number}
	 */
	function djb2Code( str ) {
		var hash = 5381,
			i;

		for ( i = 0; i < str.length; i++ ) {
			hash = ( ( hash << 5 ) + hash ) + str.charCodeAt( i );
		}

		return hash;
	}

	/**
	 * @param {string} str
	 * @return {string}
	 */
	function makeHintboxCookieToken( str ) {
		return String( djb2Code( str ) );
	}

	/**
	 * @return {string}
	 */
	function stringFormat() {
		var i,
			s = arguments[0];

		for ( i = 0; i < arguments.length - 1; i++ ) {
			s = s.replace( new RegExp( '\\{' + i + '\\}', 'gm' ), arguments[i + 1] );
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
		} ).done( function( data ) {
			$.each( data.query.allmessages, function( index, message ) {
				if ( message.missing !== '' ) {
					mw.messages.set( message.name, message['*'] );
				}
			} );
		} );
	}

}( jQuery, mediaWiki ) );
