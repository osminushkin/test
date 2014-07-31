var cluster = require('cluster');
var fs = require('fs');
var common = require('./CommonVars.js');
var config = require('./Config.js');
var redisM = require('redis');

module.exports = function Manager()
{
    var redis = redisM.createClient();
    redis.on('error', function(err)
    {
        console.log('Redis error in manager: ' + err);
    });

    // To store timeouts of soft shutdown of process
    var timeouts = [];

    // Lets define MAX number of processes as a number of CPUs
    var numWorkers = require('os').cpus().length;
    // Store the max allowed permanent task and curent number of executed
    var maxNumberOfTasks = 10;
    var currentNOTask = 0;

    //Create hashes in DB and set expiration time
    redis.hset(common.task.tNumKey, common.task.maxKey, maxNumberOfTasks);
    redis.hset(common.task.tNumKey, common.task.curKey, currentNOTask, function(){
        redis.expire(common.task.tNumKey, config.timers.expireDB);
    });
    redis.hset(common.task.tResKey, null, null, function(){
        redis.expire(common.task.tResKey, config.timers.expireDB);
    });
    redis.hset(common.task.tWorkerKey, null, null, function(){
        redis.expire(common.task.tWorkerKey, config.timers.expireDB);
    });


    // Setup template for workers
    cluster.setupMaster({
        exec: "Worker.js"
    });

    // All management logic will handle master process and only 'upload' will handled by workers
    // Moreover 'cluster' has own load balancer
    if (cluster.isMaster)
    {
        var express = require('express');
        var _app = express();
        _app.all('*', function(req, res, next) {
            res.set('Access-Control-Allow-Origin', '*');
            next();
        });
        _app.get('/status', status);
        _app.post('/addProc', addProc);
        _app.post('/removeProc', removeProc);
        _app.listen(config.restapi.masterPort);
        console.log('[Master] [    ] Start REST API on port: ' + config.restapi.masterPort);
    }

    // Function to add new process
    function addProc(req, res)
    {
        // Check the current number of workers is not greater than allowed
        if (Object.keys(cluster.workers).length < numWorkers)
        {
            var worker = cluster.fork();
            //Save the number of ongoing tasks handled by new worker
            redis.hset(common.task.tWorkerKey, worker.id, 0);
            //Define event listeners
            worker.on('message', function(data) {
                // Incoming request to start new task
                if (data.type && data.type === common.mTypes.request_add)
                {
                    currentNOTask = currentNOTask + 1;
                    redis.hset(common.task.tNumKey, common.task.curKey, currentNOTask);
                    redis.hincrby(common.task.tWorkerKey, worker.id, 1);
                    console.log('[Master] [addP] Current task number: ' + currentNOTask);
                }
                //task finished
                else if (data.type && data.type === common.mTypes.request_remove)
                {
                    currentNOTask = currentNOTask - 1;
                    redis.hset(common.task.tNumKey, common.task.curKey, currentNOTask);
                    redis.hincrby(common.task.tWorkerKey, worker.id, -1);
                    console.log('[Master] [remP] Current task number: ' + currentNOTask);
                }
            });
                
            worker.on('exit', function(code, signal) {
                console.log('[Master] [exit] Worker exit: ' + worker.process.pid + ' Code:' + code);
            });

            worker.on('error', function() {
                console.log('[Master] [errr] Worker died with error');
            });

            worker.on('disconnect', function() {
                // clear timeout. Stop the task to kill process. It is already done
                if (timeouts['_' + worker.id])
                {
                    console.log('[Master] [disc] Worker disconnected');
                    clearTimeout(timeouts['_' + worker.id]);
                    delete timeouts['_' + worker.id];
                    timeouts.splice('_' + worker.id, 1);
                }
            });

            console.log("[Master] [addP] New worker created: " + worker.process.pid);

            res.status(common.codes.SUCCESS);
            res.send(JSON.stringify({wId: worker.id, pid: worker.process.pid}));
        }
        else
        {
            console.log('The maximum number of processes reached: ' + Object.keys(cluster.workers).length);
            res.status(common.codes.MAX_NO_PROCESS);
            res.send('The maximum number of processes reached: ' + Object.keys(cluster.workers).length);
        }
    }

    //Function to handle request to remove process
    function removeProc(req, res)
    {
        var pid;
        var timeout;
        var wId;
        // Check if any process to be removed
        if (Object.keys(cluster.workers).length < 1)
        {
            res.status(common.codes.NO_PROCESS_STARTED);
            res.send('There are not started processes');
            return;
        }

        // Get worcker id and send 'shutdown' to worker
        wId = req.query.wId;
        if (wId === null && typeof wId === 'undefined' && wId === '')
        {
            res.status(common.codes.BAD_REQUEST);
            res.send('Bad request. Check passed process ID');
            return;
        }
        pid = cluster.workers[wId].process.pid;
        cluster.workers[wId].send(common.mTypes.shutdown);
        cluster.workers[wId].disconnect();
        timeout = setTimeout(function() {
            if(cluster.workers[wId])
            {
                cluster.workers[wId].kill();
            }
        }, 3000);
        timeouts['_' + wId] = timeout;

        res.status(common.codes.SUCCESS);
        res.send('Process deleted: ' + pid);
    }

    // Get status of task
    function status(req, res)
    {
        var tId = req.query.tId;
        if (tId === null && typeof tId === 'undefined')
        {
            res.status = common.codes.BAD_REQUEST;
            res.send('Bad request. Check passed task ID');
            return;
        }
        redis.hget(common.task.tResKey, tId, function(err, result)
        {
            if (err)
            {
                res.status(common.codes.INTERNAL_SERVER_ERROR);
                res.send(err);
                return;
            }

            res.status(common.codes.SUCCESS);
            res.send('' + result);
        });
    } 
};


