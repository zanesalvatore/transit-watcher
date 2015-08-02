/*
A Pebble app to display Trimet arrival times for regular riders.

The user can provide their own stops and routes. A card is produced for each stop, with route information for each.
*/

/* ===== IMPORTS ===== */
var UI = require('ui');
var ajax = require('ajax');

/* ===== CONSTANTS ===== */
// TriMet constants
var MY_APPID = "";  // TODO: enter valid app API key

// customization constants
var MY_STOPS = [159, 7616];
var MY_ROUTES = [12];  // set to null to include all stops

/*
===== HELPER FUNCTIONS =====
Functions to provide better customization and modularity.
*/

// Generates the body text for a given stop's card. Input should be the object containing data for the stop.
// arrivals = {stop: STOP_NUMBER, times: [{route: route number, time: time until arrival, minutes: minutes until due}, ...]}.times
function generateCardBodyText(arrivals) {
  var result = "";

  for (var j = 0; j < arrivals.length; j++) {
      var route = arrivals[j].route;
      var time = fullTimeToShort(arrivals[j].time);
      var minutes = arrivals[j].minutes;

      result += route + " " + time + " (" + minutes + "mins)\n";
  }

  return result;
}

// compute the number of minutes between two Date objects
function minutesDifference(a, b) {
  // JS Date objects are cast into milisecond-precision values for subtraction, I guess? ¯\_(ツ)_/¯
  return Math.round((((a - b) % 86400000) % 3600000) / 60000);
}

function fullTimeToShort(time) {
  return time.slice(0, time.lastIndexOf(":"));
}

// TriMet API functions
// generates the URL to request arrival times from TriMet's APIs for a given stop or stops
function getArrivalsURL(stopIDs) {
  return "https://developer.trimet.org/ws/V1/arrivals?json=true&locIDs=" + stopIDs + "&appID=" + MY_APPID;
}

// takes the JSON returned by the TriMet arrivals API endpoint and returns a simplified version
// arrivalData must be the result of a call to the TriMet Arrivals Web Service V1
function parseArrivalTimes(arrivalData, routes, stops) {
  // we want each entry of this array to resemble {stop: STOPNUM, times: [{route: route, time: TIME, minutes: minutes until arrival}, ...]}
  var resultMap = {};  // a map to handle processing the results
  var stopNums;
  if (stops === undefined) {
    stopNums = [];  // the numbers of the bus stops
  } else {
    stopNums = stops;
  }

  // inner function to check if we should include a route
  var includeRoute = function (routeNum) {
    return (routes === undefined) ||           // yes if the routes variable wasn't provided
           (routes.indexOf(routeNum) !== -1);  // yes if the given routeNum is in the array of routes provided
  };

  // get the current time so we can calculate the delay
  var now = new Date();

  // first we parse out the stop numbers and arrival times
  var arrivals = arrivalData.resultSet.arrival;
  for (var i = 0; i < arrivals.length; i++) {
    var arrival = arrivals[i];

    // exclude routes we don't care about
    if (!includeRoute(arrival.route)) { continue; }

    // extract the important information from the API results up front
    var stop = arrival.locid;
    var scheduledTime = new Date(arrival.scheduled);
    var estimatedTime = new Date(arrival.estimated);
    var route = arrival.route;

    // add the stop number to our array if we don't have it already
    if (stops === undefined && stopNums.indexOf(stop) === -1) {
      stopNums.push(stop);
    }

    if (resultMap[stop] === undefined) {
      resultMap[stop] = [];
    }

    resultMap[stop].push({
      route: route,
      time: scheduledTime.toLocaleTimeString(),
      minutes: minutesDifference(estimatedTime, now)
    });
  }

//   // then we assemble the data into its ALL-POWERFUL FINAL FORM for easier handling later
//   var result = [];
//   for (i = 0; i < stopNums.length; i++) {
//     result.push({
//       stop: stopNums[i],
//       times: resultMap[stopNums[i]],
//     });
//   }

//   return result;

  return resultMap;
}


/* ===== INITIALIZATION ===== */
var cards = [];
var activeCard = 0;

function goUpCard() {
  if (activeCard > 0) {
    cards[--activeCard].show();
  }
}

function goDownCard() {
  if (activeCard < cards.length - 1) {
    cards[++activeCard].show();
  }
}

for (var i = 0; i < MY_STOPS.length; i++) {
  console.log('creating card for stop ' + MY_STOPS[i]);
  cards[i] = new UI.Card({
    title: "Stop " + MY_STOPS[i],
    subtitle: "Tracking Data",
    body: "Fetching...",
  });

  if (i > 0) {
    cards[i].on('click', 'up', goUpCard);
  }

  if (i < MY_STOPS.length - 1) {
    cards[i].on('click', 'down', goDownCard);
  }

  cards[i].on('click', 'select', loadData);
}


cards[0].show();


/* ===== BUSINESS ===== */
function loadData() {
  ajax(
    {url: getArrivalsURL(MY_STOPS), type: 'json'},
    function (data) {
      console.log('data retrieved successfully');
      var arrivals = parseArrivalTimes(data, MY_ROUTES, MY_STOPS);

      console.log("arrivals: " + JSON.stringify(arrivals));

      for (var i = 0; i < MY_STOPS.length; i++) {
        cards[i].body(generateCardBodyText(arrivals[MY_STOPS[i]]));
      }
    },
    function (error) {
      console.error('Error loading data: ' + error);
      for (var card in cards) {
        card.body('Ugh. There was an error.');
      }
    }
  );
}

loadData();
