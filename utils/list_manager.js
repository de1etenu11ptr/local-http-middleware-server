const fs = require("fs");

const { custom_logger } = require("./logger");
const constants = require("./constants");

class FileDownloadList {
	constructor() {
		this.handle = null;
		this.queue = Promise.resolve();
	}

	read(file) {
		this.queue = this.queue.then(() => {
			return fs.readFileSync(file, 'utf8');
		});
		return this.queue;
	}
	readWithoutQueue(file) {
		return fs.readFileSync(file, 'utf8');
	}

	write(file, text) {
		this.queue = this.queue.then(() => {
			fs.writeFileSync(file, text + "\n", 'utf8');
		});
	}
	writeWithoutQueue(file, text) {
		fs.writeFileSync(file, text + "\n", 'utf8');
	}

	replaceQueue(queue) {
		this.queue = queue;
	}

}

function ensureFileExists() {
	try {
		fs.access(constants.DESTFOLDER, fs.constants.F_OK);
	} catch {
		custom_logger("ERROR", `"${constants.DESTFOLDER}" not found. Creating it.`);
		fs.mkdirSync(constants.DESTFOLDER, {
			recursive: true
		});
	}
	try {
		fs.access(constants.DOWNLOADLISTFILEPATH, fs.constants.F_OK);
	} catch {
		custom_logger("ERROR", `"${constants.DOWNLOADLISTFILEPATH}" not found. Creating it.`);
		fs.writeFileSync(constants.DOWNLOADLISTFILEPATH, '');
	}
	try {
		fs.access(constants.DOWNLOADEDLISTFILEPATH, fs.constants.F_OK);
	} catch {
		custom_logger("ERROR", `"${constants.DOWNLOADEDLISTFILEPATH}" not found. Creating it.`);
		fs.writeFileSync(constants.DOWNLOADEDLISTFILEPATH, '');
	}
}

const logDownload = function (link) {
	constants.ACCESSOR.queue = constants.ACCESSOR.queue.then(async () => {
		// Adding it to the downloaded list.
		var data = (await constants.ACCESSOR.readWithoutQueue(constants.DOWNLOADEDLISTFILEPATH));
		var uniqueData = [...new Set(data.split("\n").filter((item) => {
			return item.trim() != "";
		}))];
		if (!uniqueData.includes(link)) {
			uniqueData.push(link)
			constants.ACCESSOR.writeWithoutQueue(constants.DOWNLOADEDLISTFILEPATH, uniqueData.join("\n"));
		}
		// Removing it from the download list
		data = (await constants.ACCESSOR.readWithoutQueue(constants.DOWNLOADLISTFILEPATH));
		data = data.trim();
		if (data.length == 0) {
			data = {};
		} else {
			data = JSON.parse(data);
		}
		// data = {"link": {title, folder, log}}

		if (Object.hasOwn(data, link)) {
			delete data[link]
			data = JSON.stringify(data);
			constants.ACCESSOR.writeWithoutQueue(constants.DOWNLOADLISTFILEPATH, data);
		}
	});
}

module.exports = {logDownload, ensureFileExists, FileDownloadList}
