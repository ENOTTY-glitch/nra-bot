/* Setting things up. */
var fs = require('fs'),
    path = require('path'),
    express = require('express'),
    app = express(),   
    Twit = require('twit'),
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

var bot_responses = [
  "I am awake!",
  "I'm awake!",
  "I dozed off.",
  "I dozed off, but I am awake now!",
  "I dozed off, but I'm awake now!"
];

var data = [
  //[Name, Contribution, Twitter handle, political opponent, opponent handle]
  //From https://www.nytimes.com/interactive/2017/10/04/opinion/thoughts-prayers-nra-funding-senators.html
  //Sens
  ["John McCain", "$7,740,520", ''],
  ["Richard Burr", "$6,986,620", ''],
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

// Returns an index into the politician table
function parse_for_politician(text) {
  return 0;
}

function get_response(event){
  console.log(event.text);
  
  var poli = parse_for_politician(event.text);
  var res = 'The NRA contributed ' + data[poli][1] + ' to ' + data[poli][0] + ' ' + data[poli][2] + ' (according to opensecrets.org).';
  
  return res; 
}

app.use(express.static('public'));

/* You can use uptimerobot.com or a similar site to hit your /tweet endpoint to wake up your app and make your Twitter bot tweet. */

app.all("/tweet", function (request, response) {
  /* Respond to @ mentions */
  fs.readFile(__dirname + '/last_mention_id.txt', 'utf8', function (err, last_mention_id) {
    /* First, let's load the ID of the last tweet we responded to. */
    console.log('last_mention_id:', last_mention_id);

    T.get('search/tweets', { q: 'to:' + process.env.TWITTER_HANDLE + ' -from:' + process.env.TWITTER_HANDLE, since_id: last_mention_id }, function(err, data, response) {
      /* Next, let's search for Tweets that mention our bot, starting after the last mention we responded to. */
      if (data.statuses.length){
        // console.log(data.statuses);
        data.statuses.forEach(function(status) {
          console.log(status.id_str);
          console.log(status.text);
          console.log(status.user.screen_name);
          
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
