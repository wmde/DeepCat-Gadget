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

	$( function() {
		shouldHideHints = hasHintCookie();
		mainSearchFormId = getMainSearchFormId();

		$( '#searchform, #search, #powersearch' ).on( 'submit', function( e ) {
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

			$( '#powerSearchText' ).find( ':input' ).on( 'keyup', function() {
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
		var categoryString = DeepCat.extractDeepCatCategory( searchTerm ),
			userParameter = {
				negativeSearch: searchTerm.charAt( 0 ) === '-',
				searchTermNum: searchTermNum
			};

		return $.ajax( {
			url: getAjaxRequestUrl( categoryString ),
			data: { userparam: JSON.stringify( userParameter ) },
			timeout: ajaxTimeout,
			dataType: 'jsonp',
			jsonp: 'callback',
			error: fatalAjaxError
		} );
	}

	function getAjaxRequestUrl( categoryString ) {
		return interfaceUrl + mw.config.get( 'wgDBname' )
			+ '_ns14/traverse-successors%20Category:'
			+ categoryString + '%20'
			+ maxDepth + '%20'
			+ maxResults;
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
		$.ajax( {
			url: getLogRequestUrl( newSearchTermString.length ),
			timeout: ajaxTimeout,
			cache: false,
			complete: function() {
				finishDeepCatRequest( newSearchTermString );
			}
		} );
	}

	function getLogRequestUrl( newSearchTermStringLength ) {
		return interfaceUrl + 'logrequestlength?'
			+ 'searchquerylength=' + newSearchTermStringLength;
	}

	function finishDeepCatRequest( newSearchTermString ) {
		substituteSearchRequest( newSearchTermString );
		removeAjaxThrobber();
		$( mainSearchFormId ).submit();
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

		DeepCat.addErrorMsgField( DeepCat.ResponseErrors.getErrors(), mainSearchFormId );
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
		$( mainSearchFormId ).submit();
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
		} ).appendTo( mainSearchFormId );
	}

	DeepCat.addErrorMsgField = function( errorMessages ) {
		if( errorMessages.length > 0 ) {
			$( '<input>' ).attr( {
				type: 'hidden',
				name: 'deepCatError',
				value: JSON.stringify( errorMessages )
			} ).appendTo( mainSearchFormId );
		}
	};

	function showErrorMessage( message ) {
		var output = mw.html.element( 'div', { 'class': 'searchresults' }, new mw.html.Raw(
			mw.html.element( 'div', { 'class': 'error' }, message )
		) );
		$( '#search' ).after( output );
		$( '#powersearch' ).after( output );
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
		$( '.mw-search-profile-tabs' ).find( 'a' ).each( function( index, link ) {
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
	DeepCat.extractDeepCatCategory = function( searchTerm ) {
		searchTerm = searchTerm.replace( new RegExp( '\\s*-?\\b' + keyString + '\\s*', 'i' ), '' );

		if( /^\s*"/.test( searchTerm ) ) {
			searchTerm = searchTerm.replace( /^\s*"/, '' )
				.replace( /"\s*$/, '' )
				.replace( /\\(?=.)/g, '' );
		}

		return removeUnicodeNonPrintables( searchTerm.replace( /\s+/g, '_' ) );
	};

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
		$( '#powerSearchText' ).addClass( 'deep-cat-throbber-big' );
	}

	function removeAjaxThrobber() {
		$( '#searchButton, #mw-searchButton' ).removeClass( 'deep-cat-throbber-small' );
		$( '#searchText' ).removeClass( 'deep-cat-throbber-big' );
		$( '#powerSearchText' ).removeClass( 'deep-cat-throbber-big' );
	}

	function addSearchFormHint() {
		var hintBox = '<div id="deepcat-hintbox" style="display: none;">'
			+ '<img id="deepcat-info-img" src="//upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Information_icon4.svg/40px-Information_icon4.svg.png"/>  '
			+ '<div>'
			+ mw.msg( 'deepcat-hintbox-text' )
			+ '&nbsp;<a id="deepcat-hint-hide">' + mw.msg( 'deepcat-hintbox-close' ) + '</a>'
			+ '</div></div>';
		$( '#search' ).after( hintBox );
		$( '#powersearch' ).after( hintBox );
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

	function getMainSearchFormId() {
		if( advancedSearchFormIsPresent() ) {
			return '#powersearch';
		} else {
			return '#searchform';
		}
	}

	function advancedSearchFormIsPresent() {
		return $( '#powersearch' ).length > 0;
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
	 * Hash function for generating hint box cookie token.
	 * @see https://stackoverflow.com/questions/11598786/how-to-replace-non-printable-unicode-characters-javascript/11598864#11598864
	 * @param {string} str
	 * @return {string}
	 */
	function removeUnicodeNonPrintables( str ) {
		var re = /[\00-\x1F\x7F-\x9F\xAD\u0378\u0379\u037F-\u0383\u038B\u038D\u03A2\u0528-\u0530\u0557\u0558\u0560\u0588\u058B-\u058E\u0590\u05C8-\u05CF\u05EB-\u05EF\u05F5-\u0605\u061C\u061D\u06DD\u070E\u070F\u074B\u074C\u07B2-\u07BF\u07FB-\u07FF\u082E\u082F\u083F\u085C\u085D\u085F-\u089F\u08A1\u08AD-\u08E3\u08FF\u0978\u0980\u0984\u098D\u098E\u0991\u0992\u09A9\u09B1\u09B3-\u09B5\u09BA\u09BB\u09C5\u09C6\u09C9\u09CA\u09CF-\u09D6\u09D8-\u09DB\u09DE\u09E4\u09E5\u09FC-\u0A00\u0A04\u0A0B-\u0A0E\u0A11\u0A12\u0A29\u0A31\u0A34\u0A37\u0A3A\u0A3B\u0A3D\u0A43-\u0A46\u0A49\u0A4A\u0A4E-\u0A50\u0A52-\u0A58\u0A5D\u0A5F-\u0A65\u0A76-\u0A80\u0A84\u0A8E\u0A92\u0AA9\u0AB1\u0AB4\u0ABA\u0ABB\u0AC6\u0ACA\u0ACE\u0ACF\u0AD1-\u0ADF\u0AE4\u0AE5\u0AF2-\u0B00\u0B04\u0B0D\u0B0E\u0B11\u0B12\u0B29\u0B31\u0B34\u0B3A\u0B3B\u0B45\u0B46\u0B49\u0B4A\u0B4E-\u0B55\u0B58-\u0B5B\u0B5E\u0B64\u0B65\u0B78-\u0B81\u0B84\u0B8B-\u0B8D\u0B91\u0B96-\u0B98\u0B9B\u0B9D\u0BA0-\u0BA2\u0BA5-\u0BA7\u0BAB-\u0BAD\u0BBA-\u0BBD\u0BC3-\u0BC5\u0BC9\u0BCE\u0BCF\u0BD1-\u0BD6\u0BD8-\u0BE5\u0BFB-\u0C00\u0C04\u0C0D\u0C11\u0C29\u0C34\u0C3A-\u0C3C\u0C45\u0C49\u0C4E-\u0C54\u0C57\u0C5A-\u0C5F\u0C64\u0C65\u0C70-\u0C77\u0C80\u0C81\u0C84\u0C8D\u0C91\u0CA9\u0CB4\u0CBA\u0CBB\u0CC5\u0CC9\u0CCE-\u0CD4\u0CD7-\u0CDD\u0CDF\u0CE4\u0CE5\u0CF0\u0CF3-\u0D01\u0D04\u0D0D\u0D11\u0D3B\u0D3C\u0D45\u0D49\u0D4F-\u0D56\u0D58-\u0D5F\u0D64\u0D65\u0D76-\u0D78\u0D80\u0D81\u0D84\u0D97-\u0D99\u0DB2\u0DBC\u0DBE\u0DBF\u0DC7-\u0DC9\u0DCB-\u0DCE\u0DD5\u0DD7\u0DE0-\u0DF1\u0DF5-\u0E00\u0E3B-\u0E3E\u0E5C-\u0E80\u0E83\u0E85\u0E86\u0E89\u0E8B\u0E8C\u0E8E-\u0E93\u0E98\u0EA0\u0EA4\u0EA6\u0EA8\u0EA9\u0EAC\u0EBA\u0EBE\u0EBF\u0EC5\u0EC7\u0ECE\u0ECF\u0EDA\u0EDB\u0EE0-\u0EFF\u0F48\u0F6D-\u0F70\u0F98\u0FBD\u0FCD\u0FDB-\u0FFF\u10C6\u10C8-\u10CC\u10CE\u10CF\u1249\u124E\u124F\u1257\u1259\u125E\u125F\u1289\u128E\u128F\u12B1\u12B6\u12B7\u12BF\u12C1\u12C6\u12C7\u12D7\u1311\u1316\u1317\u135B\u135C\u137D-\u137F\u139A-\u139F\u13F5-\u13FF\u169D-\u169F\u16F1-\u16FF\u170D\u1715-\u171F\u1737-\u173F\u1754-\u175F\u176D\u1771\u1774-\u177F\u17DE\u17DF\u17EA-\u17EF\u17FA-\u17FF\u180F\u181A-\u181F\u1878-\u187F\u18AB-\u18AF\u18F6-\u18FF\u191D-\u191F\u192C-\u192F\u193C-\u193F\u1941-\u1943\u196E\u196F\u1975-\u197F\u19AC-\u19AF\u19CA-\u19CF\u19DB-\u19DD\u1A1C\u1A1D\u1A5F\u1A7D\u1A7E\u1A8A-\u1A8F\u1A9A-\u1A9F\u1AAE-\u1AFF\u1B4C-\u1B4F\u1B7D-\u1B7F\u1BF4-\u1BFB\u1C38-\u1C3A\u1C4A-\u1C4C\u1C80-\u1CBF\u1CC8-\u1CCF\u1CF7-\u1CFF\u1DE7-\u1DFB\u1F16\u1F17\u1F1E\u1F1F\u1F46\u1F47\u1F4E\u1F4F\u1F58\u1F5A\u1F5C\u1F5E\u1F7E\u1F7F\u1FB5\u1FC5\u1FD4\u1FD5\u1FDC\u1FF0\u1FF1\u1FF5\u1FFF\u200B-\u200F\u202A-\u202E\u2060-\u206F\u2072\u2073\u208F\u209D-\u209F\u20BB-\u20CF\u20F1-\u20FF\u218A-\u218F\u23F4-\u23FF\u2427-\u243F\u244B-\u245F\u2700\u2B4D-\u2B4F\u2B5A-\u2BFF\u2C2F\u2C5F\u2CF4-\u2CF8\u2D26\u2D28-\u2D2C\u2D2E\u2D2F\u2D68-\u2D6E\u2D71-\u2D7E\u2D97-\u2D9F\u2DA7\u2DAF\u2DB7\u2DBF\u2DC7\u2DCF\u2DD7\u2DDF\u2E3C-\u2E7F\u2E9A\u2EF4-\u2EFF\u2FD6-\u2FEF\u2FFC-\u2FFF\u3040\u3097\u3098\u3100-\u3104\u312E-\u3130\u318F\u31BB-\u31BF\u31E4-\u31EF\u321F\u32FF\u4DB6-\u4DBF\u9FCD-\u9FFF\uA48D-\uA48F\uA4C7-\uA4CF\uA62C-\uA63F\uA698-\uA69E\uA6F8-\uA6FF\uA78F\uA794-\uA79F\uA7AB-\uA7F7\uA82C-\uA82F\uA83A-\uA83F\uA878-\uA87F\uA8C5-\uA8CD\uA8DA-\uA8DF\uA8FC-\uA8FF\uA954-\uA95E\uA97D-\uA97F\uA9CE\uA9DA-\uA9DD\uA9E0-\uA9FF\uAA37-\uAA3F\uAA4E\uAA4F\uAA5A\uAA5B\uAA7C-\uAA7F\uAAC3-\uAADA\uAAF7-\uAB00\uAB07\uAB08\uAB0F\uAB10\uAB17-\uAB1F\uAB27\uAB2F-\uABBF\uABEE\uABEF\uABFA-\uABFF\uD7A4-\uD7AF\uD7C7-\uD7CA\uD7FC-\uF8FF\uFA6E\uFA6F\uFADA-\uFAFF\uFB07-\uFB12\uFB18-\uFB1C\uFB37\uFB3D\uFB3F\uFB42\uFB45\uFBC2-\uFBD2\uFD40-\uFD4F\uFD90\uFD91\uFDC8-\uFDEF\uFDFE\uFDFF\uFE1A-\uFE1F\uFE27-\uFE2F\uFE53\uFE67\uFE6C-\uFE6F\uFE75\uFEFD-\uFF00\uFFBF-\uFFC1\uFFC8\uFFC9\uFFD0\uFFD1\uFFD8\uFFD9\uFFDD-\uFFDF\uFFE7\uFFEF-\uFFFB\uFFFE\uFFFF]/g;
		return str.replace( re, '' );
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
