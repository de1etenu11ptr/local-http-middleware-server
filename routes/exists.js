const { parse } = require('tldts'); //For extracting domains from subdomains.
const path = require('path');
const fs = require("fs");

const { custom_logger } = require("../utils/logger");
const constants = require("../utils/constants");
const list_manager = require("../utils/list_manager");

const get_dir = function (link, folder) {
	var url;
	try {
		url = new URL(link);
	} catch (err) {
		return null;
	}
	const domainName = parse(url.href).domain;
	var dest = path.join(constants.DESTFOLDER, domainName);
	dest = path.join(dest, folder);
	return dest;
}

const folder_exists = function(log, link, folder) {
	const dest = get_dir(link, folder);
	return fs.existsSync(dest);
}

const file_exists = function(log, link, folder, title) {
	const dir = get_dir(link, folder);

	const files = fs.readdirSync(dir);

	return  files.some((file) => {
		// Check if any file matches the base name (ignoring extension)
		//console.debug(path.parse(file).name, path.parse(file).name == title, title);
		if (!(path.parse(file).name === title)) return false;
		var pathname = path.join(dir, file);
		var stats = fs.statSync(pathname);
		var file_size_bytes = stats.size;
		var file_size_mbytes = file_size_bytes / (1024 * 1024);
		//console.debug("Bytes: " + file_size_bytes);
		//console.debug("MegaBytes: " + file_size_mbytes);
		if (file_size_mbytes == 0) {
			fs.unlinkSync(pathname); // Delete partial
			return false;
		} else {
			return true;
		}
	});
}

module.exports = {get_dir, file_exists, folder_exists};
