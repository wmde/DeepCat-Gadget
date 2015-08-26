/**
 * DeepCat Gadget for MediaWiki
 * using JSONP CatGraph interface https://github.com/wmde/catgraph-jsonp
 * report issues / feature requests https://github.com/wmde/DeepCat-Gadget
 * @license GNU GPL v2+
 * @author Christoph Fischer < christoph.fischer@wikimedia.de >
 */
( function( $, mw ) {
	var DeepCat = {},
		keyString = 'deepcat:',
		maxDepth = 15,
		maxResults = 100,
		ajaxTimeout = 10000,
		deepCatSearchTerms,
		shouldHideHints = false,
		shouldHideSmallHint = false,
		requestUrl = '//tools.wmflabs.org/catgraph-jsonp/' + mw.config.get( 'wgDBname' )
			+ '_ns14/traverse-successors%20Category:{0}%20' + maxDepth + '%20' + maxResults;

	switch( mw.config.get( 'wgUserLanguage' ) ) {
		case 'de':
		case 'de-at':
		case 'de-ch':
		case 'de-formal':
			mw.messages.set( {
				'deepcat-error-notfound': 'Die Kategorie \'{0}\' konnte nicht gefunden werden.',
				'deepcat-error-tooldown': 'CatGraph-Tool ist zur Zeit nicht erreichbar.',
				'deepcat-error-unknown-graph': 'Dieses Wiki wird von CatGraph nicht unterst&uuml;tzt.',
				'deepcat-error-unexpected-response': 'CatGraph-Tool lieferte ein unerwartetes Ergebnis.',
				'deepcat-missing-category': 'Bitte gib eine Kategorie ein.',
				'deepcat-hintbox-close': 'Zuk&uuml;nftig ausblenden',
				'deepcat-smallhint-close': 'Ausblenden',
				'deepcat-hintbox-text': 'Momentane Einschränkung des DeepCat-Gadgets pro Suchbegriff:<br/>' +
										'Max. Kategoriensuchtiefe: ' + maxDepth + ' / Max. Kategorienanzahl: ' + maxResults + '<br/>' +
										'<a style="float:left" href="//de.wikipedia.org/wiki/Wikipedia_Diskussion:Umfragen/Technische_W%C3%BCnsche/Top_20#Prototyp_.E2.80.9EDeepcat.E2.80.9C-Gadget:_Einladung_zum_ersten_Testen" target="_blank">Weitere Informationen</a>',
				'deepcat-hintbox-small': 'Max. Kategoriensuchtiefe: ' + maxDepth + '<br/>Max. Kategorienanzahl: ' + maxResults
			} );
			break;
		default:
			mw.messages.set( {
				'deepcat-error-notfound': 'CatGraph could not find the category \'{0}\'.',
				'deepcat-error-tooldown': 'CatGraph-Tool is not reachable.',
				'deepcat-error-unknown-graph': 'The Wiki is not supported by CatGraph.',
				'deepcat-error-unexpected-response': 'CatGraph-Tool returned an unexpected response.',
				'deepcat-missing-category': 'Please insert a category.',
				'deepcat-hintbox-close': 'Do not show again',
				'deepcat-smallhint-close': 'Close',
				'deepcat-hintbox-text': 'Current limits of the DeepCat-Gadgets per search word:<br/>' +
										'Max. search depth: ' + maxDepth + ' / Max. result categories: ' + maxResults + '<br/>' +
										'<a style="float:left" href="//de.wikipedia.org/wiki/Wikipedia_Diskussion:Umfragen/Technische_W%C3%BCnsche/Top_20#Prototyp_.E2.80.9EDeepcat.E2.80.9C-Gadget:_Einladung_zum_ersten_Testen"  target="_blank">Additional information</a>',
				'deepcat-hintbox-small': 'Max. category-depth: ' + maxDepth + '<br/>Max. categories: ' + maxResults
			} );
			break;
	}

	$( function() {
		shouldHideHints = hasHintCookie();

		$( '#searchform, #search' ).on( 'submit', function( e ) {
			var searchInput = $( this ).find( '[name="search"]' ).val();

			if( matchesDeepCatKeyword( searchInput ) ) {
				deepCatSearchTerms = DeepCat.getSearchTerms( searchInput );

				e.preventDefault();

				mw.log( 'deepCatSearchTerms: ' + deepCatSearchTerms );

				// bugfix to sync search fields for better recovery of "deepCatSearch"
				substituteInputValues( searchInput );

				sendAjaxRequests( deepCatSearchTerms );
			}
		} );

		if( !shouldHideHints ) {
			addSearchFormHint();
			addSmallFormHint();

			$( '#searchText' ).find( ':input' ).on( 'keyup', function() {
				if( matchesDeepCatKeyword( $( this ).val() ) && !shouldHideHints ) {
					$( '#deepcat-hintbox' ).slideDown();
				} else {
					$( '#deepcat-hintbox' ).slideUp();
				}
			} );

			$( '#searchInput' ).on( 'keyup', function() {
				if( matchesDeepCatKeyword( $( this ).val() ) && !shouldHideHints && !shouldHideSmallHint ) {
					disableImeAndSuggestions();
					$( '#deepcat-smallhint' ).slideDown( 'fast' );
				} else {
					enableImeAndSuggestions();
					$( '#deepcat-smallhint' ).slideUp( 'fast' );
				}
			} );
		}

		if( refreshSearchTermMock() ) {
			if( !shouldHideHints ) {
				$( '#deepcat-hintbox' ).show();
			}
			checkErrorMessage();
		}
	} );

	/**
	 * ResponseErrors is a storage object that collects error messages in
	 * methods that process the AJAX responses from CatGraph
	 *
	 * @type {{errors: Array}}
	 */
	DeepCat.ResponseErrors = {
		errors: []
	};

	/**
	 * Remove all previously collected errors
	 */
	DeepCat.ResponseErrors.reset = function() {
		this.errors = [];
	};

	/**
	 * Append an error message
	 * @param {Object} err Error message object containing mwMessage and parameters
	 */
	DeepCat.ResponseErrors.addError = function( err ) {
		this.errors.push( err );
	};

	/**
	 * Return collected errors
	 * @return {Array}
	 */
	DeepCat.ResponseErrors.getErrors = function() {
		return this.errors || [];
	};

	function sendAjaxRequests( searchTerms ) {
		var i,
			requests = [];

		addAjaxThrobber();

		for( i = 0; i < searchTerms.length; i++ ) {
			if( matchesDeepCatKeyword( searchTerms[ i ] ) ) {
				requests.push( getAjaxRequest( searchTerms[ i ], i ) );
			}
		}

		$.when.apply( this, requests ).done( receiveAjaxResponses );
	}

	function getAjaxRequest( searchTerm, searchTermNum ) {
		var categoryString = extractDeepCatCategory( searchTerm ),
			userParameter = {
				negativeSearch: searchTerm.charAt( 0 ) === '-',
				searchTermNum: searchTermNum
			};

		return $.ajax( {
			url: stringFormat( requestUrl, categoryString ),
			data: { userparam: JSON.stringify( userParameter ) },
			timeout: ajaxTimeout,
			dataType: 'jsonp',
			jsonp: 'callback',
			error: fatalAjaxError
		} );
	}

	/**
	 * Process all the AJAX responses from catgraph-jsonp, modify the search string and
	 * re-submit the search form.
	 *
	 * This function can receive an arbitrary number of parameters.
	 */
	function receiveAjaxResponses() {
		var i,
			ajaxResponse,
			responses = [],
			errors = [],
			newSearchTerms;

		DeepCat.ResponseErrors.reset();

		// single request leads to different variable structure
		if( typeof arguments[ 1 ] === 'string' ) {
			arguments = [ arguments ]; // jshint ignore:line
		}

		for( i = 0; i < arguments.length; i++ ) {
			ajaxResponse = arguments[ i ][ 0 ];

			if( arguments[ i ][ 1 ] !== 'success' ) {
				ajaxError( arguments[ i ] );
				return;
			} else if( ajaxResponse.status === 'OK' ) {
				ajaxSuccess( ajaxResponse );
				responses.push( ajaxResponse );
			} else {
				graphError( ajaxResponse );
				errors.push( ajaxResponse );
			}
		}

		newSearchTerms = deepCatSearchTerms.slice();
		newSearchTerms = DeepCat.computeResponses( responses, newSearchTerms );
		newSearchTerms = DeepCat.computeErrors( errors, newSearchTerms );

		logAndFinishRequest( newSearchTerms.join( ' ' ) );
	}

	function logAndFinishRequest( newSearchTermString ) {
		var logRequestUrl = '//tools.wmflabs.org/catgraph-jsonp/logrequestlength?searchquerylength={0}';
		return $.ajax( {
			url: stringFormat( logRequestUrl, newSearchTermString.length ),
			timeout: ajaxTimeout,
			cache: false,
			complete: function() {
				finishDeepCatRequest( newSearchTermString );
			}
		} );
	}

	function finishDeepCatRequest( newSearchTermString ) {
		substituteSearchRequest( newSearchTermString );
		removeAjaxThrobber();
		$( '#searchform' ).submit();
	}

	/**
	 * Replace "deepcat:" search terms with "incategory:" terms from DeepCat response
	 *
	 * @param {Array} responses Category search results
	 * @param {string[]} newSearchTerms Original search terms provided by the user
	 * @return {string[]} Modified newSearchTerms
	 */
	DeepCat.computeResponses = function( responses, newSearchTerms ) {
		var i,
			userParameters,
			newSearchTermString,
			errorMessages = [];

		for( i = 0; i < responses.length; i++ ) {
			userParameters = JSON.parse( responses[ i ].userparam );
			newSearchTermString = '';

			if( !responses[ i ].result || responses[ i ].result.length === 0 ) {
				// ensure we only display the message once, even when we have multiple empty results
				errorMessages[ 0 ] = createErrorMessage( 'deepcat-error-unexpected-response', null );
				newSearchTerms[ userParameters.searchTermNum ] = '';
				continue;
			}

			if( userParameters.negativeSearch ) {
				newSearchTermString += '-';
			}
			newSearchTermString += 'incategory:id:' + responses[ i ].result.join( '|id:' );

			newSearchTerms[ userParameters.searchTermNum ] = newSearchTermString;
		}

		for( i = 0; i < errorMessages.length; i++ ) {
			DeepCat.ResponseErrors.addError( errorMessages[ i ] );
		}

		return newSearchTerms;
	};

	/**
	 * Add error messages to search form, remove erroneous search terms
	 *
	 * @param {Array} errors Errors from DeepCat
	 * @param {string[]} newSearchTerms Original search terms provided by the user
	 * @return {string[]} Modified newSearchTerms
	 */
	DeepCat.computeErrors = function( errors, newSearchTerms ) {
		var i,
			userParameters,
			categoryError;

		for( i = 0; i < errors.length; i++ ) {
			userParameters = JSON.parse( errors[ i ].userparam );
			categoryError = errors[ i ].statusMessage.match( /(RuntimeError: Category \')(.*)(\' not found in wiki.*)/ );

			if( !categoryError ) {
				if( errors[ i ].statusMessage === 'Graph not found' ) {
					DeepCat.ResponseErrors.addError(
						createErrorMessage( 'deepcat-error-unknown-graph', null )
					);
				} else { // Unknown error message, shouldn't happen
					DeepCat.ResponseErrors.addError(
						createErrorMessage( 'deepcat-error-unexpected-response', null )
					);
				}
			} else if( categoryError[ 2 ].length === 0 ) {
				DeepCat.ResponseErrors.addError(
					createErrorMessage( 'deepcat-missing-category', null )
				);
			} else if( categoryError[ 2 ].length > 0 ) {
				DeepCat.ResponseErrors.addError(
					createErrorMessage( 'deepcat-error-notfound', categoryError[ 2 ] )
				);
			}

			newSearchTerms[ userParameters.searchTermNum ] = '';
		}

		DeepCat.addErrorMsgField( DeepCat.ResponseErrors.getErrors() );
		return newSearchTerms;
	};

	function createErrorMessage( mwMessage, parameter ) {
		return {
			mwMessage: mwMessage,
			parameter: parameter
		};
	}

	function ajaxSuccess( data ) {
		mw.log( 'graph & ajax request successful' );
		mw.log( 'statusMessage: ' + data.statusMessage );
	}

	function graphError( data ) {
		mw.log( 'graph request failed' );
		mw.log( 'statusMessage: ' + data.statusMessage );
	}

	function ajaxError( data ) {
		mw.log( 'ajax request error: ' + JSON.stringify( data ) );
		DeepCat.addErrorMsgField( [ createErrorMessage( 'deepcat-error-tooldown', null ) ] );

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

	DeepCat.addErrorMsgField = function( errorMessages ) {
		if( errorMessages.length > 0 ) {
			$( '<input>' ).attr( {
				type: 'hidden',
				name: 'deepCatError',
				value: JSON.stringify( errorMessages )
			} ).appendTo( '#searchform' );
		}
	};

	function showErrorMessage( message ) {
		var output = mw.html.element( 'div', { 'class': 'searchresults' }, new mw.html.Raw(
			mw.html.element( 'div', { 'class': 'error' }, message )
		) );
		$( '#search' ).after( output );
	}

	function substituteInputValues( input ) {
		$( '[name="search"]' ).val( input );
	}

	function substituteTitle( input ) {
		loadMessages( 'searchresults-title' ).done( function() {
			$( document ).prop( 'title', mw.msg( 'searchresults-title', input ) );
		} );
	}

	function appendToSearchLinks( input ) {
		var attr = 'deepCatSearch=' + input;

		$( '.mw-prevlink, .mw-numlink, .mw-nextlink' ).each( function( index, link ) {
			var href = link.href.replace( /[?&]deepCatSearch=[^&]*/g, '' );
			link.href = href + ( href.indexOf( '?' ) === -1 ? '?' : '&' ) + attr;
		} );
	}

	/**
	 * @param {string} input
	 * @return {string[]}
	 */
	DeepCat.getSearchTerms = function( input ) {
		return input.match(
			// Search for keyword:"term including \"escaped\" quotes" as well as keyword:term.
			new RegExp(
				'-?\\b' + keyString + '\\s*(?:'
					+ '"(?:[^\\\\"]|\\\\.)+"' // quoted strings including spaces and escaped quotes
					+ '|(?!-?' + keyString + ')\\S+' // unquoted strings, but skip duplicate keywords
					+ ')|\\S+', // fetch remaining non-deepcat stuff
				'gi' ) );
	};

	/**
	 * @param {string} input
	 * @return {boolean}
	 */
	function matchesDeepCatKeyword( input ) {
		return new RegExp( '\\b' + keyString, 'i' ).test( input );
	}

	/**
	 * @param {string} searchTerm
	 * @return {string}
	 */
	function extractDeepCatCategory( searchTerm ) {
		searchTerm = searchTerm.replace( new RegExp( '\\s*-?\\b' + keyString + '\\s*', 'i' ), '' );

		if( /^\s*"/.test( searchTerm ) ) {
			searchTerm = searchTerm.replace( /^\s*"/, '' )
				.replace( /"\s*$/, '' )
				.replace( /\\(?=.)/g, '' );
		}

		return searchTerm.replace( /\s+/g, '_' );
	}

	function checkErrorMessage() {
		var deepCatErrors = mw.util.getParamValue( 'deepCatError' ),
			i,
			message;

		if( deepCatErrors ) {
			deepCatErrors = JSON.parse( deepCatErrors );
			deepCatErrors = deepCatErrors.reverse();

			for( i = 0; i < deepCatErrors.length; i++ ) {
				if( deepCatErrors[ i ].parameter ) {
					message = stringFormat( mw.msg( deepCatErrors[ i ].mwMessage ), deepCatErrors[ i ].parameter );
				} else {
					message = mw.msg( deepCatErrors[ i ].mwMessage );
				}
				showErrorMessage( message );
			}
		}
	}

	function refreshSearchTermMock() {
		var deepCatSearch = mw.util.getParamValue( 'deepCatSearch' );

		if( deepCatSearch && matchesDeepCatKeyword( deepCatSearch ) ) {
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
						+ '<img id="deepcat-smallhint-hide" title="' + mw.msg( 'deepcat-smallhint-close' ) + '" src="https://upload.wikimedia.org/wikipedia/commons/4/44/Curation_bar_icon_close.png">'
						+ mw.msg( 'deepcat-hintbox-small' )
						+ '</div>';
		$( '#searchform' ).after( smallHintBox );
		$( '#deepcat-smallhint-hide' ).on( 'click', hideSmallHint );
	}

	function hasHintCookie() {
		return mw.cookie.get( '-deepcat-hintboxshown' ) === makeHintboxCookieToken( mw.msg( 'deepcat-hintbox-text' ) );
	}

	function hideHints() {
		shouldHideHints = true;

		$( '#deepcat-hintbox' ).hide();
		hideSmallHint();
		enableImeAndSuggestions();

		mw.cookie.set(
			'-deepcat-hintboxshown',
			makeHintboxCookieToken( mw.msg( 'deepcat-hintbox-text' ) ),
			{ expires: 60 * 60 * 24 * 7 * 4 } // 4 weeks
		);
	}

	function hideSmallHint() {
		shouldHideSmallHint = true;

		$( '#deepcat-smallhint' ).hide();
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
		/*jshint bitwise: false*/
		var hash = 5381,
			i;

		for( i = 0; i < str.length; i++ ) {
			hash = ( hash << 5 ) + hash + str.charCodeAt( i );
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
	 * @param {string} message
	 * @return {string}
	 */
	function stringFormat( message ) {
		var i;

		for( i = 0; i < arguments.length - 1; i++ ) {
			message = message.replace( new RegExp( '\\{' + i + '\\}', 'g' ), arguments[ i + 1 ] );
		}

		return message;
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
				if( message.missing !== '' ) {
					mw.messages.set( message.name, message[ '*' ] );
				}
			} );
		} );
	}

	mw.libs.deepCat = DeepCat;

}( jQuery, mediaWiki ) );
