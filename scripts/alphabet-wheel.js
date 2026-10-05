var H5P = H5P || {};

/**
 * Alphabet Wheel — letter-wheel quiz (line 0.1).
 * Phase F: appearance + language packs.
 */
H5P.AlphabetWheel = (function ($) {
  var PlayArea = H5P.AlphabetWheel && H5P.AlphabetWheel.PlayArea;

  /**
   * @param {*} value
   * @returns {boolean}
   */
  function isOn(value) {
    return value === true || value === 1 || value === '1' || value === 'true';
  }

  /**
   * @param {number} value
   * @param {number} min
   * @param {number} max
   * @param {number} fallback
   * @returns {number}
   */
  function clampNumber(value, min, max, fallback) {
    var number = Number(value);

    if (isNaN(number)) {
      number = fallback;
    }

    return Math.max(min, Math.min(max, number));
  }

  /**
   * @param {string} value
   * @returns {boolean}
   */
  function isCssColor(value) {
    return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value) ||
      /^(?:rgb|rgba|hsl|hsla)\([0-9.,%\s]+\)$/.test(value);
  }

  /**
   * @param {H5P.jQuery} $container
   * @param {string} property
   * @param {string} color
   */
  function setColor($container, property, color) {
    var value = String(color || '').trim();

    if (isCssColor(value)) {
      $container.css(property, value);
    }
  }

  /**
   * Map legacy `design` colors into `appearance.wheel` when the new group is empty.
   *
   * @param {object} params
   * @returns {object}
   */
  function resolveAppearance(params) {
    var appearance = $.extend(true, {}, (params && params.appearance) || {});
    var legacy = (params && params.design) || {};
    var wheel = appearance.wheel || {};

    if (!wheel.letterColor && legacy.wheelColor) {
      wheel.letterColor = legacy.wheelColor;
    }
    if (!wheel.correctColor && legacy.correctColor) {
      wheel.correctColor = legacy.correctColor;
    }
    if (!wheel.wrongColor && legacy.wrongColor) {
      wheel.wrongColor = legacy.wrongColor;
    }

    appearance.wheel = wheel;
    return appearance;
  }

  /**
   * @param {AlphabetWheel} instance
   * @returns {boolean}
   */
  function isEmbeddedInstance(instance) {
    return !!(instance && typeof instance.isRoot === 'function' && !instance.isRoot());
  }

  /**
   * @param {AlphabetWheel} instance
   * @returns {object|null}
   */
  function getInstructionsOptions(instance) {
    var instructions = instance && instance.params && instance.params.instructions;
    var text;

    if (!instructions || !isOn(instructions.enabled)) {
      return null;
    }

    text = (instructions.text === undefined || instructions.text === null) ?
      '' :
      String(instructions.text).trim();

    if (!text) {
      return null;
    }

    return {
      id: instance.contentId,
      text: text,
      displayMode: instructions.displayMode || 'both',
      introButtonLabel: instructions.introButtonLabel || 'Start',
      tabButtonLabel: instructions.tabButtonLabel || 'Instructions',
      tabButtonLabelOpen: instructions.tabButtonLabelOpen,
      appearance: $.extend(true, {}, instructions.appearance || {}),
      animation: $.extend(true, {}, instructions.animation || {}),
      startCollapsed: instructions.startCollapsed === undefined ?
        true :
        isOn(instructions.startCollapsed)
    };
  }

  /**
   * @param {string} template
   * @param {object} replacements
   * @returns {string}
   */
  function replaceTokens(template, replacements) {
    var text = String(template || '');
    Object.keys(replacements || {}).forEach(function (key) {
      text = text.split('@' + key).join(String(replacements[key]));
    });
    return text;
  }

  /**
   * Keep items that have letter, definition and answer. First occurrence wins per letter.
   *
   * @param {Array} letters
   * @returns {Array}
   */
  function filterPlayableLetters(letters) {
    var seen = {};
    var playable = [];

    (letters || []).forEach(function (item) {
      var letter;
      var definition;
      var answer;

      if (!item) {
        return;
      }

      letter = String(item.letter || '').trim().toUpperCase();
      definition = String(item.definition || '').trim();
      answer = String(item.answer || '').trim();

      if (!letter || !definition || !answer) {
        return;
      }

      if (seen[letter]) {
        return;
      }

      seen[letter] = true;
      playable.push({
        letter: letter,
        definition: String(item.definition || '').trim(),
        answer: String(item.answer || '').trim(),
        alternatives: item.alternatives
      });
    });

    return playable;
  }

  /**
   * @param {object} params
   * @param {number} contentId
   * @param {object} contentData
   */
  function AlphabetWheel(params, contentId, contentData) {
    var self = this;
    var behaviour;
    var appearance;
    var wheel;
    var questionAttach;

    this.contentId = contentId;
    this.contentData = contentData;
    this.finished = false;
    this.answered = false;
    this.currentLetter = null;
    this.score = 0;
    this.finalScore = 0;
    this.finalMaxScore = 0;
    this.timerInterval = null;
    this.gameState = {};
    this.letterElements = {};
    this.sectionsInserted = false;

    H5P.QuestionCFRD.call(this, 'alphabet-wheel', { theme: true });

    this.params = $.extend(true, {
      instructions: {
        enabled: false
      },
      timeLimit: 300,
      letters: [],
      behaviour: {
        caseSensitive: false,
        ignoreAccents: true,
        allowPass: true,
        showScore: true,
        enableRetry: true,
        showSolution: false
      },
      overallFeedback: {
        overallFeedback: []
      },
      appearance: {
        backgroundColor: '',
        surfaceRadius: 0.5,
        definition: {},
        wheel: {
          letterColor: '#1a73d9',
          correctColor: '#2f7d4a',
          wrongColor: '#a33b3b'
        },
        input: {},
        meta: {},
        gameButtons: {},
        actionButtons: {}
      },
      l10n: {
        submitButton: 'Answer',
        passButton: 'Pass',
        tryAgain: 'Try again',
        answerPlaceholder: 'Type your answer...',
        timeLabel: 'Time: @time s',
        scoreLabel: 'Score: @score',
        emptyContent: 'Add at least one letter with a definition and a correct answer.',
        emptyAnswer: 'Please enter an answer',
        correctFeedback: 'Correct!',
        incorrectFeedback: 'Incorrect!',
        incorrectFeedbackWithSolution: 'Incorrect. The answer was: @answer',
        scoreBarLabel: 'You got :num out of :total points'
      }
    }, params || {});

    this.params.appearance = resolveAppearance(this.params);
    behaviour = this.params.behaviour || {};
    appearance = this.params.appearance || {};
    wheel = appearance.wheel || {};

    this.options = {
      timeLimit: Math.max(30, Number(this.params.timeLimit) || 300),
      letters: filterPlayableLetters(this.params.letters),
      caseSensitive: isOn(behaviour.caseSensitive),
      ignoreAccents: behaviour.ignoreAccents === undefined ? true : isOn(behaviour.ignoreAccents),
      allowPass: behaviour.allowPass === undefined ? true : isOn(behaviour.allowPass),
      showScore: behaviour.showScore === undefined ? true : isOn(behaviour.showScore),
      enableRetry: behaviour.enableRetry === undefined ? true : isOn(behaviour.enableRetry),
      showSolution: isOn(behaviour.showSolution),
      wheelColor: wheel.letterColor || '#1a73d9',
      correctColor: wheel.correctColor || '#2f7d4a',
      wrongColor: wheel.wrongColor || '#a33b3b',
      l10n: this.params.l10n || {}
    };

    this.timeLeft = this.options.timeLimit;
    this.hasContent = this.options.letters.length > 0;

    this.buildShell();
    this.setContent(this.$playArea);
    this.playAreaSize = PlayArea ? PlayArea.getDesignSize() : null;
    this.buildGameDom();
    this.showGameView();

    this.addButton('try-again', this.options.l10n.tryAgain, function () {
      self.resetTask();
    }, false, {}, {
      contentData: contentData,
      icon: 'retry'
    });

    questionAttach = this.attach;

    this.attach = function ($container) {
      self.$container = $container;
      questionAttach.apply(self, arguments);

      if (typeof self.isRoot === 'function' && self.isRoot()) {
        H5P.QuestionCFRD.ensureActivityStarted(self);
      }

      self.applyAppearance($container);
      self.observePlayAreaResize();
      self.syncFullscreenLayout(true);
      self.scheduleInstructions();

      if (self.hasContent && !self.finished) {
        self.startTimer();
        if (!self.currentLetter) {
          self.selectNextAvailableLetter();
        }
      }

      self.trigger('resize');
    };

    this.on('resize', function () {
      self.resize();
    });

    this.on('enterFullScreen', function () {
      self.scheduleFullscreenLayout(false);
    });

    this.on('exitFullScreen', function () {
      self.scheduleFullscreenLayout(true);
    });
  }

  AlphabetWheel.prototype = Object.create(H5P.QuestionCFRD.prototype);
  AlphabetWheel.prototype.constructor = AlphabetWheel;

  /**
   * Paint colors and shapes from the appearance group.
   *
   * @param {H5P.jQuery} $container
   */
  AlphabetWheel.prototype.applyAppearance = function ($container) {
    var appearance = resolveAppearance(this.params);
    var definition = appearance.definition || {};
    var wheel = appearance.wheel || {};
    var input = appearance.input || {};
    var meta = appearance.meta || {};
    var gameButtons = appearance.gameButtons || {};
    var buttons = appearance.actionButtons || {};
    var radius = clampNumber(appearance.surfaceRadius, 0, 4, 0.5);
    var background = String(appearance.backgroundColor || '').trim();
    var $targets = $container;

    this.params.appearance = appearance;
    this.options.wheelColor = wheel.letterColor || this.options.wheelColor || '#1a73d9';
    this.options.correctColor = wheel.correctColor || this.options.correctColor || '#2f7d4a';
    this.options.wrongColor = wheel.wrongColor || this.options.wrongColor || '#a33b3b';

    if (this.$playArea && this.$playArea.length) {
      $targets = $container.add(this.$playArea);
    }

    $targets.css('--h5p-aw-radius', radius + 'em');

    if (isCssColor(background)) {
      $container.css('--h5p-aw-activity-background', background);
    }

    setColor($targets, '--h5p-aw-hint-bg', definition.backgroundColor);
    setColor($targets, '--h5p-aw-definition-color', definition.textColor);
    setColor($targets, '--h5p-aw-hint-border', definition.borderColor);
    setColor($targets, '--h5p-aw-primary-border', definition.accentColor);

    setColor($targets, '--h5p-aw-wheel-bg', wheel.backgroundColor);
    setColor($targets, '--h5p-aw-wheel-border', wheel.borderColor);
    setColor($targets, '--h5p-aw-letter-bg', wheel.letterColor);
    setColor($targets, '--h5p-aw-letter-color', wheel.letterTextColor);
    setColor($targets, '--h5p-aw-correct-border', wheel.correctColor);
    setColor($targets, '--h5p-aw-wrong-border', wheel.wrongColor);

    setColor($targets, '--h5p-aw-input-bg', input.backgroundColor);
    setColor($targets, '--h5p-aw-input-color', input.textColor);
    setColor($targets, '--h5p-aw-input-border', input.borderColor);
    setColor($targets, '--h5p-aw-correct-bg', input.correctBackgroundColor);
    setColor($targets, '--h5p-aw-input-correct-border', input.correctBorderColor);
    setColor($targets, '--h5p-aw-wrong-bg', input.wrongBackgroundColor);
    setColor($targets, '--h5p-aw-input-wrong-border', input.wrongBorderColor);

    setColor($targets, '--h5p-aw-meta-accent', meta.timerColor);
    setColor($targets, '--h5p-aw-score-color', meta.scoreColor);

    setColor($targets, '--h5p-aw-submit-bg', gameButtons.submitBackgroundColor);
    setColor($targets, '--h5p-aw-submit-color', gameButtons.submitTextColor);
    setColor($targets, '--h5p-aw-submit-hover', gameButtons.submitHoverBackgroundColor);
    setColor($targets, '--h5p-aw-pass-bg', gameButtons.passBackgroundColor);
    setColor($targets, '--h5p-aw-pass-color', gameButtons.passTextColor);
    setColor($targets, '--h5p-aw-pass-border', gameButtons.passBorderColor);
    setColor($targets, '--h5p-aw-pass-hover', gameButtons.passHoverBackgroundColor);

    if (typeof this.setActionButtonAppearance === 'function') {
      this.setActionButtonAppearance({
        backgroundColor: buttons.backgroundColor,
        textColor: buttons.textColor,
        hoverBackgroundColor: buttons.hoverBackgroundColor,
        hoverTextColor: buttons.hoverTextColor,
        useBorder: buttons.useBorder === true,
        borderSettings: {
          borderColor: buttons.borderColor,
          hoverBorderColor: buttons.hoverBorderColor
        },
        borderRadius: buttons.borderRadius,
        useGradientBackground: false
      });
    }
  };

  /**
   * Size the 16:9 play area (game view and results slide share the same box).
   */
  AlphabetWheel.prototype.resize = function () {
    var layout;
    var scaleKey;
    var $root;
    var measureElement;
    var isFullscreen;

    if (!this.$playArea || !this.$playArea.length || !PlayArea) {
      return;
    }

    if (!this.$playArea.is(':visible')) {
      return;
    }

    $root = this.$container && this.$container.length ?
      this.$container :
      this.$playArea.closest('.h5p-alphabet-wheel');
    measureElement = ($root && $root.length) ? $root[0] : this.$playArea[0];
    isFullscreen = PlayArea.isFullscreenContext(measureElement);

    if ($root && $root.length) {
      $root.toggleClass('h5p-aw-is-fullscreen', isFullscreen);
    }

    layout = PlayArea.getLayoutDimensions(measureElement);
    scaleKey = layout.scale.toFixed(4);

    if (
      this._lastPlayAreaScale === scaleKey &&
      this._lastPlayAreaWidth === layout.width &&
      this._lastPlayAreaHeightPx === layout.heightPx &&
      this._lastFullscreenState === isFullscreen
    ) {
      this.updateInstructionsScale();
      return;
    }

    this._lastPlayAreaScale = scaleKey;
    this._lastPlayAreaWidth = layout.width;
    this._lastPlayAreaHeightPx = layout.heightPx;
    this._lastFullscreenState = isFullscreen;

    this.$playArea.css({
      fontSize: layout.fontSize + 'px',
      '--h5p-aw-scale': scaleKey,
      width: layout.widthPx,
      maxWidth: '100%',
      height: layout.heightPx,
      margin: '0 auto'
    });

    if ($root && $root.length) {
      $root.css('--h5p-aw-scale', scaleKey);
    }

    this.updateInstructionsScale();
  };

  /**
   * Mount instructions on the activity root so the intro covers the play area
   * and the results slide. Nested content leaves this to the parent.
   */
  AlphabetWheel.prototype.scheduleInstructions = function () {
    var self = this;

    if (typeof this.isRoot === 'function' && !this.isRoot()) {
      return;
    }

    [0, 200, 500].forEach(function (delay) {
      setTimeout(function () {
        var instructions = getInstructionsOptions(self);
        var $target = self.$playArea;
        var attached;

        if (!instructions || !$target || !$target.length) {
          return;
        }

        if (
          $target.closest('.h5p-alphabet-wheel').children('.h5p-instructions-root').length ||
          $target.children('.h5p-instructions-root').length
        ) {
          self.updateInstructionsScale();
          return;
        }

        if (H5P.Instructions && typeof H5P.Instructions.attach === 'function') {
          attached = H5P.Instructions.attach($target, instructions);

          if (attached) {
            self.trigger('resize');
          }
        }
      }, delay);
    });
  };

  /**
   * Keep the instructions tab scale in step with the play area.
   */
  AlphabetWheel.prototype.updateInstructionsScale = function () {
    var instructions = getInstructionsOptions(this);

    if (!instructions || !this.$playArea || !this.$playArea.length) {
      return;
    }

    if (H5P.Instructions && typeof H5P.Instructions.updateScale === 'function') {
      H5P.Instructions.updateScale(this.$playArea, instructions);
    }
  };

  /**
   * Observe play area width changes.
   */
  AlphabetWheel.prototype.observePlayAreaResize = function () {
    var self = this;

    if (!window.ResizeObserver || !this.$playArea || !this.$playArea.length) {
      return;
    }

    if (this.playAreaResizeObserver) {
      return;
    }

    if (isEmbeddedInstance(this)) {
      return;
    }

    this.playAreaResizeObserver = new ResizeObserver(function () {
      self.trigger('resize');
    });

    this.playAreaResizeObserver.observe(this.$playArea[0]);
  };

  /**
   * Mark the activity root when H5P puts fullscreen classes on body/container.
   *
   * @param {boolean} [forceResize]
   */
  AlphabetWheel.prototype.syncFullscreenLayout = function (forceResize) {
    var $root = this.$container && this.$container.length ?
      this.$container :
      (this.$playArea ? this.$playArea.closest('.h5p-alphabet-wheel') : null);
    var measureRoot = (this.$playArea && this.$playArea.length) ?
      this.$playArea[0] :
      ($root && $root.length ? $root[0] : null);
    var isFullscreen = !!(PlayArea && measureRoot && PlayArea.isFullscreenContext(measureRoot));

    if ($root && $root.length) {
      $root.toggleClass('h5p-aw-is-fullscreen', isFullscreen);
    }

    if (forceResize || this._lastFullscreenState !== isFullscreen) {
      this._lastFullscreenState = isFullscreen;
      this._lastPlayAreaScale = null;
      this._lastPlayAreaWidth = null;
      this._lastPlayAreaHeightPx = null;
      this.resize();
      return;
    }

    this.resize();
  };

  /**
   * Re-measure after fullscreen transitions (iframe size settles late).
   *
   * @param {boolean} resetFirst
   */
  AlphabetWheel.prototype.scheduleFullscreenLayout = function (resetFirst) {
    var self = this;
    var delays = resetFirst ? [0, 120, 240] : [0, 80, 200];

    delays.forEach(function (delay) {
      setTimeout(function () {
        self.syncFullscreenLayout(true);
      }, delay);
    });
  };

  /**
   * Build play area shell: game view + results slide.
   */
  AlphabetWheel.prototype.buildShell = function () {
    this.$playArea = $('<div>', { 'class': 'h5p-aw-play-area' });
    this.$gameView = $('<div>', { 'class': 'h5p-aw-game-view' });
    this.$resultView = $('<div>', { 'class': 'h5p-aw-result-view' }).hide();

    this.$resultFeedback = $('<div>', {
      'class': 'h5p-aw-result-feedback',
      tabindex: '-1'
    });
    this.$resultButtons = $('<div>', { 'class': 'h5p-aw-result-buttons' });
    this.$resultView.append(this.$resultFeedback, this.$resultButtons);

    this.$playArea.append(this.$gameView, this.$resultView);

    this.insertSectionAtElement('feedback', this.$resultFeedback);
    this.insertSectionAtElement('scorebar', this.$resultFeedback);
    this.insertSectionAtElement('buttons', this.$resultButtons);
    this.sectionsInserted = true;
  };

  /**
   * Show the in-game view and hide the results slide.
   */
  AlphabetWheel.prototype.showGameView = function () {
    this.$playArea.removeClass('is-showing-results');
    this.$resultView.hide();
    this.$gameView.show();
  };

  /**
   * Show the results slide and hide the in-game view.
   */
  AlphabetWheel.prototype.showResultView = function () {
    this.$playArea.addClass('is-showing-results');
    this.$gameView.hide();
    this.$resultView.show();
  };

  /**
   * Build or rebuild the wheel UI inside the game view.
   */
  AlphabetWheel.prototype.buildGameDom = function () {
    this.stopTimer();
    this.clearLetterAnimations();
    this.$gameView.empty();
    this.letterElements = {};
    this.currentLetter = null;

    if (!this.hasContent) {
      this.$gameView.append($('<p>', {
        'class': 'h5p-aw-empty-message',
        text: this.options.l10n.emptyContent
      }));
      return;
    }

    this.initGameState();
    this.createGameStructure();
    this.setupInteractions();
  };

  AlphabetWheel.prototype.initGameState = function () {
    var self = this;

    self.gameState = {};
    self.options.letters.forEach(function (letterObj) {
      var letter = String(letterObj.letter).toUpperCase();
      self.gameState[letter] = {
        answered: false,
        correct: false,
        passed: false,
        attempts: 0
      };
    });
  };

  AlphabetWheel.prototype.createGameStructure = function () {
    var self = this;
    var $gameContainer = $('<div>', { 'class': 'h5p-aw-game-container' });
    var $wheel = $('<div>', { 'class': 'h5p-aw-wheel' });
    var $gameArea = $('<div>', { 'class': 'h5p-aw-game-area' });
    var $meta = $('<div>', { 'class': 'h5p-aw-meta' });
    var $controls = $('<div>', { 'class': 'h5p-aw-controls' });
    var letterCount = self.options.letters.length;
    // Design units in em (base font 16px → 11.25em ≈ 180px radius on a 25em wheel).
    var radius = 11.25;
    var centerOffset = radius + 1.25;
    var startAngle = -90;

    self.$timer = $('<div>', {
      'class': 'h5p-aw-timer',
      html: replaceTokens(self.options.l10n.timeLabel, {
        time: '<span class="h5p-aw-time">' + self.timeLeft + '</span>'
      })
    });
    $meta.append(self.$timer);

    if (self.options.showScore) {
      self.$score = $('<div>', {
        'class': 'h5p-aw-score',
        html: replaceTokens(self.options.l10n.scoreLabel, {
          score: '<span class="h5p-aw-score-value">0</span>'
        })
      });
      $meta.append(self.$score);
    }

    $gameArea.append($meta);

    self.options.letters.forEach(function (letterObj, index) {
      var letter = String(letterObj.letter).toUpperCase();
      var angle = startAngle + (index * (360 / Math.max(letterCount, 1)));
      var angleRad = angle * Math.PI / 180;
      var x = radius * Math.cos(angleRad);
      var y = radius * Math.sin(angleRad);
      var $letter = $('<div>', {
        'class': 'h5p-aw-letter',
        'data-letter': letter,
        text: letter
      });

      $letter.css({
        left: (centerOffset + x) + 'em',
        top: (centerOffset + y) + 'em',
        transform: 'translate(-50%, -50%)'
      });

      $wheel.append($letter);
      self.letterElements[letter] = $letter;
    });

    $gameContainer.append($wheel);

    self.$definition = $('<div>', { 'class': 'h5p-aw-definition' });
    $gameArea.append(self.$definition);

    self.$answerInput = $('<input>', {
      type: 'text',
      'class': 'h5p-aw-answer',
      placeholder: self.options.l10n.answerPlaceholder
    });
    self.$answerField = $('<div>', { 'class': 'h5p-aw-answer-field' });
    self.$answerIcon = $('<span>', {
      'class': 'h5p-aw-answer-icon',
      'aria-hidden': 'true'
    });
    self.$answerField.append(self.$answerInput, self.$answerIcon);
    $gameArea.append(self.$answerField);

    self.$submitBtn = $('<button>', {
      type: 'button',
      'class': 'h5p-aw-submit',
      text: self.options.l10n.submitButton
    });
    self.$passBtn = $('<button>', {
      type: 'button',
      'class': 'h5p-aw-pass',
      text: self.options.l10n.passButton
    });

    if (!self.options.allowPass) {
      self.$passBtn.hide();
    }

    $controls.append(self.$submitBtn);
    $controls.append(self.$passBtn);
    $gameArea.append($controls);

    self.$feedback = $('<div>', { 'class': 'h5p-aw-feedback' });
    $gameArea.append(self.$feedback);

    $gameContainer.append($gameArea);
    self.$gameView.append($gameContainer);
  };

  AlphabetWheel.prototype.setupInteractions = function () {
    var self = this;

    self.$gameView.off('.aw');

    self.$gameView.on('click.aw', '.h5p-aw-letter', function () {
      self.selectLetter($(this).data('letter'));
    });

    self.$submitBtn.on('click.aw', function () {
      self.checkAnswer();
    });

    self.$answerInput.on('keypress.aw', function (event) {
      if (event.which === 13) {
        self.checkAnswer();
      }
    });

    self.$passBtn.on('click.aw', function () {
      self.passLetter();
    });
  };

  /**
   * @param {string} letter
   */
  AlphabetWheel.prototype.selectLetter = function (letter) {
    var self = this;
    var selectedLetter;
    var key = String(letter || '').toUpperCase();
    var previousKey;

    if (self.finished) {
      return;
    }

    if (self.currentLetter) {
      previousKey = String(self.currentLetter.letter).toUpperCase();
      if (self.letterElements[previousKey]) {
        clearInterval(self.letterElements[previousKey].data('interval'));
        self.letterElements[previousKey].stop().css('opacity', 1);
      }
    }

    selectedLetter = null;
    self.options.letters.forEach(function (item) {
      if (String(item.letter).toUpperCase() === key) {
        selectedLetter = item;
      }
    });

    if (selectedLetter && self.gameState[key] && !self.gameState[key].answered) {
      self.currentLetter = selectedLetter;
      self.clearAnswerFeedback();
      self.$definition.text(selectedLetter.definition || '');
      self.$answerInput.val('').prop('disabled', false).show().focus();
      self.$submitBtn.show();
      if (self.options.allowPass) {
        self.$passBtn.show();
      }

      self.letterElements[key].animate(
        { opacity: 0.3 },
        500,
        'linear',
        function () {
          $(this).animate({ opacity: 1 }, 500, 'linear');
        }
      ).data('interval', setInterval(function () {
        self.letterElements[key].animate(
          { opacity: 0.5 },
          500,
          'linear',
          function () {
            $(this).animate({ opacity: 1 }, 500, 'linear');
          }
        );
      }, 1000));
    }
  };

  /**
   * Clear transient answer feedback styling and text.
   */
  AlphabetWheel.prototype.clearAnswerFeedback = function () {
    if (this.$answerField) {
      this.$answerField.removeClass('is-correct is-incorrect');
    }
    if (this.$answerInput) {
      this.$answerInput.removeClass('is-correct is-incorrect');
    }
    if (this.$answerIcon) {
      this.$answerIcon
        .removeClass('fa fa-check fa-times')
        .empty();
    }
    if (this.$feedback) {
      this.$feedback
        .removeClass('is-correct is-incorrect')
        .empty();
    }
  };

  /**
   * Apply visual feedback on the answer input. Textual solution only when enabled.
   *
   * @param {boolean} isCorrect
   */
  AlphabetWheel.prototype.setAnswerFeedback = function (isCorrect) {
    var stateClass = isCorrect ? 'is-correct' : 'is-incorrect';

    this.clearAnswerFeedback();

    if (this.$answerField) {
      this.$answerField.addClass(stateClass);
    }
    if (this.$answerInput) {
      this.$answerInput.addClass(stateClass);
    }
    if (this.$answerIcon) {
      this.$answerIcon.addClass(
        isCorrect ? 'fa fa-check' : 'fa fa-times'
      );
    }

    // Text only when revealing the solution after an incorrect answer.
    if (!isCorrect && this.options.showSolution && this.$feedback) {
      this.$feedback
        .addClass('is-incorrect')
        .text(replaceTokens(this.options.l10n.incorrectFeedbackWithSolution, {
          answer: this.currentLetter.answer
        }));
    }
  };

  AlphabetWheel.prototype.checkAnswer = function () {
    var self = this;
    var userAnswer;
    var correctAnswer;
    var letter;
    var isCorrect;
    var alternatives;

    if (!self.currentLetter || self.finished) {
      return;
    }

    userAnswer = String(self.$answerInput.val() || '').trim();
    correctAnswer = String(self.currentLetter.answer || '');
    letter = String(self.currentLetter.letter).toUpperCase();

    if (!userAnswer) {
      self.$feedback.text(self.options.l10n.emptyAnswer);
      return;
    }

    self.answered = true;

    if (!self.options.caseSensitive) {
      userAnswer = userAnswer.toLowerCase();
      correctAnswer = correctAnswer.toLowerCase();
    }

    if (self.options.ignoreAccents) {
      userAnswer = self.removeAccents(userAnswer);
      correctAnswer = self.removeAccents(correctAnswer);
    }

    isCorrect = userAnswer === correctAnswer;

    if (!isCorrect && self.currentLetter.alternatives) {
      alternatives = String(self.currentLetter.alternatives).split(',').map(function (alt) {
        return alt.trim();
      });

      isCorrect = alternatives.some(function (alt) {
        var normalizedAlt = alt;
        if (!self.options.caseSensitive) {
          normalizedAlt = normalizedAlt.toLowerCase();
        }
        if (self.options.ignoreAccents) {
          normalizedAlt = self.removeAccents(normalizedAlt);
        }
        return userAnswer === normalizedAlt;
      });
    }

    self.gameState[letter].answered = true;
    self.gameState[letter].correct = isCorrect;
    self.gameState[letter].attempts += 1;

    clearInterval(self.letterElements[letter].data('interval'));
    self.letterElements[letter]
      .stop()
      .css('opacity', 1)
      .removeClass('correct wrong pending')
      .addClass(isCorrect ? 'correct' : 'wrong');

    self.setAnswerFeedback(isCorrect);

    if (isCorrect) {
      self.score += 1;
      if (self.options.showScore && self.$score) {
        self.$score.find('.h5p-aw-score-value').text(self.score);
      }
    }

    if (typeof self.triggerXAPI === 'function') {
      self.triggerXAPI('interacted');
    }

    setTimeout(function () {
      self.selectNextAvailableLetter();
    }, 1500);
  };

  AlphabetWheel.prototype.passLetter = function () {
    var self = this;
    var letter;

    if (!self.currentLetter || self.finished) {
      return;
    }

    letter = String(self.currentLetter.letter).toUpperCase();
    self.gameState[letter].passed = true;
    self.answered = true;
    self.clearAnswerFeedback();

    clearInterval(self.letterElements[letter].data('interval'));
    self.letterElements[letter].stop().css('opacity', 1);

    if (typeof self.triggerXAPI === 'function') {
      self.triggerXAPI('interacted');
    }

    self.selectNextAvailableLetter();
  };

  AlphabetWheel.prototype.selectNextAvailableLetter = function () {
    var self = this;
    var currentIndex = -1;
    var nextIndex;
    var startIndex;
    var found = false;
    var letter;
    var index;

    if (!self.options.letters.length) {
      self.endGame();
      return;
    }

    for (index = 0; index < self.options.letters.length; index += 1) {
      if (
        self.currentLetter &&
        String(self.options.letters[index].letter).toUpperCase() ===
          String(self.currentLetter.letter).toUpperCase()
      ) {
        currentIndex = index;
        break;
      }
    }

    nextIndex = (currentIndex + 1) % self.options.letters.length;
    startIndex = nextIndex;

    do {
      letter = String(self.options.letters[nextIndex].letter).toUpperCase();
      if (!self.gameState[letter].answered && !self.gameState[letter].passed) {
        self.selectLetter(letter);
        found = true;
        break;
      }
      nextIndex = (nextIndex + 1) % self.options.letters.length;
    } while (nextIndex !== startIndex);

    if (!found) {
      for (letter in self.gameState) {
        if (
          Object.prototype.hasOwnProperty.call(self.gameState, letter) &&
          self.gameState[letter].passed &&
          !self.gameState[letter].answered
        ) {
          self.gameState[letter].passed = false;
          found = true;
        }
      }

      if (found) {
        self.selectNextAvailableLetter();
        return;
      }

      self.endGame();
    }
  };

  AlphabetWheel.prototype.startTimer = function () {
    var self = this;

    self.stopTimer();

    if (!self.hasContent || self.finished) {
      return;
    }

    self.timerInterval = setInterval(function () {
      self.timeLeft -= 1;
      if (self.$timer) {
        self.$timer.find('.h5p-aw-time').text(self.timeLeft);
      }

      if (self.timeLeft <= 0) {
        self.stopTimer();
        self.endGame();
      }
    }, 1000);
  };

  AlphabetWheel.prototype.stopTimer = function () {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  };

  /**
   * Clear blink timers on letter nodes.
   */
  AlphabetWheel.prototype.clearLetterAnimations = function () {
    var letter;

    for (letter in this.letterElements) {
      if (Object.prototype.hasOwnProperty.call(this.letterElements, letter)) {
        clearInterval(this.letterElements[letter].data('interval'));
        this.letterElements[letter].stop().css('opacity', 1);
      }
    }
  };

  AlphabetWheel.prototype.endGame = function () {
    var score;
    var maxScore;

    if (this.finished) {
      return;
    }

    this.finished = true;
    this.stopTimer();
    this.clearLetterAnimations();

    score = this.getScore();
    maxScore = this.getMaxScore();
    this.finalScore = score;
    this.finalMaxScore = maxScore;

    this.showResultView();
    this.showOverallFeedback(score, maxScore);

    this.hideButton('try-again');
    if (this.options.enableRetry) {
      this.showButton('try-again');
    }

    this.triggerXAPIScored(score, maxScore, 'answered');
    this.triggerXAPIScored(
      score,
      maxScore,
      'completed',
      true,
      maxScore > 0 && score === maxScore
    );
    this.trigger('resize');
  };

  /**
   * Inline overall feedback on the results slide.
   *
   * @param {number} score
   * @param {number} maxScore
   */
  AlphabetWheel.prototype.showOverallFeedback = function (score, maxScore) {
    var ratio = maxScore > 0 ? score / maxScore : 0;
    var resolved = H5P.QuestionCFRD.resolveOverallFeedback(
      this.params.overallFeedback,
      ratio,
      this.contentId,
      score,
      maxScore
    );
    var hasMessage = resolved && resolved.html && resolved.html.trim().length > 0;

    this.setFeedback(
      hasMessage ? resolved.html : '',
      score,
      maxScore,
      this.options.l10n.scoreBarLabel
    );

    if (!hasMessage) {
      this.$resultFeedback
        .children('.h5p-question-feedback')
        .not('.h5p-question-popup')
        .remove();
    }
  };

  /**
   * @param {string} str
   * @returns {string}
   */
  AlphabetWheel.prototype.removeAccents = function (str) {
    return String(str || '')
      .replace(/Ñ/g, '\u0001')
      .replace(/ñ/g, '\u0002')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\u0001/g, 'Ñ')
      .replace(/\u0002/g, 'ñ');
  };

  AlphabetWheel.prototype.resetTask = function () {
    this.hideButton('try-again');
    this.removeFeedback();
    this.finished = false;
    this.answered = false;
    this.score = 0;
    this.finalScore = 0;
    this.finalMaxScore = 0;
    this.timeLeft = this.options.timeLimit;
    this._cfrdActivityStartEnsured = false;
    this.options.letters = filterPlayableLetters(this.params.letters);
    this.hasContent = this.options.letters.length > 0;
    this.buildGameDom();
    this.showGameView();

    if (this.hasContent) {
      this.startTimer();
      this.selectNextAvailableLetter();
    }

    delete this.activityStartTime;
    this.setActivityStarted();
    this.trigger('resize');
  };

  /**
   * @returns {boolean}
   */
  AlphabetWheel.prototype.getAnswerGiven = function () {
    return this.answered || this.finished;
  };

  /**
   * @returns {number}
   */
  AlphabetWheel.prototype.getScore = function () {
    var letter;
    var correct = 0;

    for (letter in this.gameState) {
      if (
        Object.prototype.hasOwnProperty.call(this.gameState, letter) &&
        this.gameState[letter] &&
        this.gameState[letter].correct
      ) {
        correct += 1;
      }
    }

    return correct;
  };

  /**
   * @returns {number}
   */
  AlphabetWheel.prototype.getMaxScore = function () {
    return this.options.letters.length;
  };

  /**
   * @returns {object}
   */
  AlphabetWheel.prototype.getCopyrights = function () {
    return {
      title: 'Alphabet Wheel',
      author: 'Ariel Hernández Friz',
      license: 'MIT'
    };
  };

  return AlphabetWheel;
})(H5P.jQuery);
