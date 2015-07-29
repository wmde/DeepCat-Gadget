mediaWiki = {
	Api: function() {
		return {
			get: function() {
				return {
					done: function() {
					}
				};
			}
		};
	},
	config: {
		get: function() {
			return 'foo';
		}
	},
	cookie: {
		get: function() {
		},
		set: function() {
		}
	},
	html: {
		element: function() {
		},
		Raw: function() {
		}
	},
	libs: {},
	log: function() {
	},
	messages: {
		set: function() {
		}
	},
	msg: function( key ) {
		return '(' + key + ')';
	},
	util: {
		getParamValue: function() {
			return '';
		}
	}
};
