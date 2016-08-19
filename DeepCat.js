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
		maxResults = 70,
		ajaxTimeout = 10000,
		deepCatSearchTerms,
		shouldHideHints = false,
		shouldHideSmallHint = false,
		interfaceUrl = '//tools.wmflabs.org/catgraph-jsonp/',
		mainSearchFormId;

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
				'<a style="float:left" href="//de.wikipedia.org/wiki/Hilfe:Suche/Deepcat" target="_blank">Weitere Informationen</a>',
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
				'<a style="float:left" href="//wikitech.wikimedia.org/wiki/Nova_Resource:Catgraph/Deepcat"  target="_blank">Additional information</a>',
				'deepcat-hintbox-small': 'Max. category-depth: ' + maxDepth + '<br/>Max. categories: ' + maxResults
			} );
			break;
	}

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

	DeepCat.sendAjaxRequests = function( searchTerms ) {
		var i,
			requests = [];

		DeepCat.addAjaxThrobber();

		for( i = 0; i < searchTerms.length; i++ ) {
			if( DeepCat.matchesDeepCatKeyword( searchTerms[ i ] ) ) {
				requests.push( DeepCat.getAjaxRequest( searchTerms[ i ], i ) );
			}
		}

		$.when.apply( this, requests ).done( DeepCat.receiveAjaxResponses );
	};

	DeepCat.getAjaxRequest = function( searchTerm, searchTermNum ) {
		var categoryString = DeepCat.extractDeepCatCategory( searchTerm ),
			userParameter = {
				negativeSearch: searchTerm.charAt( 0 ) === '-',
				searchTermNum: searchTermNum
			};

		return $.ajax( {
			url: DeepCat.getAjaxRequestUrl( categoryString ),
			data: { userparam: JSON.stringify( userParameter ) },
			timeout: ajaxTimeout,
			dataType: 'jsonp',
			jsonp: 'callback',
			error: DeepCat.fatalAjaxError
		} );
	};

	DeepCat.getAjaxRequestUrl = function( categoryString ) {
		return interfaceUrl + mw.config.get( 'wgDBname' )
			+ '_ns14/traverse-successors%20Category:'
			+ categoryString + '%20'
			+ maxDepth + '%20'
			+ maxResults;
	};

	/**
	 * Process all the AJAX responses from catgraph-jsonp, modify the search string and
	 * re-submit the search form.
	 *
	 * This function can receive an arbitrary number of parameters.
	 */
	DeepCat.receiveAjaxResponses = function() {
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
				DeepCat.ajaxError( arguments[ i ] );
				return;
			} else if( ajaxResponse.status === 'OK' ) {
				DeepCat.ajaxSuccess( ajaxResponse );
				responses.push( ajaxResponse );
			} else {
				DeepCat.graphError( ajaxResponse );
				errors.push( ajaxResponse );
			}
		}

		newSearchTerms = deepCatSearchTerms.slice();
		newSearchTerms = DeepCat.computeResponses( responses, newSearchTerms );
		newSearchTerms = DeepCat.computeErrors( errors, newSearchTerms );

		DeepCat.logAndFinishRequest( newSearchTerms.join( ' ' ) );
	};

	DeepCat.logAndFinishRequest = function( newSearchTermString ) {
		$.ajax( {
			url: DeepCat.getLogRequestUrl( newSearchTermString.length ),
			timeout: ajaxTimeout,
			cache: false,
			complete: function() {
				DeepCat.finishDeepCatRequest( newSearchTermString );
			}
		} );
	};

	DeepCat.getLogRequestUrl = function( newSearchTermStringLength ) {
		return interfaceUrl + 'logrequestlength?'
			+ 'searchquerylength=' + newSearchTermStringLength;
	};

	DeepCat.finishDeepCatRequest = function( newSearchTermString ) {
		DeepCat.substituteSearchRequest( newSearchTermString );
		DeepCat.removeAjaxThrobber();
		$( mainSearchFormId ).submit();
	};

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
				errorMessages[ 0 ] = DeepCat.createErrorMessage( 'deepcat-error-unexpected-response', null );
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
						DeepCat.createErrorMessage( 'deepcat-error-unknown-graph', null )
					);
				} else { // Unknown error message, shouldn't happen
					DeepCat.ResponseErrors.addError(
						DeepCat.createErrorMessage( 'deepcat-error-unexpected-response', null )
					);
				}
			} else if( categoryError[ 2 ].length === 0 ) {
				DeepCat.ResponseErrors.addError(
					DeepCat.createErrorMessage( 'deepcat-missing-category', null )
				);
			} else if( categoryError[ 2 ].length > 0 ) {
				DeepCat.ResponseErrors.addError(
					DeepCat.createErrorMessage( 'deepcat-error-notfound', categoryError[ 2 ] )
				);
			}

			newSearchTerms[ userParameters.searchTermNum ] = '';
		}

		DeepCat.addErrorMsgField( DeepCat.ResponseErrors.getErrors(), mainSearchFormId );
		return newSearchTerms;
	};

	DeepCat.createErrorMessage = function( mwMessage, parameter ) {
		return {
			mwMessage: mwMessage,
			parameter: parameter
		};
	};

	DeepCat.ajaxSuccess = function( data ) {
		mw.log( 'graph & ajax request successful' );
		mw.log( 'statusMessage: ' + data.statusMessage );
	};

	DeepCat.graphError = function( data ) {
		mw.log( 'graph request failed' );
		mw.log( 'statusMessage: ' + data.statusMessage );
	};

	DeepCat.ajaxError = function( data ) {
		mw.log( 'ajax request error: ' + JSON.stringify( data ) );

		DeepCat.addErrorMsgField( [ createErrorMessage( 'deepcat-error-tooldown', null ) ] );
		DeepCat.substituteSearchRequest( ' ' );
		$( mainSearchFormId ).submit();
	};

	DeepCat.fatalAjaxError = function( data, error ) {
		DeepCat.removeAjaxThrobber();
		DeepCat.ajaxError( error );
	};

	DeepCat.substituteSearchRequest = function( searchString ) {
		$( '[name="search"]' ).attr( 'name', 'deepCatSearch' );
		$( '<input>' ).attr( {
			type: 'hidden',
			name: 'search',
			value: searchString
		} ).appendTo( mainSearchFormId );
	};

	DeepCat.addErrorMsgField = function( errorMessages ) {
		if( errorMessages.length > 0 ) {
			$( '<input>' ).attr( {
				type: 'hidden',
				name: 'deepCatError',
				value: JSON.stringify( errorMessages )
			} ).appendTo( mainSearchFormId );
		}
	};

	DeepCat.showErrorMessage = function( message ) {
		var output = mw.html.element( 'div', { 'class': 'searchresults' }, new mw.html.Raw(
			mw.html.element( 'div', { 'class': 'error' }, message )
		) );
		$( '#search' ).after( output );
		$( '#powersearch' ).after( output );
	};

	DeepCat.substituteInputValues = function( input ) {
		$( '[name="search"]' ).val( input );
	};

	DeepCat.substituteTitle = function( input ) {
		$( document ).prop( 'title', mw.msg( 'searchresults-title', input ) );
	};

	DeepCat.appendToSearchLinks = function( input ) {
		var attr = 'deepCatSearch=' + input;

		$( '.mw-prevlink, .mw-numlink, .mw-nextlink' ).each( function( index, link ) {
			var href = link.href.replace( /[?&]deepCatSearch=[^&]*/g, '' );
			link.href = href + ( href.indexOf( '?' ) === -1 ? '?' : '&' ) + attr;
		} );
		$( '.mw-search-profile-tabs' ).find( 'a' ).each( function( index, link ) {
			var href = link.href.replace( /[?&]deepCatSearch=[^&]*/g, '' );
			link.href = href + ( href.indexOf( '?' ) === -1 ? '?' : '&' ) + attr;
		} );
	};

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
	DeepCat.matchesDeepCatKeyword = function( input ) {
		return new RegExp( '\\b' + keyString, 'i' ).test( input );
	};

	/**
	 * @param {string} searchTerm
	 * @return {string}
	 */
	DeepCat.extractDeepCatCategory = function( searchTerm ) {
		searchTerm = searchTerm.replace( new RegExp( '\\s*-?\\b' + keyString + '\\s*', 'i' ), '' );

		if( /^\s*"/.test( searchTerm ) ) {
			searchTerm = searchTerm.replace( /^\s*"/, '' )
				.replace( /"\s*$/, '' )
				.replace( /\\(?=.)/g, '' );
		}

		return removeUnicodeNonPrintables( replaceWhiteSpace( searchTerm ) );
	};

	DeepCat.checkErrorMessage = function() {
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
				DeepCat.showErrorMessage( message );
			}
		}
	};

	DeepCat.refreshSearchTermMock = function() {
		var deepCatSearch = mw.util.getParamValue( 'deepCatSearch' );

		if( deepCatSearch && DeepCat.matchesDeepCatKeyword( deepCatSearch ) ) {
			deepCatSearch = deepCatSearch.replace( /\+/g, ' ' );

			DeepCat.substituteInputValues( deepCatSearch );
			DeepCat.substituteTitle( deepCatSearch );
			DeepCat.appendToSearchLinks( deepCatSearch );
			return true;
		}
		return false;
	};

	DeepCat.addAjaxThrobber = function() {
		$( '#searchButton, #mw-searchButton' ).addClass( 'deep-cat-throbber-small' );
		$( '#searchText' ).addClass( 'deep-cat-throbber-big' );
		$( '#powerSearchText' ).addClass( 'deep-cat-throbber-big' );
	};

	DeepCat.removeAjaxThrobber = function() {
		$( '#searchButton, #mw-searchButton' ).removeClass( 'deep-cat-throbber-small' );
		$( '#searchText' ).removeClass( 'deep-cat-throbber-big' );
		$( '#powerSearchText' ).removeClass( 'deep-cat-throbber-big' );
	};

	DeepCat.addSearchFormHint = function() {
		var hintBox = '<div id="deepcat-hintbox" style="display: none;">'
			+ '<img id="deepcat-info-img" src="//upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Information_icon4.svg/40px-Information_icon4.svg.png"/>  '
			+ '<div>'
			+ mw.msg( 'deepcat-hintbox-text' )
			+ '&nbsp;<a id="deepcat-hint-hide">' + mw.msg( 'deepcat-hintbox-close' ) + '</a>'
			+ '</div></div>';
		$( '#search' ).after( hintBox );
		$( '#powersearch' ).after( hintBox );
		$( '#deepcat-hint-hide' ).on( 'click', DeepCat.hideHints );
	};

	DeepCat.addSmallFormHint = function() {
		var smallHintBox = '<div id="deepcat-smallhint">'
			+ '<img id="deepcat-smallhint-hide" title="' + mw.msg( 'deepcat-smallhint-close' ) + '" src="https://upload.wikimedia.org/wikipedia/commons/4/44/Curation_bar_icon_close.png">'
			+ mw.msg( 'deepcat-hintbox-small' )
			+ '</div>';
		$( '#searchform' ).after( smallHintBox );
		$( '#deepcat-smallhint-hide' ).on( 'click', DeepCat.hideSmallHint );
	};

	DeepCat.hasHintCookie = function() {
		return mw.cookie.get( '-deepcat-hintboxshown' ) === DeepCat.makeHintboxCookieToken( mw.msg( 'deepcat-hintbox-text' ) );
	};

	DeepCat.hideHints = function() {
		shouldHideHints = true;

		$( '#deepcat-hintbox' ).hide();
		DeepCat.hideSmallHint();
		DeepCat.enableImeAndSuggestions();

		mw.cookie.set(
			'-deepcat-hintboxshown',
			makeHintboxCookieToken( mw.msg( 'deepcat-hintbox-text' ) ),
			{ expires: 60 * 60 * 24 * 7 * 4 } // 4 weeks
		);
	};

	DeepCat.hideSmallHint = function() {
		shouldHideSmallHint = true;

		$( '#deepcat-smallhint' ).hide();
	};

	DeepCat.disableImeAndSuggestions = function() {
		$( '.suggestions' ).css( 'z-index', -1 );
		$( '.imeselector' ).css( 'z-index', -1 );
	};

	DeepCat.enableImeAndSuggestions = function() {
		$( '.suggestions' ).css( 'z-index', 'auto' );
		$( '.imeselector' ).css( 'z-index', 'auto' );
	};

	DeepCat.getMainSearchFormId = function() {
		if( DeepCat.advancedSearchFormIsPresent() ) {
			return '#powersearch';
		} else {
			return '#searchform';
		}
	};

	DeepCat.advancedSearchFormIsPresent = function() {
		return $( '#powersearch' ).length > 0;
	};

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
	 * Filter to get rid of unprintable unicode chars.
	 * @see https://github.com/wikimedia/mediawiki/blob/master/includes/title/MediaWikiTitleCodec.php#L220
	 * @param {string} str
	 * @return {string}
	 */
	function removeUnicodeNonPrintables( str ) {
		var re = /[\u200E\u200F\u202A-\u202E]/g;
		return str.replace( re, '' );
	}

	/**
	 * Replace whits-paces with underscores
	 * @see https://github.com/wikimedia/mediawiki/blob/master/includes/title/MediaWikiTitleCodec.php#L227
	 * @param {string} str
	 * @return {string}
	 */
	function replaceWhiteSpace( str ) {
		var re = /[ _\u00A0\u1680\u180E\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+/g;
		return str.replace( re, '_' );
	}

	/**
	 * @param {string} str
	 * @return {string}
	 */
	DeepCat.makeHintboxCookieToken = function( str ) {
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

	DeepCat.main = function() {
		shouldHideHints = DeepCat.hasHintCookie();
		mainSearchFormId = DeepCat.getMainSearchFormId();

		$( '#searchform, #search, #powersearch' ).on( 'submit', function( e ) {
			var searchInput = $( this ).find( '[name="search"]' ).val();

			if( DeepCat.matchesDeepCatKeyword( searchInput ) ) {
				deepCatSearchTerms = DeepCat.getSearchTerms( searchInput );

				e.preventDefault();

				mw.log( 'deepCatSearchTerms: ' + deepCatSearchTerms );

				// bugfix to sync search fields for better recovery of "deepCatSearch"
				DeepCat.substituteInputValues( searchInput );

				DeepCat.sendAjaxRequests( deepCatSearchTerms );
			}
		} );

		if( !shouldHideHints ) {
			DeepCat.addSearchFormHint();
			DeepCat.addSmallFormHint();

			$( '#searchText' ).find( ':input' ).on( 'keyup', function() {
				if( DeepCat.matchesDeepCatKeyword( $( this ).val() ) && !shouldHideHints ) {
					$( '#deepcat-hintbox' ).slideDown();
				} else {
					$( '#deepcat-hintbox' ).slideUp();
				}
			} );

			$( '#powerSearchText' ).find( ':input' ).on( 'keyup', function() {
				if( DeepCat.matchesDeepCatKeyword( $( this ).val() ) && !shouldHideHints ) {
					$( '#deepcat-hintbox' ).slideDown();
				} else {
					$( '#deepcat-hintbox' ).slideUp();
				}
			} );

			$( '#searchInput' ).on( 'keyup', function() {
				if( DeepCat.matchesDeepCatKeyword( $( this ).val() ) && !shouldHideHints && !shouldHideSmallHint ) {
					DeepCat.disableImeAndSuggestions();
					$( '#deepcat-smallhint' ).slideDown( 'fast' );
				} else {
					DeepCat.enableImeAndSuggestions();
					$( '#deepcat-smallhint' ).slideUp( 'fast' );
				}
			} );
		}

		if( DeepCat.refreshSearchTermMock() ) {
			if( !shouldHideHints ) {
				$( '#deepcat-hintbox' ).show();
			}
			DeepCat.checkErrorMessage();
		}
	};

	$( function() {
		$.when( mw.loader.using( [ 'mediawiki.api.messages', 'mediawiki.jqueryMsg' ] ), $.ready ).done( function() {
			new mw.Api().loadMessagesIfMissing( [ 'searchresults-title' ] ).done( function() {
				DeepCat.main();
			} );
		} );
	} );

	mw.libs.deepCat = DeepCat;

}( jQuery, mediaWiki ) );
