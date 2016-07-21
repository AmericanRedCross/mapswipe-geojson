var fs = require('fs');
var path = require('path');
var flow = require('flow');
var request = require('request');
var jsonfile = require('jsonfile');
var tilebelt = require('tilebelt');
var turf = require('turf');

// var moment = require("moment");
// var timestamp = moment().format('YYYYMMDD-HHmmss');

var errors = {}

// to fetch the latest results file after a first run, delete output/results.json
var output = path.join(__dirname,'output','results.json');

function checkForFile(cb){
  fs.access(output, fs.F_OK, function(err) {
      if (!err) {
          // file exists
          console.log('results.json exists')
          cb(null);
      } else {
          console.log('could not find results.json')
          // file isn't accessible
          cb(true);
      }
  });
}

function getResults(cb){

  var filePath = path.join(__dirname,'output','results.json')
  request
    .get('http://104.196.146.215/results.json')
    .on('error', function(err) {
      console.log(err)

    })
    .pipe(fs.createWriteStream(filePath))
    .on('finish', function(){
      console.log('done downloading results.json');
      cb();
    })
}

function countResults(obj, cb){

  var features = [];
  for(var key in obj){
    // key should be something like "18-151822-132938"
    var location = key.split('-');
    // reorder because tilebelt expects [x,y,z]
    var tile = [parseFloat(location[1]), parseFloat(location[2]), parseFloat(location[0])];
    var geometry = tilebelt.tileToGeoJSON(tile);
    var properties = { one: 0, two: 0, three: 0, total: 0, error: 0 };
    var feature = turf.feature(geometry, properties);
    for(var review in obj[key]){
      switch(obj[key][review]['data']['result']) {
        case 1:
          feature.properties.one++;
          feature.properties.total++;
          break;
        case 2:
          feature.properties.two++;
          feature.properties.total++;
          break;
        case 3:
          feature.properties.three++;
          feature.properties.total++;
          break;
        default:
          feature.properties.error++;
          errorCount ++;
          // console.log(" . . . ");
          // console.log(obj[key][review]['data']);
          var thisKey = key + "/" + review;
          errors[thisKey] = obj[key][review]['data'];
      }
    }
    // what has the highest count?
    var featureCat = '';
    var catCount = 0;
    var cats = ["one","two","three"];
    for(i = 0; i<3; i++){
      if(feature.properties[cats[i]] > catCount){
        featureCat = cats[i];
        catCount = feature.properties[cats[i]];
      }
    }
    feature.properties['category'] = featureCat

    features.push(feature);
  }
  var fc = turf.featureCollection(features);
  cb(fc);
}


function log(message, cb) {
  console.log(message);
  cb();
}


var justDoIt = flow.define(
  function(){
    // this first bit is a little hacky for now, it's just here because I
    // don't want to re-download the 261MB and growing results.json file
    // every time I test the code further down
    checkForFile(this);
  },
  function(err){
    if (err) {
      getResults(this);
    } else {
      log('using the existing results.json', this);
    }
  },
  function(){
    jsonfile.readFile(output, this);
  },
  function(err, obj){
    countResults(obj, this);
  },
  function(fc){
    fs.writeFile('./output/testing.geojson', JSON.stringify(fc));
    fs.writeFile('./output/errors.json', JSON.stringify(errors));
    console.log('done?')
  }
)

justDoIt();
