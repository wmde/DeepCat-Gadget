/**
 * DeepCat Gadget for MediaWiki
 * using JSONP CatGraph interface https://github.com/wmde/catgraph-jsonp
 * report issues / feature requests https://github.com/wmde/DeepCat-Gadget
 * @licence GNU GPL v2+
 * @author Christoph Fischer < christoph.fischer@wikimedia.de >
 */
( function( $, mw ) {
	var DeepCat = {};

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
				'deepcat-error-unexpected-response': "CatGraph-Tool lieferte ein unerwartetes Ergebnis.",
				'deepcat-missing-category': 'Bitte gib eine Kategorie ein.',
				'deepcat-hintbox-close': 'Ausblenden',
				'deepcat-hintbox-text': 'Du benutzt die <a href="//wikitech.wikimedia.org/wiki/Nova_Resource:Catgraph/Documentation">Catgraph</a>-basierte Erweiterung der Suche mit dem <a href="//github.com/wmde/DeepCat-Gadget">DeepCat-Gadget</a>. ' +
				'Diese Funktionalit&auml;t befindet sich in Entwicklung und unterliegt derzeit folgenden Einschr&auml;nkungen:' +
				'<ul>' +
				'<li>Die maximale Suchtiefe (Unterkategorien von Unterkategorien... usw) betr&auml;gt 10</li>' +
				'<li>Die maximale Anzahl durchsuchter Kategorien pro <i>deepcat</i>-Keyword betr&auml;gt 50</li>' +
				'</ul>' +
				'Solltest du Fragen oder Vorschl&auml;ge haben oder Fehler bemerken, beteilige dich bitte an der ' +
				'<a href="//de.wikipedia.org/wiki/Wikipedia_Diskussion:Umfragen/Technische_Wünsche/Top_20#R.C3.BCckmeldungen_und_Fragen_zu_DeepCat">Diskussion</a>.'
			} );
			break;
		case 'en':
		default:
			mw.messages.set( {
				'deepcat-error-notfound': 'CatGraph could not find the category \'{0}\'.',
				'deepcat-error-tooldown': 'CatGraph-Tool is not reachable.',
				'deepcat-error-unknown-graph': 'The Wiki is not supported by CatGraph.',
				'deepcat-error-unexpected-response': "CatGraph-Tool returned an unexpected response.",
				'deepcat-missing-category': 'Please insert a category.',
				'deepcat-hintbox-close': 'Hide',
				'deepcat-hintbox-text': 'You are using the <a href="//wikitech.wikimedia.org/wiki/Nova_Resource:Catgraph/Documentation">Catgraph</a>-based search extension with the <a href="//github.com/wmde/DeepCat-Gadget">DeepCat Gadget</a>. ' +
				'This functionality is under development. Currently it has the following limitations:' +
				'<ul>' +
				'<li>The maximum search depth (subcategories of subcategories... etc) is 10</li>' +
				'<li>At most 50 categories are searched per <i>deepcat</i> keyword' +
				'</ul>' +
				'If you have questions or suggestions or if you experience problems, please join the ' +
				'<a href="//de.wikipedia.org/wiki/Wikipedia_Diskussion:Umfragen/Technische_Wünsche/Top_20#R.C3.BCckmeldungen_und_Fragen_zu_DeepCat">discussion</a>.'
			} );
			break;
	}

	$( function() {
		$( '#searchform, #search' ).on( 'submit', function( e ) {
			var searchInput = $( this ).find( '[name="search"]' ).val();

			if ( matchesDeepCatKeyword( searchInput ) ) {
				deepCatSearchTerms = DeepCat.getSearchTerms( searchInput );

				e.preventDefault();

				mw.log( 'deepCatSearchTerms: ' + deepCatSearchTerms );

				//bugfix to sync search fields for better recovery of "deepCatSearch"
				substituteInputValues( searchInput );

				sendAjaxRequests( deepCatSearchTerms );
			}
		} );

		if ( refreshSearchTermMock() ) {
			showHint();
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
		errors:[]
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
	 * @returns {Array}
	 */
	DeepCat.ResponseErrors.getErrors = function() {
		return this.errors || [];
	};


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

		DeepCat.ResponseErrors.reset();
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

		newSearchTerms = computeResponses( responses, newSearchTerms );
		newSearchTerms = computeErrors( errors, newSearchTerms );

		substituteSearchRequest( newSearchTerms.join( ' ' ) );
		$( '#searchform' ).submit();
	}

	function computeResponses( responses, newSearchTerms ) {
		var i,
			userParameters,
			newSearchTermString,
			errorMessages = [];

		for ( i = 0; i < responses.length; i++ ) {
			userParameters = JSON.parse( responses[i]['userparam'] );
			newSearchTermString = '';

			if ( !responses[i]['result'] || responses[i]['result'].length == 0) {
				// ensure we only display the message once, even when we have multiple empty results
				errorMessages[0] = createErrorMessage( 'deepcat-error-unexpected-response', null );
				newSearchTerms[userParameters['searchTermNum']] = '';
			}

			if ( userParameters['negativeSearch'] ) {
				newSearchTermString += '-';
			}
			newSearchTermString += 'incategory:id:' + responses[i]['result'].join( '|id:' );

			newSearchTerms[userParameters['searchTermNum']] = newSearchTermString;
		}

		for ( i = 0; i < errorMessages.length; i++ ) {
			DeepCat.ResponseErrors.addError( errorMessages[i] );
		}

		return newSearchTerms;
	}

	function computeErrors( errors, newSearchTerms ) {
		var i,
			userParameters,
			categoryError;

		for ( i = 0; i < errors.length; i++ ) {
			userParameters = JSON.parse( errors[i]['userparam'] );
			categoryError = errors[i].statusMessage.match( /(RuntimeError: Category \')(.*)(\' not found in wiki.*)/ );

			if ( !categoryError ) {
				if ( 'Graph not found' == errors[i].statusMessage ) {
					DeepCat.ResponseErrors.addError(
						createErrorMessage( 'deepcat-error-unknown-graph', null )
					);
				} else { // Unknown error message, shouldn't happen
					DeepCat.ResponseErrors.addError(
						createErrorMessage( 'deepcat-error-unexpected-response', null )
					);
				}
			} else if ( categoryError[2].length === 0 ) {
				DeepCat.ResponseErrors.addError(
					createErrorMessage( 'deepcat-missing-category', null )
				);
			} else if ( categoryError[2].length > 0 ) {
				DeepCat.ResponseErrors.addError(
					createErrorMessage( 'deepcat-error-notfound', categoryError[2] )
				);
			}

			newSearchTerms[userParameters['searchTermNum']] = '';
		}

		addErrorMsgField( DeepCat.ResponseErrors.getErrors() );
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
	DeepCat.getSearchTerms = function( input ) {
		return input.match( new RegExp(
							'-?\\b' + keyString + '\\s*(?:'
							+ '"(?:[^\\\\"]|\\\\.)+"' //quoted strings including spaces and escaped quotes
							+ '|(?!-?' + keyString + ')\\S+' //unquoted strings, but skip duplicate keywords
							+ ')|\\S+', //fetch remaining non-deepcat stuff
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

		if ( /^\s*"/.test( searchTerm ) ) {
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

	function showHint() {
		if ( mw.cookie.get( '-deepcat-hintboxshown' ) != makeHintboxCookieToken( mw.msg( 'deepcat-hintbox-text' ) ) ) {
			var parent = document.getElementById( 'mw-content-text' );
			var sresults = document.getElementsByClassName( 'searchresults' )[0];
			var d = parent.insertBefore( document.createElement( 'div' ), sresults );
			d.style.marginTop = '1em';
			d.style.marginBottom = '1em';
			d.innerHTML =
				'<div id="deepcat-hintbox" style="background:#8af; padding:.75em; width:75%">' +
				mw.msg( 'deepcat-hintbox-text' ) +
				'</div>';
			var hideButton = document.createElement( 'button' );
			hideButton.innerHTML = mw.msg( 'deepcat-hintbox-close' );
			hideButton.onclick = hideHint;
			var buttonContainer = document.createElement( 'div' );
			buttonContainer.style.textAlign = 'right';
			buttonContainer.appendChild( hideButton );
			document.getElementById( 'deepcat-hintbox' ).appendChild( buttonContainer );
		}
	}

	function hideHint() {
		document.getElementById( 'deepcat-hintbox' ).style.display = 'none';
		mw.cookie.set( '-deepcat-hintboxshown', makeHintboxCookieToken( mw.msg( 'deepcat-hintbox-text' ) ), { 'expires': 60 * 60 * 24 * 7 * 4 /*4 weeks*/ } );
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

	mw.libs.deepCat = DeepCat;

}( jQuery, mediaWiki ) );
