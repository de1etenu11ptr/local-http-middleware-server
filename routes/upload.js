const { parse } = require('tldts'); //For extracting domains from subdomains.
const path = require('path');
const fs = require("fs");
const fileTypes = require("file-type");

const { custom_logger } = require("../utils/logger");
const constants = require("../utils/constants");
const list_manager = require("../utils/list_manager");

const upload_folder_preparation = function (link, folder) {
	var url;
	try {
		url = new URL(link);
	} catch (err) {
		return null;
	}
	const domainName = parse(url.href).domain;
	var dest = path.join(constants.DESTFOLDER, domainName);
	try {
		fs.access(dest, fs.constants.F_OK);
	} catch {
		fs.mkdirSync(dest, {
			recursive: true
		});
	}
	dest = path.join(dest, folder)
	try {
		fs.access(dest, fs.constants.F_OK);
	} catch {
		fs.mkdirSync(dest, {
			recursive: true
		});
	}
	return dest;
}

const upload_download_check = async function (log, response, link) {
	var downloaded = (await constants.ACCESSOR.read(constants.DOWNLOADEDLISTFILEPATH));
	downloaded = [...new Set(downloaded.split("\n").filter((item) => {
		return item.trim() != "";
	}))];
	if (downloaded.includes(link) && !constants.REDOWNLOAD) {
		custom_logger(log, "LOG", `\x1b[35mAlready downloaded "${link}".\x1b[0m`);
		response.statusCode = 200;
		response.end();
		return false;
	}
	return true;
}

const upload_file_check = function (log, response, link, dest, title, list_log = true) {
	const file = path.join(dest, `${title}`);
	if (fs.existsSync(file) && !constants.REDOWNLOAD) {
		if (!upload_file_size_check(file)) {
			fs.unlinkSync(file); // Delete partial
			return file;
		}
		if (list_log) list_manager.logDownload(link);
		custom_logger(log, "LOG", `\x1b[32mStream already saved to "${file}"\x1b[0m`);
		response.statusCode = 200;
		response.end();
		return null;
	}
	return file;
}

const upload_file_size_check = function (file) {
	var stats = fs.statSync(file);
	var file_size_bytes = stats.size;
	var file_size_mbytes = file_size_bytes / (1024 * 1024);
	//console.debug("Bytes: " + file_size_bytes);
	//console.debug("MegaBytes: " + file_size_mbytes);
	return file_size_mbytes == 0 ? false : true;
}

const stream_upload = async function (log, request, response, link, file, list_log = true) {
	var mime_header = request.headers["x-mime-header"];
	var ext_header = request.headers["x-ext-header"];
	const high_water_mark = (2 ** 12) * 1024;
	const file_stream = fs.createWriteStream(file, {high_water_mark});
	var type_promise;
	if (mime_header) {
		if (/^text\//g.test(mime_header) && !ext_header) ext_header = "";
		type_promise = /^text\//g.test(mime_header) ? {mime: mime_header, ext: ext_header} : fileTypes.fileTypeFromStream(request);
	} else {
		type_promise = fileTypes.fileTypeFromStream(request);
	}

	request.pipe(file_stream);

	const type = await type_promise;
	if (!type || !type.mime) {
		request.unpipe(file_stream);
		request.destroy();
		file_stream.end();
		if (fs.existsSync(file)) {
			fs.unlinkSync(file); // Delete partial
		}
		response.statusCode = 402;
		response.end("Something went wrong trying to determine mime-type");
		return;
	}
	const ext = type ? type.ext : "bin";
	const final_file = `${file}.${ext}`;
	if (type.mime == "video/mp2t") {
		if ((upload_file_check(log, response, link, file, ".mp4")) == null) {
			request.unpipe(file_stream);
			request.destroy();
			file_stream.end();
			if (fs.existsSync(file)) {
				fs.unlinkSync(file);
			}
			response.statusCode = 200;
			response.end();
			return;
		}
	}
	if ((upload_file_check(log, response, link, file, "." + ext)) == null) {
		request.unpipe(file_stream);
		request.destroy();
		file_stream.end();
		if (fs.existsSync(file)) {
			fs.unlinkSync(file);
		}
		response.statusCode = 200;
		response.end();
		return;
	}

	file_stream.on("finish", () => {
		fs.renameSync(file, final_file);
		if (!upload_file_size_check(final_file)) {
			if (fs.existsSync(file)) {
				fs.unlinkSync(file);
			}
			if (fs.existsSync(final_file)) {
				fs.unlinkSync(final_file);
			}
			response.statusCode = 400;
			response.end();
			return;
		}
		custom_logger(log, "LOG", `\x1b[32m✅ Stream saved to "${final_file}"\x1b[0m`);
		if (list_log) list_manager.logDownload(link);
		response.statusCode = 200;
		response.end();
	})
	file_stream.on("error", async (error) => {
		request.unpipe(file_stream);
		request.destroy();
		custom_logger(log, "ERROR", `\x1b[31mError: \x1b[0m`, error);
		custom_logger(log, "ERROR", `\x1b[31mFailed to write stream to "${file}"\x1b[0m`);
		if (fs.existsSync(file)) {
			fs.unlinkSync(file);
		}
		if (final_file && fs.existsSync(final_file)) {
			fs.unlinkSync(final_file);
		}
		response.statusCode = 400;
		response.end("Failed to write stream.");
	});
}


module.exports = {stream_upload, upload_file_check, upload_download_check, upload_folder_preparation};
