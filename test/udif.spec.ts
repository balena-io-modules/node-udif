import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { PassThrough } from 'stream';

import * as UDIF from '../lib';

import { images } from './data';

const DATADIR = path.join(__dirname, 'data');

const SOURCES = [
	'compression-adc.dmg',
	'compression-bz2.dmg',
	// NOTE: LZFSE not yet supported
	// 'compression-lzfse.dmg',
	'compression-raw.dmg',
	'compression-zlib.dmg',
].map((f) => path.join(DATADIR, f));

describe('UDIF.getUncompressedSize()', () => {
	images.forEach((data) => {
		it(data.filename, async () => {
			await UDIF.withOpenImage(
				path.join(DATADIR, data.filename),
				async (image) => {
					const size = await image.getUncompressedSize();
					assert.equal(size, data.uncompressedSize);
				},
			);
		});
	});
});

describe('UDIF.Image', () => {
	describe('image.footer.dataForkLength', () => {
		images.forEach((data) => {
			const filename = path.join(DATADIR, data.filename);
			it(data.filename, async () => {
				await UDIF.withOpenImage(filename, async (image) => {
					assert.equal(image.footer?.dataForkLength, data.dataForkLength);
				});
			});
		});
	});
	describe('image.getUncompressedSize()', () => {
		images.forEach((data) => {
			const filename = path.join(DATADIR, data.filename);
			it(data.filename, async () => {
				await UDIF.withOpenImage(filename, async (image) => {
					assert.equal(
						await image.getUncompressedSize(),
						data.uncompressedSize,
					);
				});
			});
		});
	});
	describe('image.verifyData()', () => {
		images.forEach((data) => {
			const filename = path.join(DATADIR, data.filename);
			it(data.filename, async () => {
				await UDIF.withOpenImage(filename, async (image) => {
					const verified = await image.verifyData();
					assert.strictEqual(verified, true);
				});
			});
		});
	});
});

function randInt(min: number, max: number) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

describe('UDIF.ReadStream', () => {
	describe('read & decompress image', () => {
		images.forEach((data) => {
			it(data.filename, async () => {
				await UDIF.withOpenImage(
					path.join(DATADIR, data.filename),
					async (image) => {
						let bytesRead = 0;

						const stream = await image.createReadStream();
						await new Promise<void>((resolve, reject) => {
							stream
								.on('error', reject)
								.on('data', (chunk: Buffer) => {
									bytesRead += chunk.length;
								})
								.on('end', () => {
									assert.equal(bytesRead, data.uncompressedSize);
									resolve();
								});
						});
					},
				);
			});
		});
	});

	describe('read with end option', () => {
		images.forEach((data) => {
			it(data.filename, async () => {
				await UDIF.withOpenImage(
					path.join(DATADIR, data.filename),
					async (image) => {
						// end is inclusive
						const end = randInt(0, data.uncompressedSize - 1);
						let bytesRead = 0;

						const stream = await image.createReadStream(end);
						await new Promise<void>((resolve, reject) => {
							stream
								.on('error', reject)
								.on('data', (chunk: Buffer) => {
									bytesRead += chunk.length;
								})
								.on('end', () => {
									assert.equal(bytesRead, end + 1);
									resolve();
								});
						});
					},
				);
			});
		});
	});

	describe('Compression Methods', () => {
		const expected = fs.readFileSync(path.join(DATADIR, 'decompressed.img'));

		describe('source image equality', () => {
			SOURCES.forEach((filename) => {
				const testName = path
					.basename(filename, '.dmg')
					.replace('compression-', '')
					.toUpperCase();

				it(testName, async () => {
					await UDIF.withOpenImage(filename, async (image) => {
						const size = await image.getUncompressedSize();
						const actual = Buffer.allocUnsafe(size);
						let offset = 0;
						const stream = await image.createReadStream();
						await new Promise<void>((resolve, reject) => {
							stream
								.on('error', reject)
								// NOTE: This can catch & bubble up read/push after EOD errors,
								// which have previously gone unnoticed
								.pipe(new PassThrough())
								.on('data', (chunk: Buffer) => {
									chunk.copy(actual, offset);
									offset += chunk.length;
								})
								.once('end', () => {
									assert.ok(expected.equals(actual));
									assert.equal(expected.length, size);
									resolve();
								});
						});
					});
				});
			});
		});
	});
});

describe('UDIF.SparseReadStream', () => {
	describe('read & decompress image', () => {
		images.forEach((data) => {
			it(data.filename, async () => {
				await UDIF.withOpenImage(
					path.join(DATADIR, data.filename),
					async (image) => {
						const stream = await image.createSparseReadStream();
						await new Promise<void>((resolve, reject) => {
							let bytesRead = 0;
							stream
								.on('error', reject)
								.on('data', (block: { buffer: Buffer; position: number }) => {
									bytesRead += block.buffer.length;
								})
								.on('end', () => {
									assert.equal(bytesRead, data.mappedSize);
									resolve();
								});
						});
					},
				);
			});
		});
	});

	describe('Compression Methods', () => {
		const expected = fs.readFileSync(path.join(DATADIR, 'decompressed.img'));

		describe('source image equality', () => {
			SOURCES.forEach((filename) => {
				const testName = path
					.basename(filename, '.dmg')
					.replace('compression-', '')
					.toUpperCase();

				it(testName, async () => {
					await UDIF.withOpenImage(filename, async (image) => {
						const size = await image.getUncompressedSize();
						const actual = Buffer.alloc(size);
						const stream = await image.createSparseReadStream();
						await new Promise<void>((resolve, reject) => {
							stream
								.on('error', reject)
								// NOTE: This can catch & bubble up read/push after EOD errors,
								// which have previously gone unnoticed
								.pipe(new PassThrough({ objectMode: true }))
								.on('data', (chunk: { buffer: Buffer; position: number }) => {
									chunk.buffer.copy(actual, chunk.position);
								})
								.once('end', () => {
									assert.ok(expected.equals(actual), 'Buffer equality');
									assert.equal(expected.length, size);
									resolve();
								});
						});
					});
				});
			});
		});
	});
});
