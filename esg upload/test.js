const query_support = require("./query_support.js");
const MongoClient = require('mongodb').MongoClient;

var files = ["Company-Master-List.txt", "Corporate-Knight-Clean.txt", "Newsweek-500-Clean.txt", "Newsweek-500-2-Clean.txt", "Yearbook-Robecosam-Clean.txt"];
var alias_url = "https://wikirate.org/"
var greenscore_url = "https://wikirate.org/Newsweek+Newsweek_Green_Score+"

var companies = []
var promises = []

var i;

for(i = 0; i < files.length; i++){    //Make file reading promises
  promises.push(query_support.get_file_data(files[i]));
}

Promise.all(promises).then(function(values){  //Read files, make company objects from them
  console.log("Reading Files")
  for(i = 0; i < values.length; i++){
    console.log("Reading File: " + i)
    var ls = values[i]
    var j;
    for(j = 0; j < ls.length; j++){
      var name = ls[j];
      switch(i){
        case 2:
        case 3:
          name = ls[j+1];
          break;
        default:
          break;
      }
      if(name == '' || name == undefined){
        continue;
      }
      switch(i){
        case 0:
          var next = {company: name,
                    alias: [name],
                    category: [],
                    greenscore: "?",
                    dow: "?",
                    sustainable: "?"};
          companies[name] = next;
          break;
        case 1:
          companies[name].category.push(ls[j+2]);
          companies[name].sustainable = ls[j+3];
          j += 3;
          break;
        case 2:
          companies[name].category.push(ls[j+2]);
          j += 3;
          break;
        case 3:
          name = ls[j+1]
          companies[name].category.push(ls[j+2]);
          j += 3;
          break;
        case 4:
          companies[name].category.push(ls[j+1]);
          companies[name].dow = ls[j+3]
          j += 3;
          break;
      }
    }
  }
  promises = []
  console.log("Generating Promises: Alias URL")
  for(i = 0; i < Object.keys(companies).length; i++){      //Make alias promises
    promises.push(query_support.get_url_json(alias_url, Object.keys(companies)[i]));
  }

  Promise.all(promises).then(function(values){  //Query wikirates for company aliases
    console.log("Processing Results of Promises: Alias URL")
    for(i = 0; i < values.length; i++){
      if(values[i] != null){
        try{
          if(values[i].body.hasOwnProperty("aliases")){
            if(values[i].body.aliases.hasOwnProperty("content")){
              companies[values[i].company].alias.push(values[i].body.aliases.content);
            }
          }
        }
        catch(err){
          console.log(err);
        }
      }
    }
    promises = []
    console.log("Generating Promises: Greenscore URL")
    for(i = 0; i < Object.keys(companies).length; i++){    //Make greenscore promises
      promises.push(query_support.get_url_json(greenscore_url, Object.keys(companies)[i]));
    }

    Promise.all(promises).then(function(values){    //Query wikirates for company greenscores
      console.log("Processing Results of Promises: Greenscore URL")
      for(i = 0; i < values.length; i++){
        if(values[i] != null){
          try{
            if(values[i].hasOwnProperty("items")){
              companies[values[i].company].greenscore = values[i].items[0].value;
            }
          }
          catch(err){
            console.log(err);
          }
        }
      }

      const username = "patsy";
      const password = "patsy";
      const context = "greenmap";
      const dbName = "sample_test";
      const url = "mongodb+srv://" + username + ":" + password + "@" + context + "-crohe.gcp.mongodb.net/test?retryWrites=true"
      const collectionName = 'esg';

      MongoClient.connect(url, {useNewUrlParser: true}, function(err, client){    //Establish connection to the database
        console.log("MongoDB Client Open")
        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        promises = []
        console.log("Generating Promises: MongoDB Insert")
        for(i = 0; i < Object.keys(companies).length; i++){
          promises.push(query_support.mongo_collection_insert(collection, companies[Object.keys(companies)[i]], false));
        }

        Promise.all(promises).then(function(values){
          console.log("Processing Results of Promises: MongoDB Insert")
          client.close();
          console.log("MongoDB Client Closed")
        });
      });
    });
  });
});