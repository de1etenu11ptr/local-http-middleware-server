const http = require('http');
const fs = require("fs");

const { custom_logger } = require("./utils/logger");
const list_manager = require("./utils/list_manager");
const constants = require("./utils/constants");
const upload = require("./routes/upload");
const exists = require("./routes/exists");
const download = require("./routes/download");
const proxy = require("./routes/proxy");


let stdin = fs.openSync("/dev/stdin", "rs");
const read = function (message) {
	fs.writeSync(process.stdout.fd, message + " ");
	let s = '';
	let buf = Buffer.alloc(1);
	fs.readSync(stdin, buf, 0, 1, null);
	while ((buf[0] != 10) && (buf[0] != 13)) {
		s += buf;
		fs.readSync(stdin, buf, 0, 1, null);
	}
	return s;
}

constants.PORT = read("Port number to use:");
constants.REDOWNLOAD = read(`Would you like to re-download files already downloaded in this session? (All other characters besides "y" mean no)`) == "y";

setInterval(() => {
	for (let i = 0; i < proxy.domainsResting.length; i++) {
		if (proxy.domainsResting[i].activeThreads == 0 && proxy.domainsResting[i].requests.every(r => r.length === 0)) {
			proxy.domainsResting.splice(i, 1); //Cleanup inactive domains
		}
	}
}, 300000);


list_manager.ensureFileExists()
constants.ACCESSOR = new list_manager.FileDownloadList();
setInterval(download.download, 5000);

const download_func = async function (log, request, response) {
	var link = request.headers["x-link-header"];
	var folder = request.headers["x-folder-header"];
	var title = request.headers["x-title-header"];
	if (!link || !title ||
		link == "" || title == "") {
		custom_logger(log, "ERROR", "Upload missing headers. *download_func");
		custom_logger(log, "ERROR", "Link Header: " + link + "\nTitle Header: " + title);
		response.statusCode = 401;
		response.end("Missing headers...");
		return;
	}
	if (!folder || folder == "") {
		folder = ".";
	}
	link = decodeURIComponent(link);
	folder = decodeURIComponent(folder);
	title = decodeURIComponent(title);

	const dest = exists.get_dir(link, folder);
	if (dest == null) {
		response.statusCode = 400;
		response.end("Malformed URL provided.");
		return;
	}
	if (!(await upload.upload_download_check(log, response, link))) {
		return;
	}
	const file = upload.upload_file_check(log, response, link, dest, title);
	if (file == null) {
		return;
	}

	download.add_download_queue(log,response, link, folder, title);
}

const upload_func = async function (log, request, response, list_log = true) {
	var link = request.headers["x-link-header"];
	var folder = request.headers["x-folder-header"];
	var title = request.headers["x-title-header"];
	if (!link|| !title ||
		link == "" || title == "") {
		custom_logger(log, "ERROR", "Upload missing headers. *upload_func");
		custom_logger(log, "ERROR", "Link Header: " + link + "\nTitle Header: " + title);
		response.statusCode = 401;
		response.end("Missing headers...");
		return;
	}
	if (!folder || folder == "") {
		folder = ".";
	}
	link = decodeURIComponent(link);
	folder = decodeURIComponent(folder);
	title = decodeURIComponent(title);

	const dest = exists.get_dir(link, folder);
	if (dest == null) {
		response.statusCode = 400;
		response.end("Malformed URL provided.");
		return;
	}
	if (!(await upload.upload_download_check(log, response, link))) {
		return;
	}
	const file = upload.upload_file_check(log, response, link, dest, title, list_log);
	if (file == null) {
		return;
	}
	if (upload.upload_folder_preparation(link, folder) == null) {
		response.statusCode = 400;
		response.end("Malformed URL provided.");
		return;
	}

	upload.stream_upload(log, request, response, link, file, list_log);
}

const notify_func = function (log, request, response) {
	var body = request.headers["x-body-header"];
	body = decodeURIComponent(body);
	custom_logger(log, "LOG", body);
	response.statusCode = 200;
	response.end();
}

const exists_func = async function (log, request, response) {
	var link = request.headers["x-link-header"];
	var folder = request.headers["x-folder-header"];
	var title = request.headers["x-title-header"];
	if (!link || !title ||
		link == "" || title == "") {
		custom_logger(log, "ERROR", "Upload missing headers. *exists_func");
		custom_logger(log, "ERROR", "Link Header: " + link + "\nTitle Header: " + title);
		response.statusCode = 401;
		response.end("Missing headers...");
		return;
	}
	if (!folder || folder == "") {
		folder = ".";
	}
	link = decodeURIComponent(link);
	folder = decodeURIComponent(folder);
	title = decodeURIComponent(title);

	var downloaded = (await constants.ACCESSOR.read(constants.DOWNLOADEDLISTFILEPATH));
	downloaded = [...new Set(downloaded.split("\n").filter((item) => {
		return item.trim() != "";
	}))];
	if (downloaded.includes(link) && !constants.REDOWNLOAD) {
		response.statusCode = 200;
		response.end("1");
		return;
	}

	if (!exists.folder_exists(log, link, folder)) {
		response.statusCode = 200;
		response.end("0");
		return;
	}

	const result = exists.file_exists(log, link, folder, title);
	// Read all files in the directory
	if (result) {
		response.statusCode = 200;
		response.end("1");
	} else {
		response.statusCode = 200;
		response.end("0");
	}
}

const read_body = function(log, request, response) {
	return new Promise((resolve, reject) => {
		const MAX_SIZE = 1e6;
		body = "";
		request.on("data", (chunk) => {
			body += chunk;
			if (body.length >= MAX_SIZE) {
				throw new Error("Max size exceeded.");
			}
		})
		request.on("error", (error) => {
			custom_logger(log, "ERROR", error);
			response.statusCode = 400;
			response.end('Bad request');
			resolve(null);
		});
		request.on("end", () => {
			resolve(body);
		});
	});
}

const server = http.createServer(async (request, response) => {
	response.setHeader('Access-Control-Allow-Origin', '*');
	response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
	response.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-Intent-Header, X-Link-Header, X-Folder-Header, X-Title-Header, X-Mime-Header, X-Ext-Header, X-Log-Header, X-Body-Header');
	if (request.method === 'OPTIONS') {
		response.statusCode = 204;
		response.end();
		return;
	} else if (request.method != "POST") {
		response.statusCode = 405;
		response.end(`Only POST methods are supported.`);
		return;
	}
	response.statusCode = 200;
	var log = request.headers["x-log-header"];
	if (!log || log == "" || !/^[0-9]*$/g.test(log)) {
		log = 1;
	} else {
		log = parseInt(log);
	}
	var intent = request.headers["x-intent-header"];
	switch (intent) {
		case "notify":
			notify_func(log, request, response);
			break;
		case "exists":
			exists_func(log, request, response);
			break;
		case "upload":
			upload_func(log, request, response);
			break;
		case "upload-no-log":
			upload_func(log, request, response, false);
			break;
		case "download":
			download_func(log, request, response);
			break;
		case "proxy":
			var body = await read_body(log, request, response);
			if (body == null) {
				return;
			}
			if (request.headers["content-type"] == "application/json") {
				body = JSON.parse(body);
			}
			try {
				url = new URL(body.url);
			} catch (err) {
				response.statusCode = 400;
				response.end("Malformed URL provided.");
				return;
			}
			if (body.options == null) {
				proxy.processQueue(log, url, request, response);
			} else {
				proxy.processQueue(log, url, request, response, body.options);
			}
			break;
		default:
			response.statusCode = 413;
			response.end("Unsupported intent: " + intent);
	}
});

server.listen(constants.PORT, () => {
	custom_logger("LOG", `Listening at 'http://localhost:${constants.PORT}'...`);
});

