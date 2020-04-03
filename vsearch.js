#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
// import modules with defaults
var path = require("path");
var math = require("math");
var fs = require("fs");
var java = require("java");
var winston = require("winston");
var exif = require("jpeg-exif");
var java_rt = require("node-java-rt");
var lucene = require("node-lucene");
var getopts = require("getopts");
var conf = require("conf");
var fileType = require('file-type');
var request = require('sync-request');
// globals
var appVersion = '0.0.3';
var logger;
var args;
var indexFolder;
var directory;
var analyzer;
var writer;
var reader;
var numDocsStart = 0;
var searchDir = [];
var excludeDir = [];
var timeStamp = 0;
var config = new conf({
    cwd: '.',
    projectName: 'vsearch',
    configName: 'vsearch'
});
// init helper functions
function globalInit() {
    // init console logger
    var logFile = config.get('logFile');
    if (logFile == null) {
        console.log('configError: logFile not defined');
        process.exit(1);
    }
    var logColors = {
        info: 'blue',
        verbose: 'gray',
        debug: 'gray',
        error: 'red'
    };
    winston.addColors(logColors);
    logger = winston.createLogger({
        level: 'info',
        transports: [
            new winston.transports.Console({
                format: winston.format.cli()
            }),
            new winston.transports.File({
                level: 'debug',
                filename: "" + logFile,
                format: winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.printf(function (info) { return info.timestamp + " " + info.level + ": " + JSON.stringify(info.message); }))
            }),
        ]
    });
    // read command line args
    logger.debug("argv: " + process.argv);
    args = getopts(process.argv.slice(2), {
        alias: {
            help: 'h',
            create: 'c',
            format: 'f',
            search: 's',
            number: 'n',
            info: 'i',
            verbose: 'v',
            debug: 'd'
        },
        "default": {
            help: false,
            format: false,
            number: 10
        }
    });
    if (args.verbose) {
        logger.level = 'verbose';
        logger.verbose("setVerbose: " + args.verbose);
    }
    if (args.debug) {
        logger.level = 'debug';
        logger.verbose("setDebug: " + args.debug);
    }
    logger.verbose("logFile: " + logFile);
    logger.verbose("getConfig: " + config.path);
    return true;
}
// helper: does string start with substring
function has(what, substring) {
    return ((what.indexOf(substring) == 0));
}
function checkTikaServer(jar) {
    // const cmd = `java -Duser.home=/tmp -jar ${jar}`;
    logger.verbose('tikaServerJava: ' + jar);
    var url = 'http://localhost:9998';
    try {
        var res = request('GET', url, {
            timeout: 2000,
            retry: false
        });
        var body = res.body.toString('utf-8');
        var startLoc = body.indexOf('Apache Tika');
        var endLoc = body.indexOf('</title>');
        if (startLoc != -1) {
            var ver = body.substring(startLoc, endLoc);
            logger.verbose('tikaServer: ' + ver);
            return true;
        }
        else {
            logger.warn('tikaServer: not running');
            return false;
        }
    }
    catch (err) {
        logger.warn('tikaServer: ' + err.message);
        return false;
    }
}
// general lucene database init calls, used later by both reader and writer
function luceneInit() {
    try {
        var luceneClassDir_1 = config.get('luceneClassDir');
        if (luceneClassDir_1 == null) {
            logger.error('luceneClassDir not specified');
            process.exit(1);
        }
        else {
            logger.verbose("javaClassInit: " + luceneClassDir_1);
        }
        var files = fs.readdirSync(luceneClassDir_1);
        files.map(function (file) {
            if (file.indexOf('tika-server') != -1) {
                checkTikaServer(path.join(luceneClassDir_1, file));
            }
            else {
                logger.debug(" classPath: " + file);
                java.classpath.push(luceneClassDir_1 + "/" + file);
            }
        });
        var dbDir = config.get('luceneDBDir');
        if (dbDir == null) {
            logger.error('luceneDBDir not specified');
            process.exit(1);
        }
        else {
            logger.debug("luceneDBDir: " + dbDir);
        }
        indexFolder = java_rt.nio.file.Paths.getSync('.', dbDir);
        lucene.initialize();
        var javaVer = java["import"]('java.lang.System');
        logger.verbose("javaVersion: " + javaVer.getPropertySync('java.version'));
        var luceneVer = java["import"]('org.apache.lucene.util.Version');
        logger.verbose("luceneVersion: " + luceneVer.LATEST.major + "." + luceneVer.LATEST.minor + "." + luceneVer.LATEST.bugfix);
        directory = lucene.store.FSDirectory.openSync(indexFolder);
        logger.verbose("luceneDirectory: " + directory.toString());
        analyzer = new lucene.analysis.standard.StandardAnalyzer();
    }
    catch (err) {
        logger.error("luceneInit: " + err);
        process.exit(1);
    }
}
// called from lucenesearchfield to print results
function printDoc(docs, searcher) {
    var count = math.min(args.number, docs.totalHits);
    if (count == 0) {
        return;
    }
    for (var i = 0; i < count; i++) {
        try {
            var doc = searcher.doc(docs.scoreDocs[i].doc);
            var score = math.round(docs.scoreDocs[i].score);
            var file = path.join(doc.get('path'), doc.get('name'));
            logger.info(" " + (i + 1) + ": " + file + " (score=" + score + " size=" + doc.get('size') + " mime=" + doc.get('mime') + ")");
        }
        catch (err) {
            logger.error("printDoc: " + err);
        }
    }
}
// called from lucenesearch after initialization
function luceneSearchDocs(search, searcher, parser) {
    try {
        var query = parser.parse(search);
        var docs = searcher.search(query, 1000);
        var printNum = '';
        var hits = docs.totalHits;
        if (args.number < hits) {
            printNum = " (limiting output to " + args.number + " result)";
        }
        if (hits > 0) {
            logger.info("luceneSearchDocs: " + search + " " + hits + " hits" + printNum);
        }
        else {
            logger.debug("luceneSearchDocs: " + search + " " + hits + " hits" + printNum);
        }
        printDoc(docs, searcher);
    }
    catch (err) {
        logger.error('luceneSearchDocs error');
    }
}
// initialize lucene java processes and run search
function luceneSearch(keyword) {
    logger.info('luceneSearch');
    try {
        reader = lucene.index.DirectoryReader.open(directory);
        var searcher = new lucene.search.IndexSearcher(reader);
        var parser = new lucene.queryparser.classic.QueryParser('', analyzer);
        luceneSearchDocs("" + 'path:' + '"' + keyword + "\"", searcher, parser);
        luceneSearchDocs("" + 'name:' + '"' + keyword + "\"", searcher, parser);
        luceneSearchDocs("" + 'mime:' + '"' + keyword + "\"", searcher, parser);
        luceneSearchDocs("" + 'data:' + '"' + keyword + "\"", searcher, parser);
    }
    catch (err) {
        logger.error("luceneSearch:" + err);
    }
}
// print lucene db stats
function luceneInfo() {
    logger.info('loggerInfo');
    try {
        var reader_1 = lucene.index.DirectoryReader.open(directory);
        logger.info('luceneReader: [org.apache.lucene.index.SegmentInfos]');
        logger.debug(reader_1);
    }
    catch (err) {
        logger.error("luceneInfo: " + err);
    }
}
// initialize lucene java processes before writes
function luceneWriteInit() {
    logger.info('luceneWrite');
    var writerConfig = new lucene.index.IndexWriterConfig(analyzer);
    logger.debug('writerConfig:');
    logger.debug(JSON.stringify(writerConfig.toString()));
    try {
        if (args.format) {
            logger.info('luceneFormatDB');
            writerConfig.setOpenMode(lucene.index.IndexWriterConfig$OpenMode.CREATE);
        }
        else {
            writerConfig.setOpenMode(lucene.index.IndexWriterConfig$OpenMode.CREATE_OR_APPEND);
        }
        writer = new lucene.index.IndexWriter(directory, writerConfig);
        numDocsStart = writer.numDocsSync();
        logger.verbose("luceneIndex: " + numDocsStart + " documents currently in index");
    }
    catch (err) {
        logger.error('luceneWriteInit: cannot initialize writer');
    }
}
function readFileHeader(file, stats, size) {
    var fd = fs.openSync(file, 'r');
    size = math.min(size, stats.size);
    var buffer = Buffer.alloc(size);
    fs.readSync(fd, buffer, 0, size, 0);
    fs.closeSync(fd);
    return buffer;
}
// add file data
function addData(file, stats, mime) {
    var data = '[no data]';
    try {
        if (stats.isDirectory()) {
            data = '[directory]';
        }
        if (has(mime, 'text')) {
            logger.debug("addDataText: " + file + ": " + mime);
            data = readFileHeader(file, stats, 65536).toString(); // for text files, read first 64k
        }
        if (has(mime, 'image')) {
            logger.debug("addDataMime: " + file + ": " + mime);
            var buf = readFileHeader(file, stats, 2048); // for exif data, read first 2k
            var meta = exif.fromBuffer(buf);
            data = JSON.stringify(meta);
            if (data == null) {
                data = '[no exif data]';
            }
        }
        if (has(mime, 'application/pdf')) {
            logger.debug("addDataTika: " + file + ": " + mime);
        }
    }
    catch (err) {
        data = '[data error]';
        logger.warn("addData: " + err);
    }
    return data;
}
function detectMime(file, stats) {
    try {
        logger.debug('detectMime1: ' + file);
        var buf = readFileHeader(file, stats, 4096); // for magic data data, read first 1k
        var obj = fileType(buf);
        logger.debug('detectMime2: ' + file);
        if (obj !== undefined) {
            logger.debug('detectMime3: ' + file);
            return obj.mime;
        }
        else {
            logger.debug('detectMime4: ' + file);
            return 'unknown';
        }
    }
    catch (err) {
        logger.debug('detectMime5: ' + file);
        return 'unknown';
    }
}
// add individual file to lucene database
function addFile(dir, name, stats) {
    return __awaiter(this, void 0, void 0, function () {
        var file, doc, mime, data;
        return __generator(this, function (_a) {
            if (writer == null) {
                logger.error('addFile: luceneWriter is null');
            }
            try {
                file = path.join(dir, name);
                doc = new lucene.document.Document();
                doc.add(new lucene.document.TextField('path', dir, lucene.document.FieldStore.YES));
                doc.add(new lucene.document.TextField('name', name, lucene.document.FieldStore.YES));
                doc.add(new lucene.document.TextField('size', stats.size.toString(), lucene.document.FieldStore.YES));
                doc.add(new lucene.document.TextField('ctime', stats.ctimeMs.toString(), lucene.document.FieldStore.YES));
                doc.add(new lucene.document.TextField('mtime', stats.mtimeMs.toString(), lucene.document.FieldStore.YES));
                mime = detectMime(file, stats);
                doc.add(new lucene.document.TextField('mime', mime, lucene.document.FieldStore.YES));
                data = addData(file, stats, mime);
                doc.add(new lucene.document.TextField('data', data, lucene.document.FieldStore.YES));
                writer.addDocument(doc);
                logger.debug("addRecord: " + file + ": mime=" + mime);
            }
            catch (err) {
                logger.error('addFile: ' + path.join(dir, name) + ': ' + err.message);
            }
            return [2 /*return*/];
        });
    });
}
// walk individual dir and call addfile
function walkDir(dir) {
    var _this = this;
    if (excludeDir.indexOf(dir) != -1) {
        logger.verbose("walkdir exclude: " + dir);
        return;
    }
    var list = [];
    try {
        list = fs.readdirSync(dir);
    }
    catch (err) {
        logger.warn("readdirSync: " + err);
        return null;
    }
    list.map(function (name) { return __awaiter(_this, void 0, void 0, function () {
        var itemPath, stats, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    itemPath = path.join(dir, name);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    stats = fs.statSync(itemPath);
                    if (stats.isDirectory()) {
                        walkDir(itemPath);
                    }
                    return [4 /*yield*/, addFile(dir, name, stats)];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    err_1 = _a.sent();
                    logger.warn("statSync: " + itemPath + " : " + err_1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); });
    return true;
}
// walk all paths from config file
function walkFS() {
    if (writer == null) {
        logger.error('luceneWriter is null, aborting');
        return;
    }
    searchDir = config.get('searchDir');
    if (searchDir == null) {
        logger.error('configError: searchDir not defined');
        return;
    }
    excludeDir = config.get('excludeDir');
    if (excludeDir == null) {
        logger.error('configError: excludeDir not defined');
        return;
    }
    logger.info("searchDir all: " + searchDir);
    logger.info("excludeDir all: " + excludeDir);
    timeStamp = Date.now();
    logger.verbose('walkFS starting');
    searchDir.map(function (dir) {
        logger.info("searchDir: " + dir);
        walkDir(dir);
        writer.flushSync();
        logger.info("searchDir end: " + dir);
    });
    //  var elapsed = (Date.now() - timeStamp) / 1000
    //  logger.verbose('walkFS ended: ' + elapsed + ' sec')
    //  return promise
}
// flush lucene db before app exit, only used for writes
function luceneClose() {
    if (writer != null) {
        var numDocsEnd = writer.numDocsSync();
        var numDocs = numDocsEnd - numDocsStart;
        var elapsed = (Date.now() - timeStamp);
        var docsPerSec = math.round(1000 * numDocs / elapsed);
        logger.info("luceneIndex: total " + numDocs + " documents added (" + docsPerSec + " docs/sec)");
        logger.info("luceneIndex: total " + numDocsEnd + " documents in index");
        writer.flushSync();
        writer.closeSync();
        logger.verbose('luceneClose');
    }
    else {
        logger.error('luceneClose: already closed');
    }
}
// print usage help
function printHelp() {
    console.log("vsearch v" + appVersion);
    console.log('(c) mandic@live.com');
    console.log('');
    console.log('recursively walk folders specified in config file, index all paths, filenames, determined file mime type and file stat data');
    console.log('for known file types, it also either analyzes the file headers (e.g. image exif data) or indexes full file content (e.g. text files)');
    console.log('all indexed data is stored in lucene index datastore specified in config file');
    console.log('all operations are performed in async fashion for maximum performance');
    console.log('developed using nodejs/typescript and java/lucene');
    console.log('');
    console.log('usage: vsearch -help | -info | -verbose/debug | -create [-format] | -search [-number num] <string>');
    console.log('parameters can be shortend using first letter only (e.g -h -i -v -c -f -s -n)');
    console.log('parameters:');
    console.log('  -info');
    console.log('   dump index database stats');
    console.log('  -verbose | -debug');
    console.log('   print detailed output during runtime');
    console.log('  -create [-format]');
    console.log('   create index for folder structure as specified in the config file');
    console.log('   -format: optional format the datastore, default is append');
    console.log('  -search <string> [-number <num>]');
    console.log('   search for <string> in datastore specified in config file');
    console.log('   -number <num>: optional limit results to number of records');
    console.log('configuration:');
    console.log('  see config/default.yml or config/default.json for details');
    console.log('indexing info:');
    console.log('  indexing will always record path, name, ctime, mtime, size, mime-type');
    console.log('  file is run through magic decoding to determine mime-type');
    console.log('  for recoginzed mime types, a data indexing is performed');
    console.log('search info:');
    console.log('  search will be performed in different indexes: path, name, mime-info, data');
    console.log('  string can be fixed, with ? or * wildcards, or end with ~ for fuzzy search');
    console.log('recognized mime-types:');
    console.log('  text/*: full text content');
    console.log('  image/*: image exif metadata, if present');
    console.log('');
}
// main function
function main() {
    globalInit();
    if (args.help) {
        printHelp();
        return;
    }
    luceneInit();
    if (args.info) {
        luceneInfo();
        return;
    }
    if (args.create) {
        luceneWriteInit();
        walkFS();
        luceneClose();
        return;
    }
    if (args.search != null) {
        luceneSearch(args.search);
        return;
    }
    logger.error('unknown command');
    printHelp();
}
main();
/*
issues:
  tika is disabled because starting tika java server causes runonce loop in mime detect to wait forever
  https://cwiki.apache.org/confluence/display/TIKA/TikaJAXRS#TikaJAXRS-GetHELLOmessageback
*/
