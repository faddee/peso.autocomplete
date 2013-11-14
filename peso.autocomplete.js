/**
 * $.autocomplete, a.k.a. peso.autocomplete
 * v0.1.0
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

		// In case you want to rename the plugin
		pluginName = this.PESO_AUTOCOMPELTE_NAME || 'autocomplete',

		// Default options
		defaults = {

			url:				undefined, // Ajax request URL
			type:				undefined, // Ajax HTTP request method
			source:				[], // If you rather would like to use a source, the plugin takes it from there and filter it for you
			minLength:			2, // Minimum number of characters before the autocomplete triggers
			maxResults:			10, // Maximum number of results to show, 0 = unlimited
			wrap:				true, // Automatically wrap the input element, set to false you need to wrap it manually with CSS: position: relative;
			classPrefix:		pluginName, // Class name prefix
			classWrapper:		'', // The class name of the wrapper for the input element
			classInput:			'__input', // The class name for the input element, set to null if you wan't to do it manually
			classResultList:	'__results', // The class name of the result list container
			classResultItem:	'__item', // The class name of the result list item
			classResultLink:	'__link' // The class name of the suggestion link
		},

		// Default markup
		defaultMarkup = function(settings) {

			return {

				// Wrapper markup
				markupWrapper: '<div class="' + settings.classPrefix + settings.classWrapper + '">',

				// Result container markup
				markupResultList: '<ul class="' + settings.classPrefix + settings.classResultList + '">',

				// Result item markup
				markupResultItem: '<li class="' + settings.classPrefix + settings.classResultItem + '">',

				// Result link markup, we strongly recommend this to be an <a> tag so you can style it by the :focus pseudo
				markupResultLink: '<a class="' + settings.classPrefix + settings.classResultLink + '">'
			};
		},

		// Key map of the used keys that controlls the autocomplete
		keyMap = {
			enter: 13,
			esc: 27,
			up: 38,
			down: 40
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

			build: function(element) {
				var self = this,
					settings = self.settings,
					suggestions = self.suggestions = null,

					// Store the element for further use
					$input = self.$input = $(element),

					// Create the result list object and store it
					$results = self.$results = $(settings.markupResultList),

					$wrapper = self.$wrapper,

					// Don't bubble events when using the autocompletion
					stopPropagation = function(event) {
						event.stopPropagation();
					};

				// Add class to the input element
				if ( $.type(settings.classInput) === 'string' ) {
					$input.addClass(settings.classPrefix + settings.classInput);
				}

				// Wraps the input element
				if ( settings.wrap === true ) {
					$wrapper = $(settings.markupWrapper);
					$input.wrap($wrapper);

					// Make sure click events within the wrapper doesn't bubble
					$wrapper.on('click.' + pluginName, stopPropagation);
				} else {

					// If you wan't to skip the wrapper, make sure click events within the input and results element doesn't bubble
					$input.add($results).on('click.' + pluginName, stopPropagation);
				}

				// Determine whether the suggestions should be fetched from from the source parameter
				if ( !settings.url && $.isArray(settings.source) ) {
					self.open = function() {
						this.fetch('source');
						return this;
					};

				// ...or if it should be fetched with an ajax request
				} else if ( $.type(settings.url) === 'string' ) {
					self.open = function() {
						this.fetch('ajax');
						return this;
					};
				}

				// Listen and handling events on the input element
				$input

					// Adds a custom event handler to the input element so you can controll it
					// 
					// Example of how you open the results list:
					// $('input.autocomplete__input').trigger('autocomplete', 'open');
					// 
					// Example of how you close the results list:
					// $('input.autocomplete__input').trigger('autocomplete', 'close');
					// 
					// TODO: Add terminate autocomplete
					.on(pluginName, function(event, action) {
						// Open autocompletion
						if ( action === 'open' ) {
							self.open();

						// Close autocompletion
						} else if ( action === 'close' ) {
							self.close();
						}
					})

					// Focus and keyup event handlers
					.on('focus keyup', function(event) {
						var length = $input.val().length,
							key = event.type === 'keyup' && ( event.keyCode || event.which );

						// Check if the keyup is dedicated to controll the autocomplete
						if ( isKeyEvent(key) ) {
							self.keyEvent(key, event.target);

						// Check if the query string meets the requirements of the minLength parameter
						} else if ( self.isMinLength(length) ) {
							// TODO: Add delay
							self.open();

						// If not and the result list is visible, close it
						} else if ( isVisible($results) ) {
							self.close();
						}
					});

				$results

					// Make sure its hidden
					.hide()

					// Add results to the DOM
					.insertAfter($input)

					// Attach keyup event handler on <a> tags
					.on('keyup.' + pluginName, 'a', function(event) {
						var key = event.keyCode || event.which || null;
						if ( isKeyEvent(key) ) {
							self.keyEvent(key, event.target);
						}
					})

					// Attach click event handler
					.on('click.' + pluginName, 'a', function(event) {
						event.preventDefault();

						// Set the value to the input element
						// TODO: Test without data-attribute
						$input.val($(this).data('suggestion'));

						// Close the autocompletion
						self.close();
					});


				return self;
			},

			fetch: function(type) {
				var self = this,
					settings = self.settings,
					query = self.$input.val(),
					latestQuery = self.latestQuery;

				// If the query string is and same as the one in the previous fetch, just present the results again
				if ( $.type(latestQuery) === 'string' && $.isArray(self.suggestions) && query === latestQuery ) {
					self.generateResults();
					return this;
				}

				// Save the currect query
				self.latestQuery = query;

				// Filter suggestions from source parameter
				if ( type === 'source' ) {

					// Filter the source
					var regexQuery = new RegExp('^' + query);
					self.suggestions = $.grep(settings.source, function(item) {
						return item.match(regexQuery);
					});

					// Generate the results based on filtered suggestions
					self.generateResults();

				// Get filtered suggestions from Ajax request
				} else if ( type === 'ajax' ) {

					// Get filtered suggestions with an Ajax request
					$.ajax({
						type: settings.type,
						url: settings.url,
						data: {
							q: query
						},
						success: function(suggestions) {
							self.suggestions = suggestions;

							// Generate the results based on filtered suggestions
							self.generateResults();
						}
					});
				}

				return self;
			},

			generateResults: function() {
				var self = this,
					settings = self.settings,
					maxResults = +settings.maxResults,
					suggestions = self.suggestions,
					$results = self.$results,
					$itemTemplate = $(settings.markupResultItem),
					$linkTemplate = $(settings.markupResultLink);

				// The suggestions must be an array to be able to continue
				if ( !$.isArray(suggestions) ) {
					self.close();
					throw new Error('The suggestions must be an Array');
				}

				// Abort if there's no suggestions to present
				if ( !suggestions.length ) {
					return self;
				}

				// Filter the suggestions accoring to the maxResults parameter
				if ( $.type(maxResults) === 'number' && maxResults > 0 && suggestions.length > maxResults ) {
					suggestions = suggestions.slice(0, maxResults);
				}

				// Make sure the results are empty
				$results.empty();

				// Start generating each suggestions
				$.each(suggestions, function(key, value) {

					var $item = $itemTemplate.clone(),
						$link = $linkTemplate.clone();

					$link

						// Set the href-attribute to something
						.attr('href', '#')

						// Present the suggestion as text
						.text(value)

						// Save the suggestion value
						.data('suggestion', value);

					// Append the link as a child to the item
					$item.append($link);

					// Add the item to the DOM
					$results.append($item);
				});

				// Show the results when it's ready
				$results.show();

				// Attach a click event handler to close the autocomplete when the user clicks outside it
				$(document).one('click.' + pluginName, function() {
					self.close();
				});

				return self;
			},

			close: function() {
				var self = this,
					$results = self.$results,
					$input = self.$input;

				// Empty and hide the results
				$results
					.hide()
					.empty();

				// Kill the click event handler for closing the autocomplete when the user clicks outside it
				$(document).off('click.' + pluginName);

				return self;
			},

			keyEvent: function(key, target) {
				var self = this,
					$target = $(target),
					$results = self.$results,
					$input = self.$input,

					// Enter key handler
					enterHandler = function() {
						var isTargetInput = $target[0] === $input[0];

						// Check whether the target is a suggestion link
						if ( !isTargetInput ) {

							// Trigger click event
							$target.trigger('click.' + pluginName);
						}
					},

					// Escape key handler
					escapeHandler = function() {

						// A simple close
						self.close();
					},

					// Up and down key handler
					arrowHandler = function() {
						var isKeyEsc = +key === keyMap.esc,
							isKeyUp = +key === keyMap.up,
							isKeyDown = +key === keyMap.down,
							isResultsVisible = isVisible($results),
							isTargetInput = $target[0] === $input[0],
							isTargetSuggestion = isResultsVisible && !isTargetInput;

						// On key down when input element is focused
						if ( isTargetInput && isKeyDown && self.isMinLength( $input.val().length ) ) {

							// Make sure the autocompletion is open
							if (!isResultsVisible) {
								self.open();
							}

							// Focus the first suggestion link
							$results
								.children(':first-child')
								.children()
								.focus();

						// On key up when input element is focused or key down when the last suggestion link is focused
						} else if ( ( isResultsVisible && isTargetInput && isKeyUp ) || ( isTargetSuggestion && isKeyDown && $target.parent().is(':last-child') ) ) {

							// Close the autocompletion
							self.close();

						// On key up when the first suggestion link is focused
						} else if ( isTargetSuggestion && isKeyUp && $target.parent().is(':first-child') ) {

							// Focus the input element
							$input.focus();

						// On key up when the first suggestion link is focused
						} else if ( isTargetSuggestion ) {
							var nextOrPrev = (isKeyDown && 'next') || (isKeyUp && 'prev');
							$target
								.parent()
								[nextOrPrev]()
								.children()
								.focus();
						}
					};

				switch(+key) {

					// Enter key handler
					case keyMap.enter:
						enterHandler();
					break;

					// Escape key handler
					case keyMap.esc:
						escapeHandler();
					break;

					// Up and down key handler
					case keyMap.up:
					case keyMap.down:
						arrowHandler();
					break;

				}
				return self;
			},

			// Check if the length meets the requirements of the minLength parameter
			isMinLength: function(length) {
				var minLength = +this.settings.minLength;
				return ( minLength > 0 && +length >= minLength ) || !minLength;
			}

		};

		// Add plugin to Zepto, jQuery or whatever
		$.fn[pluginName] = function(options) {

			return this.each(function() {
				var $self = $(this);

				// Check whether the element is usable
				if ( $self.is('input') && ($self.is(':not([type])') || $self.is('[type=text]')) ) {

					// Trigger the contructor
					(new Autocomplete(options)).build(this);

				// ..if not, throw an error about it
				} else {
					throw new Error('Cannot add autocompletion to element other then input[type=text]');
				}
			});
		};

}).call(this);
