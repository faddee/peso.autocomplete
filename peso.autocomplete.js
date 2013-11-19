/**
 * $.autocomplete, a.k.a. peso.autocomplete
 * v0.1.2
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
      // Core options
      source:           [],           // If it's a string, it will use it as the 'url' for an ajax request. If it's an array the plugin will filter it for you.
      ajax:             {},           // Ajax settings, all of the options, except 'url', will be used. Read more from: http://zeptojs.com/#$.ajax
      fieldName:        'q',          // Name of the query string field that will be used when 'source' is a URL. If other source type, this will be ignored.
      minLength:        2,            // Minimum number of characters before the autocomplete triggers
      maxResults:       10,           // Maximum number of results to show, 0 = unlimited

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
      classPrefix:      pluginName,   // Class name prefix
      classWrapper:     '',           // The class name of the wrapper for the input element
      classInput:       '__input',    // The class name for the input element, set to null if you wan't to do it manually
      classResultList:  '__results',  // The class name of the result list container
      classResultItem:  '__item',     // The class name of the result list item
      classResultLink:  '__link'      // The class name of the suggestion link
    },

    // Default markup
    defaultMarkup = function(settings) {

      return {
        markupWrapper:    '<div class="' + settings.classPrefix + settings.classWrapper + '">',   // Wrapper markup
        markupResultList: '<ul class="' + settings.classPrefix + settings.classResultList + '">', // Result container markup
        markupResultItem: '<li class="' + settings.classPrefix + settings.classResultItem + '">', // Result item markup
        markupResultLink: '<a class="' + settings.classPrefix + settings.classResultLink + '">'   // Result link markup, we strongly recommend this to be an <a> tag so you can style it by the :focus pseudo seletor
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

    // Don't bubble events when using the autocompletion
    stopPropagation = function(event) {
      event.stopPropagation();
    },

    openAutocompletes = [],

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
          create = settings.create,
          suggestions = self.suggestions = null,

          // Store the element for further use
          input = self.input = element,
          $input = self.$input = $(element),

          // Create the result list object and store it
          $results = self.$results = $(settings.markupResultList),

          $wrapper = self.$wrapper;

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

        // Determine the source method
        if ( $.isArray(settings.source) ) {
          self.method = 'array';

        // ...or if it should be fetched with an ajax request
        } else if ( $.type(settings.source) === 'string' ) {
          self.method = 'ajax';
        }

        // Listen and handling events on the input element
        $input

          // Save the currect value
          .data('current-value', $input.val())

          // Adds a custom event handler to the input element so you can controll it
          // 
          // Example of how you open the results list:
          // $('selector').trigger('autocomplete', 'open');
          // 
          // Example of how you close the results list:
          // $('selector').trigger('autocomplete', 'close');
          // 
          // TODO: Add terminate autocomplete
          // TODO: Do properly with methods!!! E.g: $('selector').autocomplete('close');
          // .on(pluginName, function(event, action) {
          //   // Open autocompletion
          //   if ( action === 'open' ) {
          //     self.open();

          //   // Close autocompletion
          //   } else if ( action === 'close' ) {
          //     self.close();
          //   }
          // })

          // Focus and keyup event handlers
          .on('focus keyup', function(event) {
            var value = $input.val(),
              length = value.length,
              type = event.type,
              keyCode = type === 'keyup' && event.keyCode || event.which,
              keyEvent = isKeyEvent(keyCode),
              previousValue = $input.data('current-value'),
              defaultHandler = function() {

                // Check if the input value meets the requirements of the minLength parameter
                if ( self.isMinLength(length) ) {
                  self.open();

                // If not and the result list is visible, close it
                } else if ( isVisible($results) ) {
                  self.close();
                }
              };

            $input.data('current-value', value);  

            // Check if the keyup is dedicated to controll the autocomplete
            if ( keyEvent ) {
              self.keyHandler(keyCode, event.target);

            // Call default handler on focus or trigger the change event, calling the default handler if answer is true.
            } else if ( type === 'focus' || value !== previousValue && self.trigger('change') ) {
                defaultHandler();
            }
          });

        $results

          // Make sure its hidden
          .hide()

          // Add results to the DOM
          .insertAfter($input)

          // Call the user focus callback
          .on('focus.' + pluginName, 'a', function() {
            self.trigger('focus', {
              target: this
            });
          })

          // Attach keyup event handler on <a> tags
          .on('keyup.' + pluginName, 'a', function(event) {
            var key = event.keyCode || event.which || null;
            if ( isKeyEvent(key) ) {
              self.keyHandler(key, event.target);
            }
          })

          // Attach click event handler
          .on('click.' + pluginName, 'a', function(event) {
            var data = {
              target: this
            };

            event.preventDefault();

            // Call the user select callback
            if ( self.trigger('select', data) ) {

            // Set the value to the input element
            // TODO: Doable without data-attribute?
              $input.val( $(this).data('suggestion') );
            }

            // Close the autocompletion
            self.close();
          });

        // Call the user create callback
        self.trigger('create');

        return self;
      },

      open: function() {
        var self = this;

        // TODO: Add delay

        self.fetch( self.method );
        return this;
      },

      fetch: function() {
        var self = this,
          settings = self.settings,
          method = self.method,
          query = self.$input.val(),
          latestQuery = self.latestQuery,
          source = settings.source,
          data;

        // Don't continue if the requirements for the input value isn't met
        if ( $.type(query) !== 'string' || !self.isMinLength(query.length) ) {
          return self;
        }

        // Call the user search callback
        self.trigger('search');

        // If the query string is and same as the one in the previous fetch, just present the results again
        if ( $.type(latestQuery) === 'string' && $.isArray(self.suggestions) && query === latestQuery ) {
          self.generateResults();
          return this;
        }

        // Save the currect query
        self.latestQuery = query;

        // Filter suggestions from source parameter
        if ( method === 'function' ) {

          // Recieve custom callback data as source
          data = {
            content: source(query)
          };

          // Trigger the user respons callback
          self.trigger('response', data);

          // Save the suggestions to the instance
          self.suggestions = data.content;

          // Generate the results based on filtered suggestions
          self.generateResults();

        // Get filtered suggestions from Ajax request
        } else if ( method === 'array' ) {

          // Filter the source
          var regexQuery = new RegExp('^' + query);

          data = {
            content: $.grep(source, function(item) {
              return item.match(regexQuery);
            })
          };

          // Trigger the user respons callback
          self.trigger('response', data);

          // Save the suggestions to the instance
          self.suggestions = data.content;

          // Generate the results based on filtered suggestions
          self.generateResults();

        // Get filtered suggestions from Ajax request
        } else if ( method === 'ajax' ) {

          var fieldName = settings.fieldName,
            requestData = {},
            currentRequest = self.request;

          if ( currentRequest !== undefined && $.isFunction(currentRequest.abort) ) {
            currentRequest.abort();
          }

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
              self.generateResults();
            }
          });

          // Get filtered suggestions with an Ajax request
          self.request = $.ajax(requestSettings);

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

        self.trigger('open');

        openAutocompletes.push(this);

        return self;
      },

      close: function() {
        var self = this,
          $results = self.$results,
          indexOf = $.inArray(self, openAutocompletes);

        // Empty and hide the results
        $results
          .hide()
          .empty();

        if ( indexOf > -1 ) {
          openAutocompletes.splice(indexOf, 1);
        }

        // Call the user close callback
        self.trigger('close');

        return self;
      },

      keyHandler: function(key, target) {
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
            } else if ( isResultsVisible && isTargetInput && isKeyUp ) {

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

      // Check if the length meets the requirements of the minLength parameter
      isMinLength: function(length) {
        var minLength = +this.settings.minLength;
        return ( minLength > 0 && +length >= minLength ) || !minLength;
      },

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

    // Attach a click event handler to close the autocomplete when the user clicks outside it
    $(document).on('click.' + pluginName, function() {
      var autocompletes = $.extend([], openAutocompletes);
      $.each(autocompletes, function() {
        if ( isVisible(this.$results) ) {
          this.close();
        }
      });
    });

}).call(this);
