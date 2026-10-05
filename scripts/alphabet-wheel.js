var H5P = H5P || {};

/**
 * Alphabet Wheel — letter-wheel quiz (line 0.1).
 * Phase D: play area 16:9 scaling.
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
   * @param {AlphabetWheel} instance
   * @returns {boolean}
   */
  function isEmbeddedInstance(instance) {
    return !!(instance && typeof instance.isRoot === 'function' && !instance.isRoot());
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
    var design;
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
      title: 'Alphabet Wheel',
      timeLimit: 300,
      letters: [],
      behaviour: {
        caseSensitive: false,
        ignoreAccents: true,
        allowPass: true,
        showScore: true,
        enableRetry: true
      },
      overallFeedback: {
        overallFeedback: []
      },
      design: {
        wheelColor: '#3498db',
        correctColor: '#2ecc71',
        wrongColor: '#e74c3c'
      },
      l10n: {
        submitButton: 'Answer',
        passButton: 'Pass',
        tryAgain: 'Try again',
        showSolution: 'Show solution',
        answerPlaceholder: 'Type your answer...',
        timeLabel: 'Time: @time s',
        scoreLabel: 'Score: @score',
        emptyContent: 'Add at least one letter with a definition and a correct answer.',
        emptyAnswer: 'Please enter an answer',
        correctFeedback: 'Correct!',
        incorrectFeedback: 'Incorrect. The answer was: @answer',
        finishedLabel: 'Game finished',
        finishedSummary: 'Correct answers: @score/@total',
        scoreBarLabel: 'You got :num out of :total points'
      }
    }, params || {});

    behaviour = this.params.behaviour || {};
    design = this.params.design || {};

    this.options = {
      title: this.params.title,
      timeLimit: Math.max(30, Number(this.params.timeLimit) || 300),
      letters: filterPlayableLetters(this.params.letters),
      caseSensitive: isOn(behaviour.caseSensitive),
      ignoreAccents: behaviour.ignoreAccents === undefined ? true : isOn(behaviour.ignoreAccents),
      allowPass: behaviour.allowPass === undefined ? true : isOn(behaviour.allowPass),
      showScore: behaviour.showScore === undefined ? true : isOn(behaviour.showScore),
      enableRetry: behaviour.enableRetry === undefined ? true : isOn(behaviour.enableRetry),
      wheelColor: design.wheelColor || '#3498db',
      correctColor: design.correctColor || '#2ecc71',
      wrongColor: design.wrongColor || '#e74c3c',
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

      self.observePlayAreaResize();
      self.syncFullscreenLayout(true);

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

    this.$resultSummary = $('<div>', { 'class': 'h5p-aw-result-summary' });
    this.$resultFeedback = $('<div>', {
      'class': 'h5p-aw-result-feedback',
      tabindex: '-1'
    });
    this.$resultButtons = $('<div>', { 'class': 'h5p-aw-result-buttons' });
    this.$resultView.append(this.$resultSummary, this.$resultFeedback, this.$resultButtons);

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
    var $controls = $('<div>', { 'class': 'h5p-aw-controls' });
    var letterCount = self.options.letters.length;
    // Design units in em (base font 16px → 11.25em ≈ 180px radius).
    var radius = 11.25;
    var centerOffset = radius + 1.25;
    var startAngle = -90;

    self.$gameView.append(
      $('<div>', { 'class': 'h5p-aw-title', text: self.options.title })
    );

    self.$timer = $('<div>', {
      'class': 'h5p-aw-timer',
      html: replaceTokens(self.options.l10n.timeLabel, {
        time: '<span class="h5p-aw-time">' + self.timeLeft + '</span>'
      })
    });
    self.$gameView.append(self.$timer);

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
        backgroundColor: self.options.wheelColor,
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
    $gameArea.append(self.$answerInput);

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

    if (self.options.showScore) {
      self.$score = $('<div>', {
        'class': 'h5p-aw-score',
        html: replaceTokens(self.options.l10n.scoreLabel, {
          score: '<span class="h5p-aw-score-value">0</span>'
        })
      });
      $gameArea.append(self.$score);
    }

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
      self.$definition.text(selectedLetter.definition || '');
      self.$answerInput.val('').prop('disabled', false).show().focus();
      self.$submitBtn.show();
      if (self.options.allowPass) {
        self.$passBtn.show();
      }
      self.$feedback.empty();

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
    self.letterElements[letter].stop().css('opacity', 1)
      .css('background-color', isCorrect ? self.options.correctColor : self.options.wrongColor);

    if (isCorrect) {
      self.$feedback.text(self.options.l10n.correctFeedback);
      self.score += 1;
      if (self.options.showScore && self.$score) {
        self.$score.find('.h5p-aw-score-value').text(self.score);
      }
    }
    else {
      self.$feedback.text(replaceTokens(self.options.l10n.incorrectFeedback, {
        answer: self.currentLetter.answer
      }));
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

    this.$resultSummary.html(
      '<strong class="h5p-aw-result-heading">' + this.options.l10n.finishedLabel + '</strong>' +
      '<p class="h5p-aw-result-text">' +
      replaceTokens(this.options.l10n.finishedSummary, {
        score: score,
        total: maxScore
      }) +
      '</p>'
    );

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
      title: this.options.title || 'Alphabet Wheel',
      author: 'Ariel Hernández Friz',
      license: 'MIT'
    };
  };

  return AlphabetWheel;
})(H5P.jQuery);
