/**
 * $.autocomplete, a.k.a. peso.autocomplete
 * v0.3.0
 * 
 * Lightweight autocompletion with minimal DOM manipulation as possible, supported by jQuery and Zepto.
 * https://github.com/faddee/peso-autocomplete
 *
 * $('input').autocomplete();
 * 
 */
(function(undefined) {

	var

		// Define of either Zepto or jQuery, or other $ library for that matter.
		$ = this.$,
		document = this.document,
		$document = $(document),

		// In case you want to rename the plugin
		pluginName = this.PESO_AUTOCOMPELTE_NAME || 'autocomplete',

		// Default options
		defaults = {
			// Core options
			source:           [],           // If it's a string, it will use it as the 'url' for an ajax request. If it's an array the plugin will filter it for you.
			ajax:             {},           // Ajax settings, all of the options, except 'url', will be extended. Read more from: http://zeptojs.com/#$.ajax
			fieldName:        'q',          // Name of the query string field that will be used when 'source' is a URL. If other source type, this will be ignored.
			minLength:        2,            // Minimum number of characters before the autocomplete triggers
			maxResults:       10,           // Maximum number of results to show, 0 = unlimited
			delay:            500,          // Delay in ms between change and open
			highlight:        true,         // Wrap the search words in the suggestion labels

			// Events
			create:           null,         // User create event, triggers when the build is complete.
			change:           null,         // User change event, triggers when the value in the input field changes. Default handler is preventable and it's performing the search and display, or undisplay for that matter, the autocomplete suggestion items if the requirements of the input value are met.
			search:           null,         // User search event, triggers when the minLength for the input value is met and a search is performed.
			response:         null,         // User response event, triggers when the ajax response is complete and successfull. Useful for filtering the data.
			open:             null,         // User open event, triggers when the suggestion items are displaying or updated.
			focus:            null,         // User focus event, triggers when an suggestion item is focused.
			select:           null,         // User select event, triggers when an suggestion item get selected. Default handler is preventable and it's performing the value update in the input field. Next up is closing the autocomplete suggestion items and that is not preventable.
			close:            null,         // User close event, triggers when the autocomplete is closed.

			// Markup
			wrap:             true,         // Automatically wrap the input element, set to false you need to wrap it manually with CSS: position: relative;
			appendTo:         null,
			classPrefix:      pluginName,   // Class name prefix
			classWrapper:     '',           // The class name of the wrapper for the input element
			classInput:       '__input',    // The class name for the input element, set to null if you wan't to do it manually
			classResultList:  '__results',  // The class name of the result list container
			classResultItem:  '__item',     // The class name of the result list item
			classResultLink:  '__link',     // The class name of the suggestion link
			classHighlight:   '__highlight' // The class name of the highlighted string
		},

		// Default markup
		defaultMarkup = function(settings) {

			return {
				markupWrapper:    '<div class="' + settings.classPrefix + settings.classWrapper + '"></div>',                       // Wrapper markup
				markupResultList: '<ul class="' + settings.classPrefix + settings.classResultList + '"></ul>',                      // Result container markup
				markupResultItem: '<li class="' + settings.classPrefix + settings.classResultItem + '"></li>',                      // Result item markup
				markupResultLink: '<a class="' + settings.classPrefix + settings.classResultLink + '" href="#" tabindex="-1"></a>', // Result link markup, we strongly recommend this to be an <a> tag so you can style it by the :focus pseudo seletor
				markupHighlight:  '<span class="' + settings.classPrefix + settings.classHighlight + '"></span>'                    // Highlight word markup
			};
		},

		// Array of available mathods
		// 
		// Examples of available mathods:
		// $('selector').autocomplete('close');
		// $('selector').autocomplete('destroy');
		// TODO: Add disable method
		// TODO: Add enable method
		// TODO: Add option method
		// TODO: Add search method
		methods = [
			'close',
			'destroy'
		],

		// Stash all the instances
		instances = [],

		// Key map of the used keys that controlls the autocomplete
		keyMap = {
			enter: 13,
			esc: 27,
			up: 38,
			down: 40,
			tab: 9
		},

		// Get an instance
		getInstance = function(input) {
			return $.grep(instances, function(instance) {
				return instance.input === input;
			})[0] || null;
		},

		// Check whether the element is visible or not, insired by Zepto Select-plugin
		isVisible = function(element) {
			var $element = $(element);
			return !!($element.width() || $element.height()) && $element.css("display") !== "none";
		},

		// Check whether the pressed key is for controlling the autocomplete
		isKeyEvent = function(key) {
			key = +key;

			// Test whether the key is enter, escape, up or down
			return $.type(key) === 'number' && key > 0 && ( key === keyMap.enter || key === keyMap.esc || key === keyMap.up || key === keyMap.down );
		},

		// Definition of the contructor
		Autocomplete = function(options) {

			// Save the settings temporarily
			var temp = $.extend({}, defaults, options);

			// Merge with markups
			this.settings = $.extend({}, defaultMarkup(temp), temp);
		};

		Autocomplete.prototype = {

			/**
			 * Core
			 */

			// Set the grounds
			build: function(element) {
				var self = this,
					settings = self.settings,
					suggestions = self.suggestions = null,

					$context = $(settings.appendTo),

					// Store the element for further use
					input = self.input = element,
					$input = self.$input = $(element),

					// Save the original input element
					original = self.original = $input.clone()[0],

					// Create the result list object and store it
					$results = self.$results = $(settings.markupResultList).hide();

				// Add class to the input element
				if ( $.type(settings.classInput) === 'string' ) {
					$input.addClass(settings.classPrefix + settings.classInput);
				}

				// Add results to specified context
				if ( $context.length > 0 ) {
					$results.appendTo( $context.get(0) );

				// Wrap the input element
				} else {
					if ( settings.wrap === true ) {
						var $wrapper = self.$wrapper = $(settings.markupWrapper);
						$input.wrap($wrapper);
					}

					// Add results to DOM
					$results.insertAfter($input);
				}

				// Determine the source method
				// ...if it should be fetched with an function callback
				if ( $.isFunction(settings.source) ) {
					self.method = 'function';

				// ...or if it should use a static array
				} else if ( $.isArray(settings.source) ) {
					self.method = 'array';

				// ...or if it should be fetched with an ajax request
				} else if ( $.type(settings.source) === 'string' ) {
					self.method = 'ajax';
				}

				// Save the current value as previous value
				self.previousValue = $input.val();

				// Listen and handling events on the input element
				$input

					// Disable native autocomplete
					.attr('autocomplete', 'off')

					// Focus and keydown event handlers
					.on('keyup focus', function(event) {
						var value = $input.val(),
							length = value.length,
							type = event.type,
							keyCode = +(type === 'keyup' && (event.keyCode || event.which)),
							hasChanged = value !== self.previousValue,
							isKey = isKeyEvent(keyCode),
							isFocus = type === 'focus';

						if ( hasChanged ) {
							self.previousValue = value;
						}

						// Check if the keydown is dedicated to controll the autocomplete
						if ( isKey ) {

							self.keyHandler(keyCode, event.target);

						// Call default handler on focus or trigger the change event, calling the default handler if answer is true.
						} else if ( isFocus || hasChanged && self.trigger('change') ) {

							// Check if the input value meets the requirements of the minLength parameter
							if ( self.isLength(length) ) {
								self.open( !isFocus );

							// If not and the result list is visible, close it
							} else if ( isVisible($results) ) {
								self.close();
							}
						}
					});

				$results

					.on({

						// Call the user focus callback
						focus: function() {
							var $item = $(this),
								data = {
									target: this,
									value: $item.data('item-value'),
									label: $item.text()
								};

							self.trigger('focus', data);
						},

						// Attach keyup event handler on <a> tags
						keyup: function(event) {
							var keyCode = event.keyCode || event.which || null;
							if ( isKeyEvent(keyCode) ) {

								// Prevent default handler if key press is arrow up or down
								if ( keyCode === keyMap.up || keyCode === keyMap.down ) {
									event.preventDefault();
								}

								self.keyHandler(keyCode, event.target);
							}
						},

						// Attach click event handler
						click: function(event) {
							event.preventDefault();

							var $item = $(this),
								value = $item.data('item-value'),
								label = $item.text(),
								data = {
									target: this,
									value: value,
									label: label
								};

							// Call the user select callback
							if ( self.trigger('select', data) ) {

								// Set the value to the input element
								// TODO: Doable without data-attribute?
								$input.val(value);
								$input.data('item-label', label);
							}

							// Close the autocompletion
							self.close();
						}
					}, 'a');

				$input.add($results)

					.on({

						// Fake document bubble
						click: function(event) {
							event.stopPropagation();
							$document.trigger('click', self);
						},

						// Make sure arrow up and down key doesn't cause the page to scroll
						keydown: function(event) {
								var keyCode = +(event.type === 'keydown' && (event.keyCode || event.which));

								// Prevent default handler if key press is arrow up or down
								if ( keyCode === keyMap.up || keyCode === keyMap.down ) {
									event.preventDefault();

								// Close on tab key
								} else if ( keyCode === keyMap.tab ) {
									self.close();
								}

						}
					});

				// Call the user create callback
				self.trigger('create');

				instances.push(this);

				return self;
			},

			// Execute the search
			open: function(delaying) {
				var self = this,
					delay = +self.settings.delay;

					// Search executer
					execute = function() {
						self.fetch( self.method );
					};

				self.abort();

				if ( delaying === true && delay > 0 ) {

					// Delay before executing
					self.timeout = setTimeout(execute, delay);
				} else {
					execute();
				}

				return this;
			},

			// Abort search
			abort: function() {
				var self = this;

				self.abortRequest();

				// Clear timeout
				if ( self.timeout !== undefined ) {
					clearTimeout( self.timeout );
					delete self.timeout;
				}
			},

			// Abort request
			abortRequest: function() {
				var self = this,
					currentRequest = self.request;

				// Abort ajax request
				if ( currentRequest !== undefined && $.isFunction(currentRequest.abort) ) {
					currentRequest.abort();
				}

			},

			// Performing the search based on the source when conditions are met
			fetch: function() {
				var self = this,
					settings = self.settings,
					method = self.method,
					query = self.$input.val(),
					latestQuery = self.latestQuery,
					source = settings.source,
					data;

				data = {
					query: query
				};

				// Don't continue if the requirements for the input value isn't met or the call for the user search callback prevents default
				if ( $.type(query) !== 'string' || !self.isLength(query.length) || !self.trigger('search', data) ) {
					return self;
				}

				// If the query string is and same as the one in the previous fetch, just present the results again
				if ( $.type(latestQuery) === 'string' && $.isArray(self.suggestions) && query === latestQuery ) {
					self.generate();
					return this;
				}

				// Save the currect query
				self.latestQuery = query;

				// Filter suggestions from source parameter
				if ( method === 'function' ) {

					// Recieve custom callback data as source
					data = {
						content: source.call(self.input, query)
					};

					// Trigger the user respons callback
					self.trigger('response', data);

					// Save the suggestions to the instance
					self.suggestions = data.content;

					// Generate the results based on filtered suggestions
					self.generate();

				// Get filtered suggestions from Ajax request
				} else if ( method === 'array' ) {

					// Filter the source
					var regexQuery = new RegExp('^' + query);

					data = {
						content: $.grep(source, function(item) {
							var label = $.type(item) === 'string' && item || $.isPlainObject(item) && $.type(item.value) ===  'string' && item.value;
							return label.match(regexQuery);
						})
					};

					// Trigger the user respons callback
					self.trigger('response', data);

					// Save the suggestions to the instance
					self.suggestions = data.content;

					// Generate the results based on filtered suggestions
					self.generate();

				// Get filtered suggestions from Ajax request
				} else if ( method === 'ajax' ) {

					var fieldName = settings.fieldName,
						requestData = {};

					self.abortRequest();

					if ( $.type(fieldName) === 'string' ) {
						requestData[ settings.fieldName ] = query;
					} else {
						throw new Error('The field name is not a string.');
					}

					// Extend the ajax settings deeply
					var requestSettings = $.extend(true, {}, settings.ajax, {
						url: source,
						data: requestData,
						success: function(responseData, status, xhr) {
							var success = settings.ajax.success;

							delete self.request;

							// Call the ajax success callback
							if ( $.isFunction(success) ) {
								success.call(this, responseData, status, xhr);
							}

							data = {
								content: responseData
							};

							// Trigger the user respons callback
							self.trigger('response', data);

							// Save the suggestions to the instance
							self.suggestions = data.content;

							// Generate the results based on filtered suggestions
							self.generate();
						}
					});

					// Get filtered suggestions with an Ajax request
					self.request = $.ajax(requestSettings);

				}

				return self;
			},

			// Generating the results to the DOM
			generate: function() {
				var self = this,
					settings = self.settings,
					maxResults = +settings.maxResults,
					suggestions = self.suggestions,
					words = self.$input.val().split(/\s+/),
					$results = self.$results,
					$itemTemplate = $(settings.markupResultItem),
					$linkTemplate = $(settings.markupResultLink),
					$wordTemplate = $(settings.markupHighlight);

				// The suggestions must be an array to be able to continue
				if ( !$.isArray(suggestions) ) {
					self.close();
					throw new Error('The suggestions must be an Array');
				}

				// Abort if there's no suggestions to present
				if ( !suggestions.length ) {
					self.close();
					return self;
				}

				// Filter the suggestions accoring to the maxResults parameter
				if ( $.type(maxResults) === 'number' && maxResults > 0 && suggestions.length > maxResults ) {
					suggestions = suggestions.slice(0, maxResults);
				}

				// Focus input before empty
				if ( document.activeElement !== self.input ) {
					self.$input.focus();
				}

				// Make sure the results are empty
				$results.empty();

				// Start generating each suggestions
				$.each(suggestions, function(key, item) {

					var $item = $itemTemplate.clone(),
						$link = $linkTemplate.clone(),
						isString = $.type(item) === 'string',
						isObject = $.isPlainObject(item),
						value = isString && item || isObject && $.type(item.value) && item.value,
						label = self.escape( isString && item || isObject && $.type(item.label) && item.label );

					// Highlight search words in the label
					if ( settings.highlight ) {
						
						var 

							// Escape the words
							wordsEscaped = $.map(words, function(word) {
								return ( word.length > 0 ) ? self.escape(word) : null;
							}),

							// Regex the escaped string
							regexWord = new RegExp(wordsEscaped.join('|'), 'ig');

						// Replace matches with HTML
						label = label.replace(regexWord, function(match) {
							var $wordHighlight = $wordTemplate.clone().text(match),
								wordHighlight = $wordHighlight[0].outerHTML;
							return wordHighlight;
						});
					}

					$link

						// Save the suggestion value
						.data('item-value', value)

						// Present the suggestion as text
						.html(label);

					// Append the link as a child to the item
					$item.append($link);

					// Add the item to the DOM
					$results.append($item);
				});

				// Show the results when it's ready
				$results.show();

				self.trigger('open');

				return self;
			},

			/**
			 * Event
			 */

			// Handling plugin specific key events
			keyHandler: function(key, target) {
				var self = this,
					$target = $(target),
					$results = self.$results,
					$input = self.$input,
					isKeyEnter = +key === keyMap.enter,
					isKeyEsc = +key === keyMap.esc,
					isKeyUp = +key === keyMap.up,
					isKeyDown = +key === keyMap.down,
					isResultsVisible = isVisible($results),
					isTargetInput = $target[0] === $input[0],
					isTargetSuggestion = isResultsVisible && !isTargetInput;

				// On enter and the target is a suggestion link
				if ( isKeyEnter && isTargetSuggestion ) {

					// Trigger click event
					$target.trigger('click');

				// One escape
				} else if (isKeyEsc) {

						// A simple close
						self.close();

					// On key down or up when input element is focused
				} else if ( ( isKeyDown || isKeyUp ) && isTargetInput && self.isLength( $input.val().length ) ) {

					// Make sure the autocompletion is open
					if (!isResultsVisible) {
						self.open();
					}

					// Focus the first suggestion link
					$results
						.children(isKeyDown && ':first-child' || isKeyUp && ':last-child')
						.children()
						.focus();

				// On key up or down when the first or last suggestion link is focused
				} else if ( ( isKeyUp && $target.parent().is(':first-child') || isKeyDown && $target.parent().is(':last-child') ) && isTargetSuggestion ) {

					// Focus the input element
					$input.focus();

				// On key up and down
				} else if ( ( isKeyDown || isKeyUp ) && isTargetSuggestion ) {

					var nextOrPrev = (isKeyDown && 'next') || (isKeyUp && 'prev');

					$target
						.parent()
						[nextOrPrev]()
						.children()
						.focus();

				}

				return self;
			},

			// Trigger an custom event
			trigger: function(eventName) {
				var self = this,
					callback = self.settings[eventName],

					// Custom event
					event = $.Event( pluginName + eventName ),

					// Make argument list to real array and remove the first argument
					data = Array.prototype.slice.call(arguments);

				// Remove first argument
				data.splice(0, 1);

				// Trigger custom event
				self.$input.trigger(event, data);

				// Apply the user callback and return whether default is prevented
				return !( $.isFunction(callback) && callback.apply( self.input, [event].concat(data) ) === false || event.isDefaultPrevented() );
			},

			/**
			 * Public methods
			 */

			// Close the results
			close: function() {
				var self = this,
					$results = self.$results;

				self.abort();

				// Empty and hide the results
				$results
					.hide()
					.empty();

				// Call the user close callback
				self.trigger('close');

				return self;
			},

			// Destroy the autocomplete
			destroy: function() {
				var self = this,
					settings = self.settings,
					$input = self.$input,
					$results = self.$results,
					indexOf = $.inArray(self, instances);

				$results.remove();

				if ( self.$wrapper !== undefined ) {
					$input.unwrap();
				}

				$input.replaceWith( self.original );

				if ( indexOf > -1 ) {
					instances.splice(indexOf, 1);
				}
			},

			/**
			 * Helpers
			 */

			// Escape a string to HTML special characters
			escape: function(string) {
				return $('<span>').text(string).html();
			},

			// Check whether the results are being shown or not
			isOpen: function() {
				return isVisible(this.$results);
			},

			// Check if the length meets the requirements of the minLength parameter
			isLength: function(length) {
				var minLength = +this.settings.minLength;
				return minLength > 0 && +length >= minLength || !minLength;
			}

		};

		// Attach custom event handler to document to close all open the autocompletions
		$document.on('click.' + pluginName, function(event, ignoreInstance) {
			$.each(instances, function() {
				if ( this.isOpen() && ignoreInstance !== this ) {
					this.close();
				}
			});
		});

		// Add plugin to Zepto, jQuery or whatever
		$.fn[pluginName] = function(options) {

			return this.each(function() {
				var self = this,
					$self = $(this);

				// Check whether the element is usable
				if ( $self.is('input') && ($self.is(':not([type=file]):not([type=checkbox]):not([type=radio])')) ) {

					// If options is an string, it will call a method
					if ( $.type(options) === 'string' && !!options ) {

						// Filter the instance for that element
						var instance = getInstance(self);

						// If there is an instance available, trigger the method
						if ( instance !== null && $.inArray(options, methods) !== -1 ) {
							instance[options]();
						}

					// ... otherwise create an instance
					} else {

						(new Autocomplete(options)).build(this);
					}

				// ..if not, throw an error about it
				} else {
					throw new Error('Cannot add autocompletion to element other then input[type=text]');
				}
			});
		};

}).call(this);
