const { Readable } = require('stream');
const mimeTypes = require("mime-types");
const fs = require("fs");
const path = require('path');

const { custom_logger } = require("../utils/logger");
const constants = require("../utils/constants");
const list_manager = require("../utils/list_manager");
const upload = require("./upload");

function trackPromise(promise) {
	const tracked = {
		status: "pending",
		promise: promise.then((value) => {
			tracked.status = "fulfilled";
			tracked.value = value;
			return value;
		}).catch((error) => {
			tracked.status = "rejected";
			tracked.reason = error;
		})
	}
	return tracked;
}

const download = async function () {
	if (constants.RUNNING == true) return;
	constants.RUNNING = true;
	var streams = [];

	var data = (await constants.ACCESSOR.read(constants.DOWNLOADLISTFILEPATH));
	data = data.trim();
	if (data.length == 0) {
		data = {};
	} else {
		data = JSON.parse(data);
	}
	// data = {"link": {title, folder, log}}
	const links = Object.keys(data);
	if (links.length > 0) {
		custom_logger(1, "LOG", "\x1b[31mRunning.\x1b[0m");
	}

	for (const link of links) {
		const folder = data[link]["folder"];
		const title = data[link]["title"];
		const log = data[link]["log"];

		const dest = upload.upload_folder_preparation(link, folder);
		if (dest == null) {
			return;
		}
		custom_logger(log, "LOG", `\x1b[32mDownloading "${title}": "${link}"\x1b[0m`);
		var request, readable;
		// default: 64 * 1024 == 2 ** 6 * 1024
		const highWaterMark = (2 ** 12) * 1024;
		try {
			request = await fetch(link);
			readable = Readable.fromWeb(request.body, {highWaterMark}); // Converts Web Streams API `ReadableStream` to a node.js `stream.Readable`.
		} catch (err) {
			custom_logger(log, "ERROR", "Server had an error. [" + err.message + "]");
			continue;
		}
		if (request.status != 200) {
			custom_logger(log, "ERROR", "The server which you are requesting from returned a response with the status code " + request.status + ". [" + err.message + "]");
			continue;
		}

		const ext = mimeTypes.extension(request.headers.get("content-type"));
		const fileTemp = path.join(dest, `${title}.${ext}.part`);
		const file = path.join(dest, `${title}.${ext}`);

		if (fs.existsSync(file) && !constants.REDOWNLOAD) {
			list_manager.logDownload(link);
			custom_logger(log, "LOG", `\x1b[32mStream already saved to "${file}"\x1b[0m`);
			await constants.wait(2);
			continue;
		}

		custom_logger(log, "LOG", `\x1b[96m\t-Writing stream to "${file}"\x1b[0m`);
		const fileStream = fs.createWriteStream(fileTemp, {highWaterMark});

		var promise = new Promise((resolve, reject) => {
			readable.pipe(fileStream);
			readable.on("end", async () => {
				fileStream.close();
				try {
					fs.renameSync(fileTemp, file);
					list_manager.logDownload(link);
					custom_logger(log, "LOG", `\x1b[32m✅ Stream saved to "${file}"\x1b[0m`);
				} catch (e) {
					custom_logger(log, "ERROR", `\x1b[32mError renaming file\x1b[0m:`, e);
				}
				await constants.wait(2);
				resolve();
			});
			readable.on("error", async (error) => {
				custom_logger(log, "ERROR", `\x1b[31mFailed to write stream to "${file}"\x1b[0m`);
				fileStream.close();
				await constants.wait(2);
				resolve();
			});
		});
		streams.push(trackPromise(promise));
		if (streams.length >= 2) await Promise.race(streams.map((e) => { return e.promise; }));
		// Remove settled promises.
		for (let i = 0; i < streams.length; i++) {
			if (streams[i].status !== "pending") {
				streams.splice(i, 1);
			}
		}
	}
	await Promise.all(streams.map((e) => { return e.promise; }));
	constants.RUNNING = false;
}

const add_download_queue = function (log, response, link, folder, title) {
	constants.ACCESSOR.queue = constants.ACCESSOR.queue.then(async () => {
		var data = (await constants.ACCESSOR.readWithoutQueue(constants.DOWNLOADLISTFILEPATH));
		data = data.trim();
		if (data.length == 0) {
			data = {};
		} else {
			data = JSON.parse(data);
		}
		// data = {"link": {title, folder, log}}

		if (!Object.hasOwn(data, link)) {
			data[link] = {
				folder,
				title,
				log
			};
			data = JSON.stringify(data);
			constants.ACCESSOR.writeWithoutQueue(constants.DOWNLOADLISTFILEPATH, data);
			custom_logger(log, "LOG", `\x1b[96m"${title}" added to queue.\x1b[0m`);
		} else {
			custom_logger(log, "LOG", `\x1b[35m"${title}" already in queue.\x1b[0m`);
		}
	});
	response.statusCode = 200;
	response.end();
}

module.exports = {download, add_download_queue}
