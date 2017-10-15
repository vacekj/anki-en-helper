

let main = require('./lib');

main().then(() => {
	console.log('');
	process.exit(0);
}).catch((e) => {
	console.log('Error: ' + e.toString());
	process.exit(1);
});