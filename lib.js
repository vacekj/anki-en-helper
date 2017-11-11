const request = require('request-promise');
const jsonfile = require('jsonfile');
const cheerio = require('cheerio');
const fs = require('fs');
const fse = require('fs-extra');
const translate = require('google-translate-api');
const streamToPromise = require('stream-to-promise');
const pMap = require('p-map');
const chalk = require('chalk');

// Config file
const config = require('./config/config.js');

async function main() {
	await setupDirStructure();
	let inputCollection = jsonfile.readFileSync(config.input);
	let cleanedInput = cleanInput(inputCollection);
	let output = await processInput(cleanedInput);
	await writeOutput(output);
}

async function setupDirStructure() {
	await fse.emptyDir(config.outputDir);
	await fse.ensureDir(config.mediaDir);
}

function cleanInput(input) {
	let deUndefinedArray = input.filter((card) => {
		return card.Word != undefined;
	});
	let deDupedArray = removeDuplicates(deUndefinedArray, config.fields.word);
	return deDupedArray;
}

async function processInput(input) {
	const mapper = async (card) => {
		let data = await getData(card);
		let modifiedCard = card;
		Object.assign(modifiedCard, data);
		console.log(`Card processed: ${chalk.blue(card[config.fields.word])}`);
		return modifiedCard;
	};

	let result = await pMap(input, mapper, { concurrency: config.concurrency });
	return result;
}

async function getData(card) {
	let word = card[config.fields.word];
	let page = await request('https://www.vocabulary.com/dictionary/' + word);
	let $ = cheerio.load(page);

	// TODO: detect network error, then retry

	// definition
	const definitionSelector = 'h3.definition';
	let definition = $(definitionSelector).first().contents()[2].data.trim();

	// translation
	let translated = await translate(word, { from: 'en', to: 'cs' });
	let translation = translated.text;

	// get example
	const exampleSelector = 'p.short';
	let example = $(exampleSelector).first().text();

	// generate example___
	let example___ = example.replaceAll(word, '___');

	// audio
	let audioFileName = word + '.mp3';
	const data_audio = $('a.audio').attr('data-audio');
	let audioURL = 'https://audio.vocab.com/1.0/us/' + data_audio + '.mp3';
	let writeStream = fs.createWriteStream(`${config.mediaDir}/${audioFileName}`);
	request.get(audioURL).pipe(writeStream);
	await streamToPromise(writeStream);
	writeStream.end();
	let audio = `[sound:${audioFileName}]`;

	return {
		Definition: definition,
		Audio: audio,
		Translation: translation,
		Example: example,
		Example___: example___
	};
}

function writeOutput(output) {
	return new Promise((resolve, reject) => {
		let stream = fs.createWriteStream(config.outputFile);
		for (var index = 0; index < output.length; index++) {
			var card = output[index];
			let line = tabSeparatedLine(card.Word, card.Definition, card.Translation, card.Example, card.Example___, card.Audio)
			stream.write(line);
		}
		stream.end(null, resolve);
	});
}

function tabSeparatedLine(args) {
	return [...arguments].reduce((line, elem) => {
		return line += elem.concat('\t');
	}, '').concat('\n');
}

String.prototype.replaceAll = function (target, replacement) {
	return this.split(target).join(replacement);
};

function removeDuplicates(myArr, prop) {
	return myArr.filter((obj, pos, arr) => {
		return arr.map(mapObj => mapObj[prop]).indexOf(obj[prop]) === pos;
	});
}

module.exports = main;