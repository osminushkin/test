exports.get = function()
{
	return {

		restapi:
		{
			masterPort: 8081,
			workerPort: 8082
		},

		timers:
		{
			taskTimeout: 10*1000,//milliseconds
			expireDB: 60*60 //seconds
		}

	};
};