const path = require('path');

const LIMIT = 2; //Limit for how many requests threads can be run targeting one server simultaneously.
const TIMEOUT = 10; //Timeout for network requests. (10 seconds)
const RETRIES = 3;
const SEP = "\u241E"; //Invisible

const temp = path.join(__dirname, "..");
const DESTFOLDER = path.join(temp, "downloads");
const DOWNLOADLISTFILEPATH = path.join(DESTFOLDER, "download-list");
const DOWNLOADEDLISTFILEPATH = path.join(DESTFOLDER, "downloaded-list");

var LISTHANDLER, ACCESSOR, RUNNING, PORT, REDOWNLOAD, LOG;

const wait = function (time) {
	return new Promise((resolve, reject) => {
		setTimeout(() => {
			resolve(true);
		}, time * 1000);
	});
}

module.exports = {LISTHANDLER, LIMIT, TIMEOUT, RETRIES, SEP, DESTFOLDER, DOWNLOADEDLISTFILEPATH, DOWNLOADLISTFILEPATH, ACCESSOR, RUNNING, wait};
