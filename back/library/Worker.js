var AudioConverter = require('./AudioConverter.js');
var VideoConverter = require('./VideoConverter.js');
var express = require('express');
var crypto = require('crypto');
var common = require('./CommonVars.js');
var config = require('./Config.js');


var redisM = require('redis');
var redis = redisM.createClient();
redis.on('error', function(err)
{
    console.log('[Worker] [' + process.pid + '] Redis error in worker: ' + err);
});

var app = express();
app.listen(config.restapi.workerPort);

app.all('*', function(req, res, next) {
    res.set('Access-Control-Allow-Origin', '*');
    next();
});

//Define routs
app.post('/upload', upload);

// Storage for tasks
var tasks = [];
// Store pulling statistic intervals and task timeout
var intervals = [];
var timeouts = [];

// Define listeners
process.on('message', function(msg){
    //Stop all the tasks and clear timeouts
    if (msg === common.mTypes.shutdown)
    {
        console.log('[Worker] [' + process.pid + '] Number of tasks before shutdown - ' + Object.keys(tasks).length);
        for (var key in tasks)
        {
            tasks[key].abortTask();
            deleteTaskWithId(key);
            console.log('[Worker] [' + process.pid + '] Task (' + key + ') removed');
        }
        redis.quit();
        process.exit(0);
    }
});


// Handle incoming 'upload' request
function upload(req, res) {
    var task;
    var uploadType;
    var id;
    var max
    var cur;
    // Check the number of ongoing tasks
    redis.hmget(common.task.tNumKey, common.task.maxKey, common.task.curKey, function(err, result) {
        if (err)
        {
            res.status(common.codes.INTERNAL_SERVER_ERROR);
            res.send(err);
            return;
        }

        max = parseInt(result[0]);
        cur = parseInt(result[1]);

        if (cur >= max)
        {
            res.status(common.codes.MAX_NO_TASKS);
            res.send('Maximum number of tasks reached. Repeat request later');
            return;
        }

        uploadType = req.query.type;
        if (!uploadType && uploadType !== 'video' && uploadType !== 'audio' && uploadType === '')
        {
            res.status(common.codes.BAD_REQUEST);
            res.send('Upload type is not valid');
            return;
        }

        // generate unique task id
        id = crypto.randomBytes(10).toString('hex');
        // create and store task
        if (uploadType === 'audio')
        {
            task = new AudioConverter();
        }
        else
        {
            task = new VideoConverter();
        }
        tasks[id] = task;
        //Notify master about new task
        process.send({type: common.mTypes.request_add});
        // start task
        startTask(id);
        
        cur = cur + 1;
        console.log('[Worker] [' + process.pid + '] Incoming request. Requests in serve (' + Object.keys(tasks).length + ') Total (' + cur + ')');

        res.status(200);
        res.send(JSON.stringify(
            {
                id: id,
                pid: process.pid
            }
        ));
    });    
}

// Function pulling task status and store it id DB
// Also restart task if it takes to mach time
function startPullStatus(id) {
    var timeout;
    // Start loop to check status of task and store it in DB
    var per = tasks[id].getStatus();
    var interval = setInterval(function(){
        var tmp_per = tasks[id].getStatus();
        // if previous status is equal to current => not update the DB
        if (tmp_per !== per)
        {
            redis.hset(common.task.tResKey, id, per);
            per = tmp_per;
        }
    }, 500);

    intervals[id] = interval;

    // Set task timeout. Restart task if timeout occured
    timeout = setTimeout(function(){
        console.log('[Worker] [' + process.pid + '] Task (' + id + ') failed due to timeout. Restarting...');
        clearInterval(intervals[id]);
        tasks[id].abortTask();
        startTask(id);
        console.log('[Worker] [' + process.pid + '] Task (' + id + ') restarted');
    }, config.timers.taskTimeout);

    timeouts[id] = timeout;
}

// Delete task from array and clear timeouts
function deleteTaskWithId(id)
{
    clearInterval(intervals[id]);
    clearTimeout(timeouts[id]);
    delete tasks[id];
    tasks.splice(id, 1);
    process.send({type: common.mTypes.request_remove});
}

// Start the task
function startTask(id)
{
    try
    {
        tasks[id].convert(function(){
            console.log('[Worker] [' + process.pid + '] Task (' + id + ') finished');
            redis.hset(common.task.tResKey, id, tasks[id].getStatus());
            deleteTaskWithId(id);
        });
    }
    catch (e)
    {
        console.log('[Worker] [' + process.pid + '] Task (' + id + ') Exception thrown during evaluation. Restarting the task...');
        console.log(e);
        clearInterval(intervals[id]);
        clearTimeout(timeouts[id]);
        startTask(id);
    }

    // pull the status and abort task after 30 seconds if not done yet
    startPullStatus(id);
}