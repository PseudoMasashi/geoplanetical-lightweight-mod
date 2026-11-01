#!/usr/bin/env node
'use strict';
// Reads JavaScript from a local ASAR. Does not import or execute game code.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const GROUPS = {
  growth: /gdp|growth|grossDomestic|realOutput|nominalOutput/gi,
  inflation: /inflation|priceIndex|consumerPrice|deflator|costPush/gi,
  unemployment: /unemployment|unemployed|laborForce|labourForce|employmentRate|jobless/gi,
  monthEnd: /monthEnd|endOfMonth|end_of_month|monthly|advanceMonth|nextMonth|commitRevision|simulationWorkStatus/gi
};
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const MAX_FILE = 64 * 1024 * 1024, MAX_TOTAL = 256 * 1024 * 1024;

function readAt(fd, position, size, archiveSize) {
  if (!Number.isSafeInteger(position) || !Number.isSafeInteger(size) || size < 0 || position < 0 || position + size > archiveSize) {
    throw new Error('Invalid or truncated ASAR file range');
  }
  const buffer = Buffer.alloc(size);
  let offset = 0;
  while (offset < size) {
    const count = fs.readSync(fd, buffer, offset, size - offset, position + offset);
    if (!count) throw new Error('Unexpected end of ASAR');
    offset += count;
  }
  return buffer;
}

function inspect(archivePath) {
  const fd = fs.openSync(archivePath, 'r');
  try {
    const archiveSize = fs.fstatSync(fd).size;
    const prefix = readAt(fd, 0, 16, archiveSize);
    const headerSize = prefix.readUInt32LE(4), jsonSize = prefix.readUInt32LE(12);
    if (prefix.readUInt32LE(0) !== 4 || headerSize < 8 || headerSize > 32 * 1024 * 1024 ||
        prefix.readUInt32LE(8) !== headerSize - 4 || jsonSize > headerSize - 8) {
      throw new Error('Unsupported ASAR header');
    }
    const dataOffset = 8 + headerSize;
    const json = readAt(fd, 16, jsonSize, archiveSize);
    if (dataOffset > archiveSize) throw new Error('Truncated ASAR header');
    const header = JSON.parse(json.toString('utf8')), entries = [];
    function walk(node, parent = '', depth = 0) {
      if (depth > 64 || !node.files || typeof node.files !== 'object') throw new Error('Invalid ASAR directory');
      for (const [name, entry] of Object.entries(node.files)) {
        if (entries.length >= 100000) throw new Error('Too many ASAR entries');
        const file = parent ? `${parent}/${name}` : name;
        if (!entry || typeof entry !== 'object') throw new Error('Invalid ASAR entry');
        if (entry.files) walk(entry, file, depth + 1);
        else entries.push({ file, entry });
      }
    }
    walk(header);
    const report = {
      schemaVersion: 1, createdAt: new Date().toISOString(), archiveHeaderSha256: digest(json),
      explanation: 'Source search candidates, not verified formulas or causal contributions. No game code was executed. No save/profile files were read.',
      limits: { maxFileBytes: MAX_FILE, maxTotalBytes: MAX_TOTAL, snippetsPerGroupPerFile: 6, contextCharacters: 700, candidateFiles: 30 },
      files: [], candidates: [], skipped: [], totals: { javascriptFiles: 0, scannedBytes: 0 }
    };
    for (const { file, entry } of entries) {
      if (!/\.(?:js|mjs|cjs)$/i.test(file)) continue;
      report.totals.javascriptFiles++;
      if (entry.link || entry.unpacked) { report.skipped.push({ file, reason: 'Link or unpacked file; not followed' }); continue; }
      const size = Number(entry.size), offset = Number(entry.offset);
      if (!Number.isSafeInteger(size) || size < 0 || !Number.isSafeInteger(offset) || offset < 0) throw new Error(`Invalid ASAR range for ${file}`);
      if (size > MAX_FILE || report.totals.scannedBytes + size > MAX_TOTAL) {
        report.skipped.push({ file, reason: 'Inspection size limit' }); continue;
      }
      const bytes = readAt(fd, dataOffset + offset, size, archiveSize), source = bytes.toString('utf8');
      report.totals.scannedBytes += size;
      const counts = {}, snippets = [];
      for (const [group, pattern] of Object.entries(GROUPS)) {
        pattern.lastIndex = 0;
        let match, count = 0, lastEnd = -1;
        while ((match = pattern.exec(source))) {
          count++;
          if (snippets.filter(s => s.group === group).length >= 6 || match.index < lastEnd) continue;
          const start = Math.max(0, match.index - 700), end = Math.min(source.length, match.index + match[0].length + 700);
          snippets.push({ group, term: match[0], characterOffset: match.index,
            startCharacter: start, endCharacter: end, source: source.slice(start, end) });
          lastEnd = end;
        }
        counts[group] = count;
      }
      const info = { file, bytes: size, sha256: digest(bytes), counts };
      report.files.push(info);
      if (snippets.length) report.candidates.push({ ...info, snippets });
    }
    // Prefer code with several economic signals; a worker filename is only a hint.
    const score = item => Object.values(item.counts).filter(Boolean).length * 100 +
      (/worker|econom|simulat/i.test(item.file) ? 50 : 0) +
      Math.min(40, item.counts.inflation + item.counts.unemployment + item.counts.growth);
    report.candidates.sort((a, b) => score(b) - score(a) || a.file.localeCompare(b.file));
    report.omittedCandidateFiles = report.candidates.slice(30).map(item => item.file);
    report.candidates.length = Math.min(30, report.candidates.length);
    report.coverageLimited = report.skipped.length > 0 || report.omittedCandidateFiles.length > 0 ||
      report.candidates.some(item => Object.values(item.counts).some(count => count > 6));
    return report;
  } finally { fs.closeSync(fd); }
}

function main(args) {
  if (args.length < 1 || args.length > 2 || args[0] === '--help') {
    console.log('Usage: node scripts/inspect-economy.cjs <game-folder-or-app.asar> [new-report.json]');
    return args[0] === '--help' ? 0 : 1;
  }
  const input = path.resolve(args[0]);
  const archive = fs.statSync(input).isDirectory() ? path.join(input, 'resources', 'app.asar') : input;
  const output = path.resolve(args[1] || path.join(__dirname, '..', 'diagnostics', 'economy-inspection.json'));
  if (fs.existsSync(output)) throw new Error('Report already exists; choose a new output filename');
  const result = inspect(archive);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
  console.log(`Scanned ${result.files.length} JavaScript files. Saved ${output}`);
  console.log('This report contains local game source excerpts. Keep it out of public issues and commits.');
  if (result.coverageLimited) console.log('Coverage is limited; skipped files and excerpt limits are recorded in the report.');
  return 0;
}
module.exports = { inspect, main };
if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) { console.error(`Inspection stopped: ${error.message}`); process.exitCode = 1; }
}
