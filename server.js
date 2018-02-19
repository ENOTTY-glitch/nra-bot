/* Setting things up. */
var fs = require('fs'),
    path = require('path'),
    express = require('express'),
    app = express(),   
    Twit = require('twit'),
    Fuse = require('fuse.js'),
    HashMap = require('hashmap'),
    config = {
    /* Be sure to update the .env file with your API keys. See how to get them: https://botwiki.org/tutorials/make-an-image-posting-twitter-bot/#creating-a-twitter-app*/      
      twitter: {
        consumer_key: process.env.CONSUMER_KEY,
        consumer_secret: process.env.CONSUMER_SECRET,
        access_token: process.env.ACCESS_TOKEN,
        access_token_secret: process.env.ACCESS_TOKEN_SECRET
      }
    },
    T = new Twit(config.twitter),
    stream = T.stream('statuses/sample');

var data = [
  //[Name, Contribution, Twitter handle, political opponent, opponent handle]
  //From https://www.nytimes.com/interactive/2017/10/04/opinion/thoughts-prayers-nra-funding-senators.html
  //Sens
  ["John McCain", "7,740,520", ''],
  ["Richard Burr", "6,986,620", ''],
  ['Roy Blunt', '4,551,146', ''],
  ['Thom Tillis', '4,418,012', ''],
  ['Cory Gardner', '3,879,064', ''],
  ['Marco Rubio', '3,303,355', ''],
  ['Joni Ernst', '3,124,273', ''],
  ['Rob Portman', '3,061,941', ''],
  ['Todd Young', '2,896,732', ''],
  ['Bill Cassidy', '2,861,047', ''],
  //Reps
  ['French Hill', '1,089,477', ''],
  ['Ken Buck', '800,544', ''],
  ['David Young', '707,662', ''],
  ['Mike Simpson', '385,731', ''],
  ['Greg Gianforte', '344,630', ''],
  ['Don Young', '245,720', ''],
  ['Lloyd Smucker', '221,736', ''],
  ['Bruce Poliquin', '201,398', ''],
  ['Pete Sessions', '158,111', ''],
  ['Barbara Comstock', '137,232', ''],
];

var data2 = [{'contribution': '7,740,520', 'name': 'John McCain'}, {'contribution': '6,986,620', 'name': 'Richard Burr'}, {'contribution': '4,551,146', 'name': 'Roy Blunt'}, {'contribution': '4,418,012', 'name': 'Thom Tillis'}, {'contribution': '3,879,064', 'name': 'Cory Gardner'}, {'contribution': '3,303,355', 'name': 'Marco Rubio'}, {'contribution': '3,124,273', 'name': 'Joni Ernst'}, {'contribution': '3,061,941', 'name': 'Rob Portman'}, {'contribution': '2,896,732', 'name': 'Todd Young'}, {'contribution': '2,861,047', 'name': 'Bill Cassidy'}, {'contribution': '1,089,477', 'name': 'French Hill'}, {'contribution': '800,544', 'name': 'Ken Buck'}, {'contribution': '707,662', 'name': 'David Young'}, {'contribution': '385,731', 'name': 'Mike Simpson'}, {'contribution': '344,630', 'name': 'Greg Gianforte'}, {'contribution': '245,720', 'name': 'Don Young'}, {'contribution': '221,736', 'name': 'Lloyd Smucker'}, {'contribution': '201,398', 'name': 'Bruce Poliquin'}, {'contribution': '158,111', 'name': 'Pete Sessions'}, {'contribution': '137,232', 'name': 'Barbara Comstock'}];
var options = {
  shouldSort: true,
  findAllMatches: true,
  includeScore: true,
  includeMatches: true,
  threshold: 0.3,
  location: 0,
  distance: 100,
  maxPatternLength: 32,
  minMatchCharLength: 3,
  keys: [
    "name"
  ]
};
var fuse = new Fuse(data2, options);

//i think id tokenize and search each token of the string, threshold it, assemble a vote, take the vote winner
function find_poli(toks) {
  var voteMap = new HashMap();
  var poliMap = new HashMap();
  
  for (var i = 0; i < toks.length; i++) {
    var t = toks[i];
    var results = fuse.search(t);
    for (var j = 0; j < results.length; j++) {
      var res = results[j];
      if (res['score'] > 0.3 || res['matches'].length == 0) //Since list is sorted, scores only get worse
        break;
      //console.log(res);
      var poli = res['item'];
      if (voteMap.has(poli['name'])) {
        voteMap.set(poli['name'], voteMap.get(poli['name'])+1);
      } else {
        voteMap.set(poli['name'], 1);
        poliMap.set(poli['name'], poli);
      }
    }
  }
  
  var votes = voteMap.entries();
  votes.sort(function(a, b) { return b[1] - a[1]; });
  console.log(votes);
  
  if (votes.length === 0)
    return null;
  if (votes.length > 1) {
    if (votes[0][1] === votes[1][1])
      return null;
  }
  var poli = poliMap.get(votes[0][0]);
  return poli;
}

function tokenize_and_normalize(msg) {
  var arr = [];
  var toks = msg.split(' ');
  for (var i = 0; i < toks.length; i++) {
    var t = toks[i];
    if (t.indexOf(process.env.TWITTER_HANDLE) !== -1)
      continue;
    t = t.replace(/[^\w\s]|_/g, "");
    arr.push(t);
  }
  return arr;
}

function get_response(event){
  console.log(event.text);
  
  var toks = tokenize_and_normalize(event.text);
  console.log(toks);
  
  var poli = find_poli(toks);
  console.log(poli);
  
  if (poli !== null) {
    var res = 'The NRA contributed $' + poli['contribution'] + ' to ' + poli['name'] + ' ' + '' + ' (according to https://www.opensecrets.org/orgs/summary.php?id=d000000082).';
  } else {
    var res = "I don't know who you're asking about. I might not have that person in my database. Or you can try giving me the politician's full name.";
  }

  return res; 
}

app.use(express.static('public'));

/* You can use uptimerobot.com or a similar site to hit your /tweet endpoint to wake up your app and make your Twitter bot tweet. */

app.all("/tweet", function (request, response) {
  /* Respond to @ mentions */
  fs.readFile(__dirname + '/last_mention_id.txt', 'utf8', function (err, last_mention_id) {
    /* First, let's load the ID of the last tweet we responded to. */
    console.log('last_mention_id:', last_mention_id);

    T.get('search/tweets', { q: '%40' + process.env.TWITTER_HANDLE + ' -from:' + process.env.TWITTER_HANDLE, since_id: last_mention_id }, function(err, data, response) {
    //T.get('search/tweets', { q: 'to:' + process.env.TWITTER_HANDLE + ' -from:' + process.env.TWITTER_HANDLE, since_id: last_mention_id }, function(err, data, response) {
      /* Next, let's search for Tweets that mention our bot, starting after the last mention we responded to. */
      if (data.statuses.length){
        // console.log(data.statuses);
        data.statuses.forEach(function(status) {
          console.log(status.id_str);
          console.log(status.text);
          console.log(status.user.screen_name);
          
          if (status.user.screen_name === 'iamawakebot')
            return;
          
          var text = get_response(status);

          /* Now we can respond to each tweet. */
          T.post('statuses/update', {
            status: '@' + status.user.screen_name + ' ' + text,
            in_reply_to_status_id: status.id_str
          }, function(err, data, response) {
            if (err){
                /* TODO: Proper error handling? */
              console.log('Error!');
              console.log(err);
            }
            else{
              fs.writeFile(__dirname + '/last_mention_id.txt', status.id_str, function (err) {
                /* TODO: Error handling? */
              });
            }
          });
        });
      } else {
        /* No new mentions since the last time we checked. */
        console.log('No new mentions...');      
      }
    });    
  });

  /* Respond to DMs */

  fs.readFile(__dirname + '/last_dm_id.txt', 'utf8', function (err, last_dm_id) {
    /* Load the ID of the last DM we responded to. */
    console.log('last_dm_id:', last_dm_id);

    T.get('direct_messages', { since_id: last_dm_id, count: 200 }, function(err, dms, response) {
      /* Next, let's search for Tweets that mention our bot, starting after the last mention we responded to. */
      if (dms.length){
        dms.forEach(function(dm) {
          console.log(dm.sender_id);
          console.log(dm.id_str);
          console.log(dm.text);
          
          response = get_response(dm);

          /* Now we can respond to each tweet. */
          T.post('direct_messages/new', {
            user_id: dm.sender_id,
            text: response
          }, function(err, data, response) {
            if (err){
              /* TODO: Proper error handling? */
              console.log('Error!');
              console.log(err);
            }
            else{
              fs.writeFile(__dirname + '/last_dm_id.txt', dm.id_str, function (err) {
                /* TODO: Error handling? */
              });
            }
          });
        });
      } else {
        /* No new DMs since the last time we checked. */
        console.log('No new DMs...');      
      }
    });    
  });  
  
  /* TODO: Handle proper responses based on whether the tweets succeed, using Promises. For now, let's just return a success message no matter what. */
  response.sendStatus(200);
});

var listener = app.listen(process.env.PORT, function () {
  console.log('Your bot is running on port ' + listener.address().port);
});
