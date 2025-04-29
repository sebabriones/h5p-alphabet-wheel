var H5P = H5P || {};

H5P.Pasapalabra = (function ($) {

    /**
    * Constructor principal
    * @param {Object} options - Configuraciones del juego
    * @param {number} id - ID único de la instancia
    */

  function C(options, id) {
    this.options = $.extend(true, {}, {
      title: 'Pasapalabra',
      timeLimit: 300,
      letters: [],
      showSolutionText: 'Mostrar solución',
      tryAgainText: 'Intentar otra vez',
      caseSensitive: false,
      ignoreAccents: true,
      allowPasapalabra: true,
      showScore: true,
      roscoColor: '#3498db',
      correctColor: '#2ecc71',
      wrongColor: '#e74c3c'
    }, options);
    
    this.id = id;
    this.currentLetter = null;
    this.score = 0;
    this.timeLeft = this.options.timeLimit;
    this.timerInterval = null;
    this.gameState = {};
    this.letterElements = {};
  };

  C.prototype.attach = function ($container) {
    var self = this;
    self.$container = $container;
    
    $container.addClass("h5p-pasapalabra");
    $container.empty();
    
    self.initGameState();
    self.createGameStructure();
    self.setupInteractions();
    self.startTimer();
    self.selectNextAvailableLetter();
  };
  
  C.prototype.initGameState = function() {
    this.options.letters.forEach(function(letterObj) {
      var letter = letterObj.letter.toUpperCase();
      this.gameState[letter] = {
        answered: false,
        correct: false,
        passed: false,
        attempts: 0
      };
    }.bind(this));
  };

  C.prototype.createGameStructure = function() {
    var self = this;
    
    // Título
    self.$container.append('<div class="pasapalabra-title">' + self.options.title + '</div>');
    
    // Temporizador
    self.$timer = $('<div class="pasapalabra-timer">Tiempo: <span class="time">' + 
                   self.timeLeft + '</span>s</div>');
    self.$container.append(self.$timer);
    
    // Contenedor principal
    var $gameContainer = $('<div class="pasapalabra-game-container"></div>');
    
    // Rosco de letras
    var $rosco = $('<div class="pasapalabra-rosco"></div>');
    var letterCount = self.options.letters.length;

    // Ajustes de configuración visual
    var radius = 180; // Aumentamos el radio para mayor separación
    var centerOffset = radius + 20; // Añadimos margen adicional
    var startAngle = -90; // Empezamos a las 12 en punto (-90 grados en sistema de coordenadas)
    
    self.options.letters.forEach(function(letterObj, index) {
      var letter = letterObj.letter.toUpperCase();

    // Calculamos el ángulo para cada letra:
    // - startAngle: Comenzamos a las 12 (-90 grados)
    // - index * (360 / letterCount): Distribución equitativa
    //var angle = (index * 360 / letterCount) % 360;
      var angle = startAngle + (index * (360 / letterCount));

    // Convertimos el ángulo a radianes para cálculos trigonométricos
    var angleRad = angle * Math.PI / 180;
    var $letter = $('<div class="pasapalabra-letter" data-letter="' + letter + '">' + letter + '</div>');
      
      //var x = radius * Math.cos(angle * Math.PI / 180);
      //var y = radius * Math.sin(angle * Math.PI / 180);

    // Calculamos posición (x,y) usando trigonometría:
    // - cos(angle) para la coordenada x (horizontal)
    // - sin(angle) para la coordenada y (vertical)
    // Nota: El sistema de coordenadas en CSS tiene el eje Y invertido
    var x = radius * Math.cos(angleRad);
    var y = radius * Math.sin(angleRad);

     // Creamos el elemento de la letra
    var $letter = $('<div class="pasapalabra-letter" data-letter="' + letter + '">' + letter + '</div>');
      
    // Posicionamos la letra:
    // - left: centro + posición x (ajustamos con centerOffset)
    // - top: centro + posición y (ajustamos con centerOffset)
    // - Añadimos transformación para centrar perfectamente el elemento
    $letter.css({
        left: (centerOffset + x) + 'px',
        top: (centerOffset + y) + 'px',
        backgroundColor: self.options.roscoColor,
        transform: 'translate(-50%, -50%)' // Centra el elemento en su posición
    });
      
    // Añadimos la letra al rosco
    $rosco.append($letter);

    // Guardamos referencia para manipulación posterior
    self.letterElements[letter] = $letter;
    });
    
    $gameContainer.append($rosco);
    
    // Área de juego derecha
    var $gameArea = $('<div class="pasapalabra-game-area"></div>');
    
    // Definición actual
    self.$definition = $('<div class="pasapalabra-definition"></div>');
    $gameArea.append(self.$definition);
    
    // Entrada de respuesta
    self.$answerInput = $('<input type="text" class="pasapalabra-answer" placeholder="Escribe tu respuesta...">');
    $gameArea.append(self.$answerInput);
    
    // Controles
    var $controls = $('<div class="pasapalabra-controls"></div>');
    self.$submitBtn = $('<button class="pasapalabra-submit">Responder</button>');
    self.$passBtn = $('<button class="pasapalabra-pasapalabra">Pasapalabra</button>');
    
    if (!self.options.allowPasapalabra) {
      self.$passBtn.hide();
    }
    
    $controls.append(self.$submitBtn);
    $controls.append(self.$passBtn);
    $gameArea.append($controls);
    
    // Feedback
    self.$feedback = $('<div class="pasapalabra-feedback"></div>');
    $gameArea.append(self.$feedback);
    
    // Puntuación
    if (self.options.showScore) {
      self.$score = $('<div class="pasapalabra-score">Puntuación: <span>0</span></div>');
      $gameArea.append(self.$score);
    }
    
    $gameContainer.append($gameArea);
    self.$container.append($gameContainer);
  };
  
  C.prototype.setupInteractions = function() {
    var self = this;
    
    // Clic en letra
    self.$container.on('click', '.pasapalabra-letter', function() {
      var letter = $(this).data('letter');
      self.selectLetter(letter);
    });
    
    // Enviar respuesta
    self.$submitBtn.click(function() {
      self.checkAnswer();
    });
    
    // Tecla Enter en input
    self.$answerInput.keypress(function(e) {
      if (e.which === 13) {
        self.checkAnswer();
      }
    });
    
    // Pasapalabra
    self.$passBtn.click(function() {
      self.passLetter();
    });
  };
  
  C.prototype.selectLetter = function(letter) {
    var self = this;
    
    // Desactivar letra actual
    if (self.currentLetter) {
      self.letterElements[self.currentLetter.letter].stop().css('opacity', 1);
    }
    
    // Encontrar la letra seleccionada
    var selectedLetter = self.options.letters.find(function(l) {
      return l.letter.toUpperCase() === letter;
    });
    
    if (selectedLetter && !self.gameState[letter].answered) {
      self.currentLetter = selectedLetter;
      self.$definition.text(selectedLetter.definition);
      self.$answerInput.val('').focus();
      self.$feedback.empty();
      
      // Efecto de parpadeo
      self.letterElements[letter].animate(
        { opacity: 0.3 },
        500,
        'linear',
        function() {
          $(this).animate({ opacity: 1 }, 500, 'linear');
        }
      ).data('interval', setInterval(function() {
        self.letterElements[letter].animate(
          { opacity: 0.5 },
          500,
          'linear',
          function() {
            $(this).animate({ opacity: 1 }, 500, 'linear');
          }
        );
      }, 1000));
    }
  };
  
  C.prototype.checkAnswer = function() {
    var self = this;
    if (!self.currentLetter) return;
    
    var userAnswer = self.$answerInput.val().trim();
    var correctAnswer = self.currentLetter.answer;
    var letter = self.currentLetter.letter.toUpperCase();
    
    if (!userAnswer) {
      self.$feedback.text('Por favor ingresa una respuesta');
      return;
    }
    
    // Normalizar respuestas
    if (!self.options.caseSensitive) {
      userAnswer = userAnswer.toLowerCase();
      correctAnswer = correctAnswer.toLowerCase();
    }
    
    if (self.options.ignoreAccents) {
      userAnswer = self.removeAccents(userAnswer);
      correctAnswer = self.removeAccents(correctAnswer);
    }
    
    // Verificar respuesta
    var isCorrect = userAnswer === correctAnswer;
    
    // Verificar alternativas
    if (!isCorrect && self.currentLetter.alternatives) {
      var alternatives = self.currentLetter.alternatives.split(',').map(function(alt) {
        return alt.trim();
      });
      
      isCorrect = alternatives.some(function(alt) {
        var normalizedAlt = alt;
        if (!self.options.caseSensitive) normalizedAlt = normalizedAlt.toLowerCase();
        if (self.options.ignoreAccents) normalizedAlt = self.removeAccents(normalizedAlt);
        return userAnswer === normalizedAlt;
      });
    }
    
    // Actualizar estado
    self.gameState[letter].answered = true;
    self.gameState[letter].correct = isCorrect;
    self.gameState[letter].attempts++;
    
    // Actualizar UI
    clearInterval(self.letterElements[letter].data('interval'));
    self.letterElements[letter].stop().css('opacity', 1)
      .css('background-color', isCorrect ? self.options.correctColor : self.options.wrongColor);
    
    // Mostrar feedback
    if (isCorrect) {
      self.$feedback.text('¡Correcto!');
      self.score++;
      if (self.options.showScore) {
        self.$score.find('span').text(self.score);
      }
    } else {
      self.$feedback.text('Incorrecto. La respuesta era: ' + self.currentLetter.answer);
    }
    
    // Seleccionar siguiente letra
    setTimeout(function() {
      self.selectNextAvailableLetter();
    }, 1500);
  };
  
  C.prototype.passLetter = function() {
    var self = this;
    if (!self.currentLetter) return;
    
    var letter = self.currentLetter.letter.toUpperCase();
    self.gameState[letter].passed = true;
    
    clearInterval(self.letterElements[letter].data('interval'));
    self.letterElements[letter].stop().css('opacity', 1);
    
    self.selectNextAvailableLetter();
  };
  
  C.prototype.selectNextAvailableLetter = function() {
    var self = this;
    var currentIndex = self.options.letters.findIndex(function(l) {
      return l.letter.toUpperCase() === (self.currentLetter ? self.currentLetter.letter.toUpperCase() : '');
    });
    
    var nextIndex = (currentIndex + 1) % self.options.letters.length;
    var startIndex = nextIndex;
    var found = false;
    
    do {
      var letter = self.options.letters[nextIndex].letter.toUpperCase();
      if (!self.gameState[letter].answered && !self.gameState[letter].passed) {
        self.selectLetter(letter);
        found = true;
        break;
      }
      nextIndex = (nextIndex + 1) % self.options.letters.length;
    } while (nextIndex !== startIndex && !found);
    
    if (!found) {
      self.endGame();
    }
  };
  
  C.prototype.startTimer = function() {
    var self = this;
    self.timerInterval = setInterval(function() {
      self.timeLeft--;
      self.$timer.find('.time').text(self.timeLeft);
      
      if (self.timeLeft <= 0) {
        clearInterval(self.timerInterval);
        self.endGame();
      }
    }, 1000);
  };
  
  C.prototype.endGame = function() {
    var self = this;
    clearInterval(self.timerInterval);
    
    // Detener parpadeo de letra actual
    if (self.currentLetter) {
      var letter = self.currentLetter.letter.toUpperCase();
      clearInterval(self.letterElements[letter].data('interval'));
    }
    
    // Mostrar resultados
    var totalLetters = self.options.letters.length;
    var correctAnswers = Object.values(self.gameState).filter(state => state.correct).length;
    
    self.$definition.html('<strong>Juego terminado</strong><br>' +
                         'Respuestas correctas: ' + correctAnswers + '/' + totalLetters);
    self.$answerInput.hide();
    self.$submitBtn.hide();
    self.$passBtn.hide();
    
    // Disparar evento XAPI
    self.triggerXAPI('completed', {
      score: Math.round((correctAnswers / totalLetters) * 100),
      correctAnswers: correctAnswers,
      totalQuestions: totalLetters,
      timeSpent: self.options.timeLimit - self.timeLeft
    });
  };
  
  C.prototype.removeAccents = function(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  /**
 * Implementación requerida de getCopyrights
 */
C.prototype.getCopyrights = function() {
    return {
      title: this.options.title || 'Pasapalabra',
      author: this.options.author || 'Ariel Hernández Friz',
      license: this.options.license || 'MIT'
    };
  };

  return C;
})(H5P.jQuery);