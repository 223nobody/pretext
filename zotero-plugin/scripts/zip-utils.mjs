import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i += 1) {
  let value = i;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  CRC_TABLE[i] = value >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosDate, dosTime };
}

function collectFiles(rootDir, dir = rootDir) {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const absolute = join(dir, entry.name);
      if (entry.isDirectory()) {
        return collectFiles(rootDir, absolute);
      }
      if (!entry.isFile()) {
        return [];
      }
      return [
        {
          absolute,
          relative: relative(rootDir, absolute).replaceAll("\\", "/"),
          stat: statSync(absolute),
        },
      ];
    })
    .sort((a, b) => a.relative.localeCompare(b.relative));
}

export function writeZipFromDirectory(sourceDir, zipPath) {
  const fileRecords = collectFiles(sourceDir);
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of fileRecords) {
    const data = readFileSync(file.absolute);
    const name = Buffer.from(file.relative, "utf8");
    const checksum = crc32(data);
    const { dosDate, dosTime } = dosDateTime(file.stat.mtime);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, name, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);

    offset += localHeader.length + name.length + data.length;
  }

  const centralOffset = offset;
  const centralDirectory = Buffer.concat(centralParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(fileRecords.length, 8);
  endRecord.writeUInt16LE(fileRecords.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(centralOffset, 16);
  endRecord.writeUInt16LE(0, 20);

  writeFileSync(zipPath, Buffer.concat([...localParts, centralDirectory, endRecord]));
}

export function listZipEntries(zipPath) {
  return readCentralDirectory(zipPath).map((entry) => entry.name);
}

export function readZipEntry(zipPath, entryName) {
  const zip = readFileSync(zipPath);
  const entry = readCentralDirectory(zipPath, zip).find((item) => item.name === entryName);
  if (!entry) {
    throw new Error(`ZIP entry not found: ${entryName}`);
  }
  if (entry.compressionMethod !== 0) {
    throw new Error(`Unsupported compressed ZIP entry: ${entryName}`);
  }

  const localOffset = entry.localOffset;
  if (zip.readUInt32LE(localOffset) !== 0x04034b50) {
    throw new Error(`Invalid ZIP: bad local header for ${entryName}`);
  }
  const nameLength = zip.readUInt16LE(localOffset + 26);
  const extraLength = zip.readUInt16LE(localOffset + 28);
  const dataOffset = localOffset + 30 + nameLength + extraLength;
  return zip.subarray(dataOffset, dataOffset + entry.uncompressedSize);
}

function readCentralDirectory(zipPath, zip = readFileSync(zipPath)) {
  const minEndOffset = Math.max(0, zip.length - 0xffff - 22);
  let endOffset = -1;
  for (let offset = zip.length - 22; offset >= minEndOffset; offset -= 1) {
    if (zip.readUInt32LE(offset) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset === -1) {
    throw new Error(`Invalid ZIP: missing end of central directory in ${zipPath}`);
  }

  const totalEntries = zip.readUInt16LE(endOffset + 10);
  const centralOffset = zip.readUInt32LE(endOffset + 16);
  const entries = [];
  let offset = centralOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error(`Invalid ZIP: bad central directory entry ${index}`);
    }
    const compressionMethod = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const uncompressedSize = zip.readUInt32LE(offset + 24);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    if (compressionMethod === 0 && compressedSize !== uncompressedSize) {
      throw new Error(`Invalid ZIP: stored entry has mismatched sizes for ${name}`);
    }
    entries.push({ name, compressionMethod, uncompressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}
