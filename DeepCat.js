/**
 * DeepCat Gadget for MediaWiki
 * using JSONP CatGraph interface https://github.com/wmde/catgraph-jsonp
 * report issues / feature requests https://github.com/wmde/DeepCat-Gadget
 * @licence GNU GPL v2+
 * @author Christoph Fischer < christoph.fischer@wikimedia.de >
 */

(function () {
	var keyString = 'deepcat:', maxDepth = 10, maxResults = 50, ajaxTimeout = 10000, deepCatSearchTerms;
	var DBname = mw.config.get( 'wgDBname' );
	var requestUrl = '//tools.wmflabs.org/catgraph-jsonp/' + DBname + '_ns14/traverse-successors%20Category:{0}%20' + maxDepth + '%20' + maxResults;


	switch ( mw.config.get( 'wgUserLanguage' ) ) {
		case 'de':
		case 'de-at':
		case 'de-ch':
		case 'de-formal':
			mw.messages.set( {
				'deepcat-error-notfound': 'CatGraph konnte die Kategorie nicht finden.',
				'deepcat-error-tooldown': 'CatGraph-Tool ist zur Zeit nicht erreichbar.',
				'hintbox-close': 'Ausblenden',
				'hintbox-text': 'Du benutzt die <a href="//wikitech.wikimedia.org/wiki/Nova_Resource:Catgraph/Documentation">Catgraph</a>-basierte Suche mit dem <a href="//github.com/wmde/DeepCat-Gadget">DeepCat-Gadget</a>. ' +
					'Diese Funktionalität befindet sich in der Testphase und unterliegt derzeit folgenden Einschr&auml;nkungen:' +
					'<ul>' +
					'<li>Die maximale Suchtiefe (Unterkategorien von Unterkategorien... usw) betr&auml;gt 10</li>' +
					'<li>Die höchste Anzahl an durchsuchten Kategorien pro <i>deepcat</i>-Keyword betr&auml;gt 50</li>' +
					'</ul>' +
					'Solltest du Fragen oder Vorschl&auml;ge haben oder Fehler bemerken, beteilige dich bitte an der '+
						'<a href="//de.wikipedia.org/wiki/Wikipedia_Diskussion:Umfragen/Technische_Wünsche/Top_20#R.C3.BCckmeldungen_und_Fragen_zu_DeepCat">Diskussion</a>.'
			} );
			break;
		case 'en':
		default:
			mw.messages.set( {
				'deepcat-error-notfound': 'CatGraph could not find this category.',
				'deepcat-error-tooldown': 'CatGraph-Tool is not reachable.',
				'hintbox-close': 'Hide',
				'hintbox-text': 'Information about limits etc.'
			} );
			break;
	}

	$( function () {
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

		if(refreshSearchTermMock())
			showHint();
		checkErrorMessage();
	} );

	function showHint( ) {
		var parent= document.getElementById('mw-content-text');
		var sresults= document.getElementsByClassName('searchresults')[0];
		var d= parent.insertBefore(document.createElement('div'), sresults);
		d.style.marginTop= "1em";
		d.style.marginBottom= "1em";
		d.innerHTML=
			'<div style="background:#8af; padding:.75em; width:75%">' +
			mw.msg('hintbox-text') +
			"<div align='right'><a href='#'>" + mw.msg('hintbox-close') + "</a></div>"
			"</div>";
	}

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
			timeout: ajaxTimeout,
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
		mw.log( "graph & ajax request successful" );
		mw.log( "statusMessage: " + data['statusMessage'] );
	}

	function graphError( data ) {
		mw.log( "graph request failed" );
		mw.log( "statusMessage: " + data['statusMessage'] );

		substituteSearchRequest( ' ' );
		addErrorField( 'deepcat-error-notfound' );
		$( '#searchform' ).submit();
	}

	function ajaxError( data ) {
		mw.log( "ajax request error: " + JSON.stringify( data ) );

		substituteSearchRequest( ' ' );
		addErrorField( 'deepcat-error-tooldown' );
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

	function addErrorField( mwErrorMessage ) {
		$( '<input>' ).attr( {
			type: 'hidden',
			name: 'deepCatError',
			value: mwErrorMessage
		} ).appendTo( '#searchform' );
	}

	function showErrorMessage( mwMessage ) {
		var output = mw.html.element( 'div', { class: 'searchresults' }, new mw.html.Raw(
			mw.html.element( 'div', { class: 'error' }, mw.msg( mwMessage ) )
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
		var deepCatError = mw.util.getParamValue( 'deepCatError' );

		if ( deepCatError ) {
			showErrorMessage( deepCatError );
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

	String.format = function () {
		var s = arguments[0];
		for ( var i = 0; i < arguments.length - 1; i++ ) {
			var reg = new RegExp( "\\{" + i + "\\}", "gm" );
			s = s.replace( reg, arguments[i + 1] );
		}

		return s;
	};

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
