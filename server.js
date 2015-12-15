var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.use(express.static('public'));

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});

io.on('connection', function(socket){
  var playerId;

  socket.on('createPlayer', function (playerName) {
    console.log('connected', io.engine.clientsCount);
    var playerTypeKey = Object.keys(PLAYER_TYPES)[Math.floor(Math.random() * 5)];
    var player = new Player(PLAYER_TYPES[playerTypeKey], playerName, socket);
    socket.on('changeDirection', function (direction) {
      var playerId = player.id;
      //players.forEach(function (player) {
        //if (playerId == player.id) {
          //player.changeDirection(direction);
        //}
      //});
      player.changeDirection(direction);
    });

    playerId = player.id;

    socket.emit('playerCreated', playerId);


    players.push(player);
    livingPlayers[player.id] = socket;
    console.log('createPlayer', playerId);
  });


  socket.on('disconect', function () {
    console.log('userDisconected', playerId);
    players = players.filter(function (player) {
      return player.id !== playerId;
    });
    delete livingPlayers[playerId];
  });

  console.log('a user connected');
});

// Here comes the game logic
var PLAYER_TYPES = {
  burn: 'BURN',// Reduces enemies size
  icy: 'ICY',// Reduces enemies speed
  tempo: 'TEMPO',// Freezes enemies
  mirror: 'MIRROR',
  void: 'VOID',
  npc: 'NPC'
}

var WORLD_SIZE = 10000;
var MAX_PLAYER_SIZE = 1000;
var players = [];
var livingPlayers = {};
var lastPlayerCount = 0;
var MIN_PLAYERS = 50;

function getSafePosition(npc) {
  return {
    x: Math.floor(Math.random() * WORLD_SIZE),
    y: Math.floor(Math.random() * WORLD_SIZE)
  };
}

function Player(type, name, socket) {
  this.name = name;
  this.type = type;
  this.speed =  {
    dx: 0,
    dy: 0
  };
  this.position = getSafePosition(type === PLAYER_TYPES.npc);
  this.sizeDisambiguation = Math.random();
  if (type === PLAYER_TYPES.npc) {
    this.size = Math.random() * 10;
  } else {
    this.size = 30;
    this.id = 'player' + lastPlayerCount;
    lastPlayerCount += 1;
  }

  function getDistance(player1, player2) {
    return Math.sqrt(
      Math.pow(player2.position.x - player1.position.x, 2)  +
        Math.pow(player2.position.y - player1.position.y, 2)
    );
  }

  function colides(player2) {
    return getDistance(this, player2) < (player2.size + this.size);
  }

  function getNPCSpeed(defaultSpeed) {
    var speeds = [
      {
        dx: 0,
        dy: 1
      },
      {
        dx: 0,
        dy: -1
      },
      {
        dx: 1,
        dy: 0
      },
      {
        dx: -1,
        dy: 0
      },
      {
        dx: 1,
        dy: 1
      },
      {
        dx: -1,
        dy: -1
      },
      {
        dx: 1,
        dy: -1
      },
      {
        dx: -1,
        dy: 1
      }
    ];

    if (Math.floor(Math.random() * 4) === 0) {
      return speeds[Math.floor(Math.random() * 8)];
    }

    return defaultSpeed;
  }

  function updateSpeed() {
    if (this.type === PLAYER_TYPES.npc) {
      this.speed = getNPCSpeed(this.speed);

      if (this.size > MAX_PLAYER_SIZE / 2) {
        this.size = MAX_PLAYER_SIZE / 2;
      }
    }
    var xS = this.speed.dx / Math.abs(this.speed.dx || 1),
        yS = this.speed.dy / Math.abs(this.speed.dy || 1);

    if (this.size >= MAX_PLAYER_SIZE) {
      this.size = MAX_PLAYER_SIZE - 1;
    }
    this.speed.dx = (MAX_PLAYER_SIZE - this.size) * xS;
    this.speed.dy = (MAX_PLAYER_SIZE - this.size) * yS;
  }

  function setSpeed(dx, dy) {
    this.speed.dx = dx;
    this.speed.dy = dy;
  }

  function normalizePosition() {
    if (this.position.x - (this.size) < 0) {
      this.position.x = this.size;
    } else if (this.position.x + this.size > WORLD_SIZE) {
      this.position.x = WORLD_SIZE - this.size;
    }

    if (this.position.y - this.size < 0) {
      this.position.y = this.size;
    } else if (this.position.y + this.size > WORLD_SIZE) {
      this.position.y = WORLD_SIZE - this.size;
    }
  }

  function eat(player) {
    player.die();
    this.size += player.size;
  }

  function move() {
    updateSpeed.call(this);
    var sX =  Math.abs(this.speed.dx) / (this.speed.dx || 1);
    var sY =  Math.abs(this.speed.dy) / (this.speed.dy || 1);

    this.position.x += Math.max(Math.abs(this.speed.dx), 20) / 20 * sX;
    this.position.y += Math.max(Math.abs(this.speed.dy), 20) / 20 * sY;

    normalizePosition.call(this);
  }

  function changeDirection(direction) {
    console.log('changeDirection', direction);
    if (direction === 'Left') {
      this.speed.dx = -1;
      this.speed.dy = 0;
    } else if (direction === 'Right') {
      this.speed.dx = 1;
      this.speed.dy = 0;
    } else if (direction === 'Up') {
      this.speed.dx = 0;
      this.speed.dy = -1;
    } else if (direction === 'Down') {
      this.speed.dx = 0;
      this.speed.dy = 1;
    }
  }

  function die() {
    if (socket) {
      socket.emit('gameOver');
    }
  }

  this.changeDirection = changeDirection;
  this.setSpeed = setSpeed;
  this.colides = colides;
  this.move = move;
  this.eat = eat;
  this.die = die;
}


function getSurvivingPlayers(players) {
  return players.filter(function (player1, i) {
    return !players.some(function (player2, j) {
      var theyColide = player1.colides(player2);
      var dies = theyColide && (player2.size > player1.size || (player2.size === player1.size && player2.sizeDisambiguation > player1.sizeDisambiguation));

      if (dies) {
        player2.eat(player1);
      }

      return dies;
    });
  });
}

function sendUpdatedPlayers(players) {
  io.emit('updatePlayers', players);
}

function updatePlayers(players) {
  players.forEach(function (player) {
    player.move();
  });
}

function createNPCPlayers(howMany) {
  var i, npcPlayers = [];

  for (i = 0; i < howMany; i+= 1) {
    npcPlayers.push(new Player(PLAYER_TYPES.npc, 'NPC'));
  }

  return npcPlayers;
}

function tick() {
  var newPlayers = getSurvivingPlayers(players);
  if (newPlayers.length < MIN_PLAYERS) {
    newPlayers = newPlayers.concat(createNPCPlayers(MIN_PLAYERS - newPlayers.length));
  }
  //TODO: move npc players
  updatePlayers(newPlayers);

  sendUpdatedPlayers(newPlayers);
  players = newPlayers;
}

//players.push(new Player(PLAYER_TYPES.burn, 'pablito', 500, 500));

setInterval(tick, 15);
