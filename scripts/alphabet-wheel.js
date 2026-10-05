var H5P = H5P || {};

/**
 * Alphabet Wheel — letter-wheel quiz (prototype line 0.1).
 * Phase A: CFRD identity, flat params, optional Ñ. Question/xAPI polish in later phases.
 */
H5P.AlphabetWheel = (function ($) {
  /**
   * @param {*} value
   * @returns {boolean}
   */
  function isOn(value) {
    return value === true || value === 1 || value === '1' || value === 'true';
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
   * Insert Ñ after N when missing.
   *
   * @param {Array} letters
   * @returns {Array}
   */
  function ensureLetterEnye(letters) {
    var list = (letters || []).slice();
    var hasEnye = list.some(function (item) {
      return item && String(item.letter || '').toUpperCase() === 'Ñ';
    });
    var insertAt = -1;
    var index;

    if (hasEnye) {
      return list;
    }

    for (index = 0; index < list.length; index += 1) {
      if (list[index] && String(list[index].letter || '').toUpperCase() === 'N') {
        insertAt = index + 1;
        break;
      }
    }

    if (insertAt < 0) {
      list.push({ letter: 'Ñ', definition: '', answer: '' });
      return list;
    }

    list.splice(insertAt, 0, { letter: 'Ñ', definition: '', answer: '' });
    return list;
  }

  /**
   * @param {object} params
   * @param {number} contentId
   * @param {object} contentData
   */
  function AlphabetWheel(params, contentId, contentData) {
    var defaults;
    var behaviour;
    var design;
    var l10n;

    H5P.EventDispatcher.call(this);

    defaults = {
      title: 'Alphabet Wheel',
      timeLimit: 300,
      letters: [],
      behaviour: {
        includeLetterEnye: false,
        caseSensitive: false,
        ignoreAccents: true,
        allowPass: true,
        showScore: true
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
        scoreLabel: 'Score: @score'
      }
    };

    this.params = $.extend(true, {}, defaults, params || {});
    this.contentId = contentId;
    this.contentData = contentData;

    behaviour = this.params.behaviour || {};
    design = this.params.design || {};
    l10n = this.params.l10n || {};

    this.options = {
      title: this.params.title,
      timeLimit: Number(this.params.timeLimit) || 300,
      letters: (this.params.letters || []).filter(function (item) {
        return item && String(item.letter || '').trim().length > 0;
      }),
      caseSensitive: isOn(behaviour.caseSensitive),
      ignoreAccents: behaviour.ignoreAccents === undefined ? true : isOn(behaviour.ignoreAccents),
      allowPass: behaviour.allowPass === undefined ? true : isOn(behaviour.allowPass),
      showScore: behaviour.showScore === undefined ? true : isOn(behaviour.showScore),
      includeLetterEnye: isOn(behaviour.includeLetterEnye),
      wheelColor: design.wheelColor || '#3498db',
      correctColor: design.correctColor || '#2ecc71',
      wrongColor: design.wrongColor || '#e74c3c',
      l10n: l10n
    };

    if (this.options.includeLetterEnye) {
      this.options.letters = ensureLetterEnye(this.options.letters);
    }

    this.currentLetter = null;
    this.score = 0;
    this.timeLeft = this.options.timeLimit;
    this.timerInterval = null;
    this.gameState = {};
    this.letterElements = {};
  }

  AlphabetWheel.prototype = Object.create(H5P.EventDispatcher.prototype);
  AlphabetWheel.prototype.constructor = AlphabetWheel;

  /**
   * @param {H5P.jQuery} $container
   */
  AlphabetWheel.prototype.attach = function ($container) {
    var self = this;

    self.$container = $container;
    $container.addClass('h5p-alphabet-wheel');
    $container.empty();

    self.initGameState();
    self.createGameStructure();
    self.setupInteractions();
    self.startTimer();
    self.selectNextAvailableLetter();
  };

  AlphabetWheel.prototype.initGameState = function () {
    var self = this;

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
    var radius = 180;
    var centerOffset = radius + 20;
    var startAngle = -90;

    self.$container.append(
      $('<div>', { 'class': 'h5p-aw-title', text: self.options.title })
    );

    self.$timer = $('<div>', {
      'class': 'h5p-aw-timer',
      html: replaceTokens(self.options.l10n.timeLabel, { time: '<span class="h5p-aw-time">' + self.timeLeft + '</span>' })
    });
    self.$container.append(self.$timer);

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
        left: (centerOffset + x) + 'px',
        top: (centerOffset + y) + 'px',
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
        html: replaceTokens(self.options.l10n.scoreLabel, { score: '<span>0</span>' })
      });
      $gameArea.append(self.$score);
    }

    $gameContainer.append($gameArea);
    self.$container.append($gameContainer);
  };

  AlphabetWheel.prototype.setupInteractions = function () {
    var self = this;

    self.$container.on('click', '.h5p-aw-letter', function () {
      self.selectLetter($(this).data('letter'));
    });

    self.$submitBtn.on('click', function () {
      self.checkAnswer();
    });

    self.$answerInput.on('keypress', function (event) {
      if (event.which === 13) {
        self.checkAnswer();
      }
    });

    self.$passBtn.on('click', function () {
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

    if (self.currentLetter) {
      self.letterElements[String(self.currentLetter.letter).toUpperCase()]
        .stop()
        .css('opacity', 1);
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
      self.$answerInput.val('').focus();
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

    if (!self.currentLetter) {
      return;
    }

    userAnswer = String(self.$answerInput.val() || '').trim();
    correctAnswer = String(self.currentLetter.answer || '');
    letter = String(self.currentLetter.letter).toUpperCase();

    if (!userAnswer) {
      self.$feedback.text('Please enter an answer');
      return;
    }

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
      self.$feedback.text('Correct!');
      self.score += 1;
      if (self.options.showScore && self.$score) {
        self.$score.find('span').text(self.score);
      }
    }
    else {
      self.$feedback.text('Incorrect. The answer was: ' + self.currentLetter.answer);
    }

    setTimeout(function () {
      self.selectNextAvailableLetter();
    }, 1500);
  };

  AlphabetWheel.prototype.passLetter = function () {
    var self = this;
    var letter;

    if (!self.currentLetter) {
      return;
    }

    letter = String(self.currentLetter.letter).toUpperCase();
    self.gameState[letter].passed = true;

    clearInterval(self.letterElements[letter].data('interval'));
    self.letterElements[letter].stop().css('opacity', 1);

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

    if (!self.options.letters.length) {
      self.endGame();
      return;
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
      self.endGame();
    }
  };

  AlphabetWheel.prototype.startTimer = function () {
    var self = this;

    self.timerInterval = setInterval(function () {
      self.timeLeft -= 1;
      self.$timer.find('.h5p-aw-time').text(self.timeLeft);

      if (self.timeLeft <= 0) {
        clearInterval(self.timerInterval);
        self.endGame();
      }
    }, 1000);
  };

  AlphabetWheel.prototype.endGame = function () {
    var self = this;
    var totalLetters = self.options.letters.length;
    var correctAnswers = 0;
    var letter;
    var state;

    clearInterval(self.timerInterval);

    if (self.currentLetter) {
      letter = String(self.currentLetter.letter).toUpperCase();
      clearInterval(self.letterElements[letter].data('interval'));
    }

    for (letter in self.gameState) {
      if (Object.prototype.hasOwnProperty.call(self.gameState, letter)) {
        state = self.gameState[letter];
        if (state && state.correct) {
          correctAnswers += 1;
        }
      }
    }

    self.$definition.html(
      '<strong>Game finished</strong><br>' +
      'Correct answers: ' + correctAnswers + '/' + totalLetters
    );
    self.$answerInput.hide();
    self.$submitBtn.hide();
    self.$passBtn.hide();

    if (typeof self.triggerXAPI === 'function') {
      self.triggerXAPI('completed', {
        score: totalLetters ? Math.round((correctAnswers / totalLetters) * 100) : 0,
        correctAnswers: correctAnswers,
        totalQuestions: totalLetters,
        timeSpent: self.options.timeLimit - self.timeLeft
      });
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
