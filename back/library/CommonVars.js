module.exports = 
{
	mTypes:
	{
		request_add: 			'addReq',
		request_remove: 		'remReq',
		shutdown: 				'shtReq',

	},

	task:
	{
		tNumKey: 				'tNumKey',
		tResKey: 				'tResKey',
		tWorkerKey: 			'tWorkerKey',
		maxKey: 				'maxNOTasks',
		curKey: 				'curNOTask'
	},

	codes:
	{
		SUCCESS: 				200,
		BAD_REQUEST: 			400,
		INTERNAL_SERVER_ERROR: 	500,
		MAX_NO_PROCESS: 		800,
		NO_PROCESS_STARTED: 	801,
		MAX_NO_TASKS: 			802 
	}
}