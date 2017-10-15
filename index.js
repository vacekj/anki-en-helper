let main = require('./lib');

main().then(() => {
	console.log('Success!');
	process.exit(0);
}).catch((e) => {
	console.log('Error!');
	console.log(e);
	process.exit(1);
});