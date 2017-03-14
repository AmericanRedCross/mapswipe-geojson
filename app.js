var fs = require('fs');
var path = require('path');
var flow = require('flow');
var request = require('request');
var tilebelt = require('tilebelt');
var turf = require('turf');
var moment = require("moment");
var d3 = require("d3-queue");

var timestamp = moment().format('YYYYMMDD-HHmmss');

// array of project number(s) to combine and convert to GeoJSON
var targetPrjs = [124, 303, 407, 1034, 1166, 1333, 1440, 2158, 3310, 3610, 4103];


function getResults(prj, cb){
  var apiPath = "http://api.mapswipe.org/projects/" + prj + ".json";
  console.log(apiPath)
  request({ url: apiPath, json: true }, function (error, response, body) {
      if(error) throw error;
      if (!error && response.statusCode === 200) {
        cb(null, body);
      }
  })
}

function makeGeo(results, cb){

  for(var i=0; i<results.length; i++){
    // key should be something like "18-151822-132938"
    var location = results[i].id.split('-');
    // reorder because tilebelt expects [x,y,z]
    var geometry = tilebelt.tileToGeoJSON([parseFloat(location[1]), parseFloat(location[2]), parseFloat(location[0])]);
    // which result has the highest count?
    // sorta.. if things equal this doesn't necessarily handle it well
    var count = 0;
    var cat = "error";
    if (results[i].yes_count > count) {
      count = results[i].yes_count;
      cat = "yes";
    }
    if (results[i].bad_imagery_count > count) {
      count = results[i].bad_imagery_count;
      cat = "bad";
    }
    if (results[i].maybe_count > count) {
      count = results[i].maybe_count;
      cat = "maybe";
    }
    // format as GeoJSON feature
    var feature = turf.feature(geometry, {
      "prj": results[i].project,
      "cat": cat,
      "1": results[i].yes_count,
      "2": results[i].maybe_count,
      "3": results[i].bad_imagery_count
    });
    // replace the data object with the GeoJSON feature
    results[i] = feature;
  }
  cb(results);

}

flow.exec(
  function(){

    var q = d3.queue();
    for (var i = 0; i < targetPrjs.length; i++) {
      q.defer(getResults, targetPrjs[i]);
    }
    q.awaitAll(this);

  }
  ,function(error, data){

    if(error) throw error;

    for(var i=1; i<data.length; ++i){
      data[0] = data[0].concat(data[i])
    }
    makeGeo(data[0], this);

  }
  ,function(geoResults){

    var fc = turf.featureCollection(geoResults);
    var filename = "projects-" + targetPrjs.join("_") + "-" + timestamp + ".geojson";
    var output = path.join(__dirname,'output',filename)
    fs.writeFile(output, JSON.stringify(fc), function(){
      console.log("done!")
    });

  }
)
