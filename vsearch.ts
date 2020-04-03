#!/usr/bin/env node

// import modules with defaults
import * as path from 'path';
import * as math from 'math';
import * as fs from 'fs';
import * as java from 'java';
import * as winston from 'winston';
import * as exif from 'jpeg-exif';
import * as java_rt from 'node-java-rt';
import * as lucene from 'node-lucene';
import * as getopts from 'getopts';
import * as conf from 'conf';
const fileType = require('file-type');

// globals
const appVersion: string = '0.0.3';
let logger: winston.Logger;
let args: getopts.ParsedOptions;
let indexFolder: java_rt.nio.file.Path;
let directory: lucene.store.Directory;
let analyzer: lucene.analysis.Analyzer;
let writer: lucene.index.IndexWriter;
let reader: lucene.index.IndexReader;
let numDocsStart: number = 0;
let searchDir = [];
let excludeDir: string[] = [];
let timeStamp: number = 0;
var tikaRunning: boolean = false;

const config = new conf({
  cwd: '.',
  projectName: 'vsearch',
  configName: 'vsearch',
});

// init helper functions
function globalInit() {
  // init console logger
  const logFile = config.get('logFile');
  if (logFile == null) {
    console.log('configError: logFile not defined');
    process.exit(1);
  }
  const logColors = {
    info: 'blue',
    verbose: 'gray',
    debug: 'gray',
    error: 'red',
  };
  winston.addColors(logColors);
  logger = winston.createLogger({
    level: 'info', // default level for console
    transports: [
      new winston.transports.Console({
        format: winston.format.cli(),
      }),
      new winston.transports.File({
        level: 'debug',
        filename: `${logFile}`,
        format: winston.format.combine(
            winston.format.timestamp( {format: 'YYYY-MM-DD HH:mm:ss'} ),
            winston.format.printf((info) => `${info.timestamp} ${info.level}: ${JSON.stringify(info.message)}`),
        ),
      }),
    ],
  });

  // read command line args
  logger.debug(`argv: ${process.argv}`);
  args = getopts(process.argv.slice(2), {
    alias: {
      help: 'h',
      create: 'c',
      format: 'f',
      search: 's',
      number: 'n',
      info: 'i',
      verbose: 'v',
      debug: 'd',
    },
    default: {
      help: false,
      format: false,
      number: 10,
    },
  });
  if (args.verbose) {
    logger.level = 'verbose';
    logger.verbose(`setVerbose: ${args.verbose}`);
  }
  if (args.debug) {
    logger.level = 'debug';
    logger.verbose(`setDebug: ${args.debug}`);
  }

  logger.verbose(`logFile: ${logFile}`);
  logger.verbose(`getConfig: ${config.path}`);

  return true;
}

// helper: does string start with substring
function has(what, substring) {
  return ((what.indexOf(substring) == 0));
}

function checkTikaServer(jar) {
  // const cmd = `java -Duser.home=/tmp -jar ${jar}`;
  logger.verbose('tikaServerJava: ' + jar);
  try {
/*
    const url = 'http://localhost:9998';
    var res = request('GET', url, {
      timeout: 2000,
      retry: false,
    });
    const body:string = res.body.toString('utf-8');
    const startLoc = body.indexOf('Apache Tika');
    const endLoc = body.indexOf('</title>');
    if (startLoc != -1) {
      const ver = body.substring(startLoc, endLoc);
      logger.verbose('tikaServer: ' + ver);
      tikaRunning = true;
    } else {
      logger.warn('tikaServer: not running');
    }
*/
  } catch (err) {
    logger.warn('tikaServer: ' + err.message);
  }
}

function addDataTika(file, stats):string {
  if (!tikaRunning) {
    logger.debug('addData: tika server is not available');
    return '[no data]';
  }
  var data = '';
  try {
/*
    var buf = readFileHeader(file, stats, 1024*1024);
    const url = 'http://localhost:9998';
    var res = request('POST', url, {
      headers: {Accept: 'text/plain'},
      timeout: 2000,
      retry: false,
    });
    const body:string = res.body.toString('utf-8');
*/
    return data;
  } catch (err) {
    logger.warn('addData: tika ' + err.message);
    return '[no data]';
  }
}

// general lucene database init calls, used later by both reader and writer
function luceneInit() {
  try {
    const luceneClassDir = config.get('luceneClassDir');
    if (luceneClassDir == null) {
      logger.error('luceneClassDir not specified');
      process.exit(1);
    } else {
      logger.verbose(`javaClassInit: ${luceneClassDir}`);
    }
    const files = fs.readdirSync( <string>luceneClassDir);
    files.map( (file) => {
      if (file.indexOf('tika-server') != -1) {
        checkTikaServer(path.join(luceneClassDir, file));
      } else {
        logger.debug(` classPath: ${file}`);
        java.classpath.push(`${luceneClassDir}/${file}`);
      }
    });
    const dbDir = config.get('luceneDBDir');
    if (dbDir == null) {
      logger.error('luceneDBDir not specified');
      process.exit(1);
    } else {
      logger.debug(`luceneDBDir: ${dbDir}`);
    }
    indexFolder = java_rt.nio.file.Paths.getSync('.', <string>dbDir);
    lucene.initialize();
    const javaVer = java.import('java.lang.System');
    logger.verbose(`javaVersion: ${javaVer.getPropertySync('java.version')}`);
    const luceneVer = java.import('org.apache.lucene.util.Version');
    logger.verbose(`luceneVersion: ${luceneVer.LATEST.major}.${luceneVer.LATEST.minor}.${luceneVer.LATEST.bugfix}`);
    directory = lucene.store.FSDirectory.openSync(indexFolder);
    logger.verbose(`luceneDirectory: ${directory.toString()}`);
    analyzer = new lucene.analysis.standard.StandardAnalyzer();
  } catch (err) {
    logger.error(`luceneInit: ${err}`);
    process.exit(1);
  }
}

// called from lucenesearchfield to print results
function printDoc(docs, searcher) {
  const count = math.min(args.number, docs.totalHits);
  if (count == 0) {
    return;
  }
  for (let i = 0; i < count; i++) {
    try {
      const doc = searcher.doc(docs.scoreDocs[i].doc);
      const score = math.round(docs.scoreDocs[i].score);
      const file = path.join(doc.get('path'), doc.get('name'));
      logger.info(` ${i + 1}: ${file} (score=${score} size=${doc.get('size')} mime=${doc.get('mime')})`);
    } catch (err) {
      logger.error(`printDoc: ${err}`);
    }
  }
}

// called from lucenesearch after initialization
function luceneSearchDocs(search, searcher, parser) {
  try {
    const query = parser.parse(search);
    const docs = searcher.search(query, 1000);
    let printNum = '';
    const hits = docs.totalHits;
    if (args.number < hits) {
      printNum = ` (limiting output to ${args.number} result)`;
    }
    if (hits > 0) {
      logger.info(`luceneSearchDocs: ${search} ${hits} hits${printNum}`);
    } else {
      logger.debug(`luceneSearchDocs: ${search} ${hits} hits${printNum}`);
    }
    printDoc(docs, searcher);
  } catch (err) {
    logger.error('luceneSearchDocs error');
  }
}

// initialize lucene java processes and run search
function luceneSearch(keyword) {
  logger.info('luceneSearch');
  try {
    reader = lucene.index.DirectoryReader.open(directory);
    const searcher = new lucene.search.IndexSearcher(reader);
    const parser = new lucene.queryparser.classic.QueryParser('', analyzer);
    luceneSearchDocs(`${'path:' + '"'}${keyword}"`, searcher, parser);
    luceneSearchDocs(`${'name:' + '"'}${keyword}"`, searcher, parser);
    luceneSearchDocs(`${'mime:' + '"'}${keyword}"`, searcher, parser);
    luceneSearchDocs(`${'data:' + '"'}${keyword}"`, searcher, parser);
  } catch (err) {
    logger.error(`luceneSearch:${err}`);
  }
}

// print lucene db stats
function luceneInfo() {
  logger.info('loggerInfo');
  try {
    const reader = lucene.index.DirectoryReader.open(directory);
    logger.info('luceneReader: [org.apache.lucene.index.SegmentInfos]');
    logger.debug(reader);
  } catch (err) {
    logger.error(`luceneInfo: ${err}`);
  }
}

// initialize lucene java processes before writes
function luceneWriteInit() {
  logger.info('luceneWrite');
  const writerConfig = new lucene.index.IndexWriterConfig(analyzer);
  logger.debug('writerConfig:' + JSON.stringify(writerConfig.toString()));
  try {
    if (args.format) {
      logger.info('luceneFormatDB');
      writerConfig.setOpenMode(lucene.index.IndexWriterConfig$OpenMode.CREATE);
    } else {
      writerConfig.setOpenMode(lucene.index.IndexWriterConfig$OpenMode.CREATE_OR_APPEND);
    }
    writer = new lucene.index.IndexWriter(directory, writerConfig);
    numDocsStart = writer.numDocsSync();
    logger.verbose(`luceneIndex: ${numDocsStart} documents currently in index`);
  } catch (err) {
    logger.error('luceneWriteInit: cannot initialize writer');
  }
}

function readFileHeader(file, stats, size) {
  const fd = fs.openSync(file, 'r');
  size = math.min(size, stats.size);
  const buffer: Buffer = Buffer.alloc(size);
  fs.readSync(fd, buffer, 0, size, 0);
  fs.closeSync(fd);
  return buffer;
}

// add file data
function addData(file, stats, mime) {
  let data = '[no data]';
  try {
    if (stats.isDirectory()) {
      data = '[directory]';
    }
    if (has(mime, 'text')) {
      logger.debug(`addData: text ${file}: ${mime}`);
      data = readFileHeader(file, stats, 65536).toString(); // for text files, read first 64k
    }
    if (has(mime, 'image')) {
      logger.debug(`addData: exif ${file}: ${mime}`);
      const buf = readFileHeader(file, stats, 2048); // for exif data, read first 2k
      const meta = exif.fromBuffer(buf);
      data = JSON.stringify(meta);
      if (data == null) {
        data = '[no exif data]';
      }
    }
    if (has(mime, 'application/pdf')) {
      data = addDataTika(file, stats);
      return data;
    }
  } catch (err) {
    data = '[data error]';
    logger.warn(`addData: ${err}`);
  }
  return data;
}

function detectMime(file, stats) {
  try {
    const buf = readFileHeader(file, stats, 4096); // for magic data data, read first 1k
    const obj = fileType(buf);
    if (obj !== undefined) {
      return obj.mime;
    } else {
      return 'unknown';
    }
  } catch (err) {
    return 'unknown';
  }
}

// add individual file to lucene database
async function addFile(dir, name, stats) {
  if (writer == null) {
    logger.error('addFile: luceneWriter is null');
  }
  try {
    const file = path.join(dir, name);
    const doc = new lucene.document.Document();
    doc.add(new lucene.document.TextField('path', dir, lucene.document.FieldStore.YES));
    doc.add(new lucene.document.TextField('name', name, lucene.document.FieldStore.YES));
    doc.add(new lucene.document.TextField('size', stats.size.toString(), lucene.document.FieldStore.YES));
    doc.add(new lucene.document.TextField('ctime', stats.ctimeMs.toString(), lucene.document.FieldStore.YES));
    doc.add(new lucene.document.TextField('mtime', stats.mtimeMs.toString(), lucene.document.FieldStore.YES));
    const mime: string = detectMime(file, stats);
    doc.add(new lucene.document.TextField('mime', mime, lucene.document.FieldStore.YES));
    const data: string = addData(file, stats, mime);
    doc.add(new lucene.document.TextField('data', data, lucene.document.FieldStore.YES));
    writer.addDocument(doc);
    logger.debug(`addRecord: ${file}: mime=${mime}`);
  } catch (err) {
    logger.error('addFile: ' + path.join(dir, name) + ': ' + err.message);
  }
}

// walk individual dir and call addfile
function walkDir(dir: string) {
  if (excludeDir.indexOf(dir) != -1) {
    logger.verbose(`walkdir exclude: ${dir}`);
    return;
  }
  let list: string[] = [];
  try {
    list = fs.readdirSync(dir);
  } catch (err) {
    logger.warn(`readdirSync: ${err}`);
    return null;
  }
  list.map(async (name) => {
    const itemPath = path.join(dir, name);
    try {
      const stats = fs.statSync(itemPath);
      if (stats.isDirectory()) {
        walkDir(itemPath);
      }
      await addFile(dir, name, stats);
    } catch (err) {
      logger.warn(`statSync: ${itemPath} : ${err}`);
    }
  });
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
  logger.info(`searchDir all: ${searchDir}`);
  logger.info(`excludeDir all: ${excludeDir}`);
  timeStamp = Date.now();
  logger.verbose('walkFS starting');
  searchDir.map((dir) => {
    logger.info(`searchDir: ${dir}`);
    walkDir(dir);
    writer.flushSync();
    logger.info(`searchDir end: ${dir}`);
  });
  //  var elapsed = (Date.now() - timeStamp) / 1000
  //  logger.verbose('walkFS ended: ' + elapsed + ' sec')
  //  return promise
}

// flush lucene db before app exit, only used for writes
function luceneClose() {
  if (writer != null) {
    const numDocsEnd = writer.numDocsSync();
    const numDocs = numDocsEnd - numDocsStart;
    const elapsed = (Date.now() - timeStamp);
    const docsPerSec = math.round(1000 * numDocs / elapsed);
    logger.info(`luceneIndex: total ${numDocs} documents added (${docsPerSec} docs/sec)`);
    logger.info(`luceneIndex: total ${numDocsEnd} documents in index`);
    writer.flushSync();
    writer.closeSync();
    logger.verbose('luceneClose');
  } else {
    logger.error('luceneClose: already closed');
  }
}

// print usage help
function printHelp() {
  console.log(`vsearch v${appVersion}`);
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
