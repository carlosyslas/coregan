'use strict';
const LOW_LIMIT = 0;
const HIGH_LIMIT = 10000;
let MAX_PLAYER_SIZE = 100;
let players = [];
let scale = d3.scale.linear();
let gridScale = d3.scale.linear();
var zoom = d3.behavior.zoom()
    //.x(scale)
    //.y(scale)
    //.scaleExtent([1, 32])
    .on("zoom", zoomed);
let zoomScale = d3.scale.linear();
let $svg = d3.select('#canvas');

scale.domain([0, HIGH_LIMIT])
  .range([0, $svg.node().clientWidth]);
gridScale.domain([0, HIGH_LIMIT * 3])
  .range([0, $svg.node().clientHeight * 3]);

zoomScale.domain([30, 1000])
  .range([3, 1]);

let yAxis = d3.svg.axis()
      .scale(gridScale)
      .orient('left')
      .ticks(240)
      .innerTickSize(-HIGH_LIMIT * 2)
      .outerTickSize(300);

let xAxis = d3.svg.axis()
      .scale(gridScale)
      .orient('bottom')
      .ticks(240)
      .innerTickSize(HIGH_LIMIT * 3)
      .outerTickSize(0);

function zoomed() {
  $canvas.attr('transform', d => `translate(${d3.event.translate}) scale(${d3.event.scale})`);
  $canvas.select(".x-axis").call(xAxis);
  $canvas.select(".y-axis").call(yAxis);
}


const playerColors = {
  'BURN': 'hsl(0, 70%, 50%)',
  'ICY': 'hsl(200, 70%, 50%)',
  'TEMPO': 'hsl(130, 70%, 50%)',
  'MIRROR': 'hsl(65, 70%, 50%)',
  'VOID': 'hsl(255, 70%, 50%)',
  'NPC': 'hsl(0, 0%, 80%)'
};
let playerId;

let $canvas = d3.select('#canvas').append('g').call(zoom).append('g');
$canvas.append('g')
  .attr('class', 'y-axis')
  .attr('transform', () => `translate(${scale(-5000)} ${scale(-5000)})`)
  .call(yAxis);

$canvas.append('g')
  .attr('class', 'x-axis')
  .attr('transform', () => `translate(${scale(-5000)} ${scale(-5000)})`)
  .call(xAxis);


$canvas.append('rect')
  .attr('stroke-width', 2)
  .attr('width', () => scale(HIGH_LIMIT))
  .attr('height', () => scale(HIGH_LIMIT))
  .attr('fill', 'transparent')
  .attr('stroke', '#fff');

$svg.append('g')
  .attr('transform', 'translate(10, 20)')
  .attr('class', 'player-count')
  .append('text')
  .attr('fill', '#fff')
  .text(players.length);

function createNewPlayers($players) {
  let $newPlayers = $players.enter()
        .append('g')
        .attr('class', 'player');

  $newPlayers
    .attr('transform', (d) => `translate(${scale(d.position.x - d.size)} ${scale(d.position.y - d.size)})`);

  $newPlayers
    .append('circle')
    .attr('r', (d) => scale(d.size))
    .attr('cx', (d) => scale(d.size))
    .attr('cy', (d) => scale(d.size))
    .attr('fill', (d) => d.color)
    .attr('fill-opacity', 0.8)
    .attr('stroke', (d) => d.color)
    .attr('stroke-width', 2);

  $newPlayers.append('text')
    .attr('x', d => scale(d.size))
    .attr('y', d => scale(d.size))
    .attr('text-anchor', 'middle')
    .attr('fill', '#fff')
    .attr('stroke', '#000')
    .text(d => d.type === 'NPC' ? '' : d.name);
}

function removeDeletedPlayers($players) {
  let $deletedPlayers = $players.exit();

  $players.exit()
    .remove();
}

function updateExistingPlayers($players) {
  $players.attr('transform', (d) => `translate(${scale(d.position.x - d.size)} ${scale(d.position.y - d.size)})`)
    .select('circle').attr('cx', (d) => scale(d.size))
    .attr('cy', (d) => scale(d.size))
    .attr('r', (d) => scale(d.size))
    .attr('fill', (d) => d.color)
    .attr('stroke', (d) => d.color)
    .each(function (d) {
      if (d.id && d.id === playerId) {
        let width = $svg.node().clientWidth;
        let height = $svg.node().clientHeight;
        let zoomLevel = zoomScale(d.size);
        zoom.translate([-scale(d.position.x) * zoomLevel + width / 2, -scale(d.position.y) * zoomLevel + height / 2]);
        zoom.scale(zoomLevel);
      }
      $canvas.attr('transform', d => `translate(${zoom.translate()}) scale(${zoom.scale()})`);
    });

  $players.select('text')
    .attr('x', d => scale(d.size))
    .attr('y', d => scale(d.size))
    .text(d => d.type === 'NPC' ? '' : d.name);
}

function render(players) {
  let $players = $canvas.selectAll('.player')
        .data(players);

  $svg.select('.player-count').select('text')
    .text(() => 'Players: ' + players.length);

  $players.call(createNewPlayers);
  $players.call(updateExistingPlayers);
  $players.call(removeDeletedPlayers);
}

function tick() {
  render();
}

let tickInterval = 15;
//tickInterval = 120;
let socket = io();

$svg.attr('background', '#000').attr('opacity', 0.7);
let bla = true;
d3.select(document.body).on('keyup', function () {
  if (['Left', 'Right', 'Up', 'Down'].indexOf(d3.event.keyIdentifier) > -1) {
    socket.emit('changeDirection', d3.event.keyIdentifier);
  }
});

let $playButton = d3.select('#play-button');
let $overlay = d3.select('#overlay');
let $playerName = d3.select('#player-name');
let $error = d3.select('#error');
let $gameOver = d3.select('#game-over-screen');
let $newPlayerForm = d3.select('#new-player-form');
let $playAgainButton = d3.select('#play-again-button');

function play() {
  let playerName = $playerName.property('value');

  if (playerName) {
    $svg.attr('opacity', 1);
    $overlay.classed('overlay-hidden', true);
    $error.classed('hidden', true);
    socket.emit('createPlayer', playerName);
  } else {
    $error.classed('hidden', false);
  }
}

$playButton.on('click', play);
$playAgainButton.on('click', play);

socket.on('updatePlayers', function (players) {
  if (bla) {
    bla = false;
  }
  render(players.map(function (player) {
    return {
      name: player.name,
      id: player.id,
      position: player.position,
      size: player.size,
      color: playerColors[player.type],
      type: player.type
    };
  }));
});

socket.on('playerCreated', function (id) {
  playerId = id;
});

function gameOver() {
  $svg.attr('opacity', 0.8);
  $newPlayerForm.classed('hidden', true);
  $gameOver.classed('hidden', false);
  $overlay.classed('overlay-hidden', false);
  zoom.scale(1);
  zoom.translate([0, 0]);
}

socket.on('gameOver', gameOver);

//setInterval(tick, 150);
//setTimeout(tick, tickInterval);
